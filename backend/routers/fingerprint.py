from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter
import datetime
import os

from database import get_db
from models import Agent, ActivityLog, BehavioralFingerprint
from schemas import FingerprintResponse

router = APIRouter()

ML_MODELS_DIR = os.getenv("ML_MODELS_DIR", "/app/ml_models")


def _try_train_autoencoder(agent_id: str, logs: list, fp: BehavioralFingerprint) -> dict:
    """Train autoencoder and return metrics. Non-fatal if TF not available."""
    try:
        from ml.behavioral_autoencoder import BehavioralAutoencoder
        import numpy as np

        log_dicts = [
            {
                'service': log.service,
                'event_name': log.event_name,
                'event_time': log.event_time
            }
            for log in logs
        ]

        autoencoder = BehavioralAutoencoder(sequence_length=min(20, len(logs)))
        X, metadata = autoencoder.prepare_sequences(log_dicts)

        if len(X) < 5:
            return {"trained": False, "reason": "Not enough sequences"}

        history = autoencoder.train(X, epochs=30, batch_size=min(16, len(X)))
        val_losses = history.history.get('val_loss', [])
        train_losses = history.history.get('loss', [])

        # Calculate threshold (mean + 2*std of training reconstruction errors)
        train_errors = autoencoder.calculate_reconstruction_error(X)
        threshold = float(np.mean(train_errors) + 2 * np.std(train_errors))

        # Calculate events per hour for rate monitoring (Gap 1)
        hourly_counts = Counter()
        for log in logs:
            hour_key = log.event_time.strftime('%Y-%m-%d %H')
            hourly_counts[hour_key] += 1

        avg_per_hour = sum(hourly_counts.values()) / max(len(hourly_counts), 1)
        max_per_hour = max(hourly_counts.values()) if hourly_counts else 0

        # Save model
        model_dir = os.path.join(ML_MODELS_DIR, agent_id)
        os.makedirs(model_dir, exist_ok=True)
        model_path = os.path.join(model_dir, "fingerprint")
        autoencoder.save(model_path)

        # Update fingerprint
        fp.model_path = model_path
        fp.model_version = f"1.0.{len(logs)}"
        fp.anomaly_threshold = threshold
        fp.avg_events_per_hour = avg_per_hour
        fp.max_events_per_hour = float(max_per_hour)

        return {
            "trained": True,
            "threshold": threshold,
            "final_loss": float(train_losses[-1]) if train_losses else None,
            "final_val_loss": float(val_losses[-1]) if val_losses else None,
            "training_sequences": len(X),
            "epochs_run": len(train_losses),
            "avg_events_per_hour": avg_per_hour,
            "max_events_per_hour": float(max_per_hour),
            "train_errors": [float(e) for e in train_errors[:50]]
        }

    except ImportError:
        return {"trained": False, "reason": "TensorFlow not available"}
    except Exception as e:
        return {"trained": False, "reason": str(e)}


