"""
Behavioral Autoencoder for Agent Anomaly Detection
Trains on sequences of normal agent actions, detects anomalies via reconstruction error.
Includes rate anomaly detection (Gap 1 guardrail).
"""
import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.preprocessing import LabelEncoder
from typing import List, Dict, Tuple
import pickle


class BehavioralAutoencoder:
    """
    Autoencoder-based anomaly detection for agent behavior.
    
    Input: Sequence of (service, action, hour, events_per_hour)
    Output: Reconstruction error (high = anomalous)
    """
    
    def __init__(self, sequence_length: int = 50, encoding_dim: int = 16):
        self.sequence_length = sequence_length
        self.encoding_dim = encoding_dim
        self.model = None
        self.service_encoder = LabelEncoder()
        self.action_encoder = LabelEncoder()
        self.is_fitted = False
        
    def build_model(self, input_dim: int):
        """Build the autoencoder architecture."""
        # Encoder
        input_layer = layers.Input(shape=(self.sequence_length, input_dim))
        
        # LSTM encoder
        x = layers.LSTM(64, activation='relu', return_sequences=True)(input_layer)
        x = layers.Dropout(0.2)(x)
        x = layers.LSTM(32, activation='relu', return_sequences=False)(x)
        encoded = layers.Dense(self.encoding_dim, activation='relu')(x)
        
        # Decoder
        x = layers.RepeatVector(self.sequence_length)(encoded)
        x = layers.LSTM(32, activation='relu', return_sequences=True)(x)
        x = layers.Dropout(0.2)(x)
        x = layers.LSTM(64, activation='relu', return_sequences=True)(x)
        decoded = layers.TimeDistributed(layers.Dense(input_dim))(x)
        
        self.model = keras.Model(input_layer, decoded)
        self.model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        
        return self.model
    
    def prepare_sequences(self, logs: List[Dict]) -> Tuple[np.ndarray, Dict]:
        """
        Convert activity logs to sequences for training.
        
        Features per event:
        - service_id (encoded)
        - action_id (encoded)
        - hour_of_day (0-23, normalized)
        - events_per_hour (normalized, for rate anomaly detection)
        - time_since_last_action (minutes, normalized)
        """
        if len(logs) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} events to train")
        
        # Fit encoders
        services = [log['service'] for log in logs]
        actions = [log['event_name'] for log in logs]
        
        self.service_encoder.fit(services)
        self.action_encoder.fit(actions)
        
        # Calculate events per hour for rate anomaly detection
        hourly_counts = {}
        for log in logs:
            hour_key = log['event_time'].strftime('%Y-%m-%d %H')
            hourly_counts[hour_key] = hourly_counts.get(hour_key, 0) + 1
        
        max_hourly = max(hourly_counts.values()) if hourly_counts else 1
        
        # Build feature vectors
        features = []
        for i, log in enumerate(logs):
            hour_key = log['event_time'].strftime('%Y-%m-%d %H')
            events_in_hour = hourly_counts.get(hour_key, 0)
            
            # Time since last action
            if i > 0:
                time_diff = (log['event_time'] - logs[i-1]['event_time']).total_seconds() / 60.0
                time_diff = min(time_diff, 1440)  # Cap at 24 hours
            else:
                time_diff = 0
            
            feature_vec = [
                self.service_encoder.transform([log['service']])[0] / max(len(self.service_encoder.classes_), 1),
                self.action_encoder.transform([log['event_name']])[0] / max(len(self.action_encoder.classes_), 1),
                log['event_time'].hour / 23.0,
                events_in_hour / max_hourly,  # Rate feature for Gap 1
                time_diff / 1440.0  # Normalized to 0-1 (24 hours max)
            ]
            features.append(feature_vec)
        
        # Create sequences
        sequences = []
        for i in range(len(features) - self.sequence_length + 1):
            seq = features[i:i + self.sequence_length]
            sequences.append(seq)
        
        X = np.array(sequences)
        
        metadata = {
            'max_hourly': max_hourly,
            'service_classes': self.service_encoder.classes_.tolist(),
            'action_classes': self.action_encoder.classes_.tolist()
        }
        
        self.is_fitted = True
        return X, metadata
    
    def train(self, X: np.ndarray, epochs: int = 50, batch_size: int = 32, validation_split: float = 0.2):
        """Train the autoencoder on normal behavior sequences."""
        if self.model is None:
            input_dim = X.shape[2]
            self.build_model(input_dim)
        
        # Early stopping to prevent overfitting
        early_stop = keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        )
        
        history = self.model.fit(
            X, X,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=[early_stop],
            verbose=0
        )
        
        return history
    
    def calculate_reconstruction_error(self, X: np.ndarray) -> np.ndarray:
        """Calculate reconstruction error for sequences."""
        if self.model is None:
            raise ValueError("Model not trained yet")
        
        reconstructed = self.model.predict(X, verbose=0)
        mse = np.mean(np.square(X - reconstructed), axis=(1, 2))
        return mse
    
    def predict_anomaly_score(self, log_sequence: List[Dict], threshold: float = None) -> Dict:
        """
        Predict anomaly score for a new sequence.
        
        Returns:
            {
                'anomaly_score': float (0-100),
                'is_anomalous': bool,
                'reconstruction_error': float,
                'rate_anomaly_detected': bool,
                'events_per_hour': int
            }
        """
        if not self.is_fitted:
            return {
                'anomaly_score': 0,
                'is_anomalous': False,
                'reconstruction_error': 0,
                'rate_anomaly_detected': False,
                'events_per_hour': 0,
                'message': 'Model not trained yet'
            }
        
        # Pad or truncate sequence
        if len(log_sequence) < self.sequence_length:
            # Not enough data, use simple heuristic
            return {
                'anomaly_score': 0,
                'is_anomalous': False,
                'reconstruction_error': 0,
                'rate_anomaly_detected': False,
                'events_per_hour': 0,
                'message': f'Need {self.sequence_length} events for prediction'
            }
        
        # Take last N events
        recent_logs = log_sequence[-self.sequence_length:]
        
        # Calculate current hourly rate
        hour_key = recent_logs[-1]['event_time'].strftime('%Y-%m-%d %H')
        events_in_hour = sum(1 for log in recent_logs if log['event_time'].strftime('%Y-%m-%d %H') == hour_key)
        
        # Prepare features (same as training)
        X, _ = self.prepare_sequences(recent_logs)
        
        # Calculate reconstruction error
        recon_error = self.calculate_reconstruction_error(X)[0]
        
        # Normalize to 0-100 score (tuned threshold)
        anomaly_score = min(recon_error * 100, 100)
        
        # Use provided threshold or default
        if threshold is None:
            threshold = 0.5
        
        is_anomalous = recon_error > threshold
        
        # Rate anomaly detection (Gap 1 guardrail)
        rate_anomaly = events_in_hour > 100  # >100 events/hour is suspicious
        
        return {
            'anomaly_score': float(anomaly_score),
            'is_anomalous': is_anomalous or rate_anomaly,
            'reconstruction_error': float(recon_error),
            'rate_anomaly_detected': rate_anomaly,
            'events_per_hour': events_in_hour
        }
    
    def save(self, path: str):
        """Save model and encoders."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # Save model
        self.model.save(f"{path}_model.h5")
        
        # Save encoders
        with open(f"{path}_encoders.pkl", 'wb') as f:
            pickle.dump({
                'service_encoder': self.service_encoder,
                'action_encoder': self.action_encoder,
                'sequence_length': self.sequence_length,
                'encoding_dim': self.encoding_dim,
                'is_fitted': self.is_fitted
            }, f)
    
    def load(self, path: str):
        """Load model and encoders."""
        self.model = keras.models.load_model(f"{path}_model.h5")
        
        with open(f"{path}_encoders.pkl", 'rb') as f:
            data = pickle.load(f)
            self.service_encoder = data['service_encoder']
            self.action_encoder = data['action_encoder']
            self.sequence_length = data['sequence_length']
            self.encoding_dim = data['encoding_dim']
            self.is_fitted = data['is_fitted']