@router.get("/{agent_id}", response_model=FingerprintResponse)
def get_fingerprint(agent_id: str, db: Session = Depends(get_db)):
    fp = db.query(BehavioralFingerprint).filter(BehavioralFingerprint.agent_id == agent_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Fingerprint not found. Run /build first.")
    return FingerprintResponse.model_validate(fp)


@router.post("/{agent_id}/build")
def build_fingerprint(agent_id: str, days: int = 30, db: Session = Depends(get_db)):
    """Rebuild the behavioral fingerprint + train DL autoencoder from activity logs."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    logs = db.query(ActivityLog).filter(
        ActivityLog.agent_id == agent_id,
        ActivityLog.event_time >= since,
        ActivityLog.is_anomalous == False
    ).order_by(ActivityLog.event_time.asc()).all()

    if not logs:
        raise HTTPException(status_code=400, detail="Not enough activity logs to build fingerprint")

    services = [log.service for log in logs]
    actions = [log.event_name for log in logs]
    hours = [log.event_time.hour for log in logs]

    service_freq = dict(Counter(services))
    action_freq = dict(Counter(actions))

    hour_counter = Counter(hours)
    total = len(hours)
    typical_hours = [h for h, c in hour_counter.items() if c / total > 0.03]

    days_with_activity = len(set(log.event_time.date() for log in logs)) or 1
    avg_daily = len(logs) / days_with_activity

    fp = db.query(BehavioralFingerprint).filter(BehavioralFingerprint.agent_id == agent_id).first()

    if fp:
        fp.normal_services = list(set(services))
        fp.normal_actions = list(set(actions))
        fp.service_frequency = service_freq
        fp.action_frequency = action_freq
        fp.typical_hours = sorted(typical_hours)
        fp.avg_daily_events = avg_daily
        fp.last_updated = datetime.datetime.utcnow()
    else:
        fp = BehavioralFingerprint(
            agent_id=agent_id,
            normal_services=list(set(services)),
            normal_actions=list(set(actions)),
            service_frequency=service_freq,
            action_frequency=action_freq,
            typical_hours=sorted(typical_hours),
            avg_daily_events=avg_daily,
        )
        db.add(fp)
        db.flush()

    # Train DL autoencoder
    ml_result = _try_train_autoencoder(agent_id, logs, fp)
    if ml_result.get("trained"):
        print(f"Autoencoder trained for {agent_id}: threshold={ml_result['threshold']:.4f}")

    db.commit()
    db.refresh(fp)

    response = FingerprintResponse.model_validate(fp)
    response_dict = response.model_dump()
    response_dict["ml_training"] = ml_result
    return response_dict


@router.get("/{agent_id}/deviation")
def get_deviation_score(agent_id: str, action: str, service: str, db: Session = Depends(get_db)):
    """Calculate how much a specific action deviates — uses DL model if available, else rule-based."""
    fp = db.query(BehavioralFingerprint).filter(BehavioralFingerprint.agent_id == agent_id).first()
    if not fp:
        return {"deviation_score": 0.5, "message": "No fingerprint available"}

    # Try DL-based deviation
    if fp.model_path:
        try:
            from ml.behavioral_autoencoder import BehavioralAutoencoder

            # Get recent logs for sequence
            recent_logs = db.query(ActivityLog).filter(
                ActivityLog.agent_id == agent_id
            ).order_by(ActivityLog.event_time.desc()).limit(50).all()
            recent_logs = list(reversed(recent_logs))

            if len(recent_logs) >= 20:
                autoencoder = BehavioralAutoencoder(sequence_length=min(20, len(recent_logs)))
                autoencoder.load(fp.model_path)

                log_dicts = [
                    {'service': log.service, 'event_name': log.event_name, 'event_time': log.event_time}
                    for log in recent_logs
                ]

                result = autoencoder.predict_anomaly_score(log_dicts, fp.anomaly_threshold)

                return {
                    "deviation_score": result["anomaly_score"] / 100,
                    "deviation_percent": result["anomaly_score"],
                    "is_anomalous": result["is_anomalous"],
                    "reconstruction_error": result["reconstruction_error"],
                    "rate_anomaly_detected": result["rate_anomaly_detected"],
                    "events_per_hour": result["events_per_hour"],
                    "method": "deep_learning",
                    "reasons": ["High reconstruction error — sequence deviates from learned normal pattern"] if result["is_anomalous"] else []
                }
        except Exception as e:
            print(f"DL deviation failed, falling back to rule-based: {e}")

    # Rule-based fallback
    score = 0.0
    reasons = []

    if service not in (fp.normal_services or []):
        score += 0.5
        reasons.append(f"Service '{service}' never seen before")
    else:
        freq = fp.service_frequency.get(service, 0)
        if freq < 3:
            score += 0.2
            reasons.append(f"Service '{service}' rarely used (only {freq} times)")

    if action not in (fp.normal_actions or []):
        score += 0.4
        reasons.append(f"Action '{action}' never performed before")

    hour = datetime.datetime.utcnow().hour
    if hour not in (fp.typical_hours or []):
        score += 0.1
        reasons.append(f"Unusual time of activity: {hour}:00 UTC")

    score = min(score, 1.0)
    return {
        "deviation_score": round(score, 2),
        "deviation_percent": round(score * 100, 1),
        "is_anomalous": score > 0.4,
        "rate_anomaly_detected": False,
        "events_per_hour": 0,
        "method": "rule_based",
        "reasons": reasons,
    }


@router.get("/{agent_id}/model-metrics")
def get_model_metrics(agent_id: str, db: Session = Depends(get_db)):
    """Get DL model performance metrics and reconstruction error history."""
    fp = db.query(BehavioralFingerprint).filter(BehavioralFingerprint.agent_id == agent_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Fingerprint not found")

    # Get recent logs and calculate reconstruction errors
    logs = db.query(ActivityLog).filter(
        ActivityLog.agent_id == agent_id
    ).order_by(ActivityLog.event_time.asc()).all()

    if not fp.model_path or not logs:
        return {
            "model_trained": False,
            "model_version": fp.model_version,
            "anomaly_threshold": fp.anomaly_threshold,
            "timeline": []
        }

    try:
        from ml.behavioral_autoencoder import BehavioralAutoencoder
        import numpy as np

        autoencoder = BehavioralAutoencoder(sequence_length=min(20, len(logs)))
        autoencoder.load(fp.model_path)

        log_dicts = [
            {'service': log.service, 'event_name': log.event_name,
             'event_time': log.event_time, 'is_anomalous': log.is_anomalous}
            for log in logs
        ]

        X, _ = autoencoder.prepare_sequences(log_dicts)
        errors = autoencoder.calculate_reconstruction_error(X)

        timeline = []
        for i, (log, error) in enumerate(zip(logs[autoencoder.sequence_length - 1:], errors)):
            timeline.append({
                "time": log.event_time.isoformat(),
                "reconstruction_error": float(error),
                "is_anomalous": bool(log.is_anomalous),
                "event_name": logs[i + autoencoder.sequence_length - 1].event_name if i + autoencoder.sequence_length - 1 < len(logs) else log.event_name,
                "above_threshold": float(error) > fp.anomaly_threshold
            })

        return {
            "model_trained": True,
            "model_version": fp.model_version,
            "anomaly_threshold": fp.anomaly_threshold,
            "avg_normal_error": float(np.mean([e for e, l in zip(errors, logs[autoencoder.sequence_length - 1:]) if not l.is_anomalous])) if any(not l.is_anomalous for l in logs) else 0,
            "avg_anomalous_error": float(np.mean([e for e, l in zip(errors, logs[autoencoder.sequence_length - 1:]) if l.is_anomalous])) if any(l.is_anomalous for l in logs) else 0,
            "avg_events_per_hour": fp.avg_events_per_hour,
            "max_events_per_hour": fp.max_events_per_hour,
            "timeline": timeline[-100:]  # Last 100 data points
        }

    except Exception as e:
        return {
            "model_trained": bool(fp.model_path),
            "model_version": fp.model_version,
            "anomaly_threshold": fp.anomaly_threshold,
            "error": str(e),
            "timeline": []
        }
