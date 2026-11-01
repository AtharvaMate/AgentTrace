# AgentTrace — AI Agent Behavioral Monitoring & Cloud Security

**AgentTrace** is a comprehensive security monitoring platform for AI agents operating in AWS cloud environments. It combines real-time activity monitoring, deep learning-based behavioral analysis, IAM guardrails, and blast-radius visualization to detect and explain suspicious agent behavior.

Built with **React + Vite** (frontend), **FastAPI** (backend), **PostgreSQL** (database), **TensorFlow** (ML), and **Floci** (local AWS emulator).

---

## 🎯 Key Features

### 1. **Real AWS Activity Monitoring**
- Integrates with **Floci** (local AWS emulator) for realistic AWS API simulation
- **CloudTrail** log ingestion and parsing (polls S3 every 60s)
- Real boto3 execution for attack scenarios (secrets access, IAM escalation, S3 deletion, etc.)

### 2. **Deep Learning Behavioral Fingerprinting**
- **LSTM Autoencoder** trained on normal agent behavior sequences
- Detects anomalies via reconstruction error analysis
- **Gap 1 Guardrail**: Rate anomaly detection (volume spikes flagged automatically)
- Features: service, action, hour, events-per-hour, time-since-last-action

### 3. **Multi-Layer Risk Analysis**
- **Hybrid scoring**: 60% DL anomaly score + 40% rule-based policy violations
- Gemini AI explanations for risk events
- Compares: IAM Allowed ↔ Intended Purpose ↔ Actual Behavior
- Real-time risk scoring with detailed factor breakdown

### 4. **IAM Guardrails & Policy Optimization**
- Real IAM role enforcement in Floci (`ENFORCE_IAM=1`)
- Automatic **least-privilege policy generator** (shows unused permissions)
- Intent vs Actual comparison table (flags concerning actions)

### 5. **Blast Radius Visualization**
- ReactFlow graph showing: Agent → Services → Resources
- Impact estimation (CRITICAL/HIGH/LOW)
- Sensitive resource highlighting

### 6. **Beautiful, Modern UI**
- Dark mode design system with smooth animations
- 5-tab agent detail view: Overview | Behavioral AI | Intent vs Actual | Blast Radius | Risk Events
- Real-time stats, live activity feed, reconstruction error timelines
- Attack scenario simulation with visual step progression

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  React 18 + Vite + React Router + Recharts + ReactFlow     │
│                    (Port 5173)                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP (Vite proxy /api → 8000)
┌─────────────────────▼───────────────────────────────────────┐
│                         Backend                             │
│  FastAPI + SQLAlchemy + TensorFlow + Boto3                 │
│                    (Port 8000)                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Routers: agents | activity | risk | fingerprint |    │  │
│  │          blast_radius | scenarios                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Services: CloudTrail Poller (60s poll) |             │  │
│  │           Attack Scenarios (6 real boto3 flows)      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ ML: LSTM Autoencoder (behavioral_autoencoder.py)     │  │
│  │     - Training on normal event sequences             │  │
│  │     - Reconstruction error → anomaly score           │  │
│  │     - Rate anomaly detection (Gap 1)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────────┐
│ PostgreSQL│  │   Floci   │  │ Gemini API    │
│  (5432)   │  │  (4566)   │  │ (optional)    │
│           │  │           │  │               │
│ • Agents  │  │ • S3      │  │ Explains risk │
│ • Logs    │  │ • IAM     │  │ events in     │
│ • Risks   │  │ • Secrets │  │ natural lang  │
│ • FPs     │  │ • DynamoDB│  │               │
│           │  │ • CloudTrl│  │               │
└───────────┘  └───────────┘  └───────────────┘
```

---

## 🚀 Quickstart

### Prerequisites
- **Docker** and **Docker Compose**
- (Optional) `GEMINI_API_KEY` for AI explanations

### 1. Clone & Navigate
```bash
cd AgentTrace
```

### 2. Set Environment Variables
```bash
cp .env.example .env
# Edit .env to add GEMINI_API_KEY (optional)
```

### 3. Start the Stack
```bash
docker-compose up --build
```

This starts:
- **Floci** (localhost:4566) — AWS emulator with CloudTrail
- **PostgreSQL** (localhost:5432)
- **Backend** (localhost:8000) — FastAPI + ML
- **Frontend** (localhost:5173) — React UI

### 4. Access the Dashboard
Open **http://localhost:5173** in your browser.

The system auto-seeds 4 demo agents on startup. You'll see:
- Live activity feed
- Risk scores and alerts
- Attack scenario simulator

---

## 📊 Demo Flow

### Step 1: View Dashboard
- 4 pre-seeded agents: Sales Report Agent, Data Pipeline Agent, Customer Support Bot, DevOps Automation Agent
- Stats cards showing: Monitored Agents, Critical Alerts, Events Today, Anomalies
- Activity timeline chart (14 days, normal vs anomalous events)

### Step 2: Run Attack Scenario
1. Navigate to **Attack Scenarios** (sidebar)
2. Select an agent (e.g., Sales Report Agent)
3. Click a scenario card:
   - **Secrets Access** (CRITICAL) — reads prod credentials
   - **IAM Escalation** (CRITICAL) — creates admin role
   - **S3 Deletion** (HIGH) — deletes customer data
   - **Prod DB Access** (HIGH) — scans production table
   - **Normal Baseline** (LOW) — expected S3/DynamoDB reads
   - **KMS Access** (MEDIUM) — unusual timing
4. Watch real boto3 calls execute against Floci
5. View risk analysis: score ring, factors, AI explanation, recommendations

### Step 3: Explore Agent Detail
1. Click any agent card on Dashboard
2. Navigate through 5 tabs:

**Overview Tab**
- Recent activity feed (anomalies highlighted)
- Service usage radar chart
- IAM permissions tag cloud

**Behavioral AI Tab** (most impressive)
- Model status cards: version, threshold, events/hour stats
- **Reconstruction error timeline chart** — red dots = anomalies above threshold
- **Rate Anomaly Guardrail** — shows volume spike detection
- Service/action frequency bar charts
- 24-hour activity heatmap

**Intent vs Actual Tab**
- Table: IAM Allowed | Intended | Actually Performed
- Red highlights for concerning actions
- **Generate Least-Privilege Policy** button → shows JSON, copy to clipboard

**Blast Radius Tab**
- ReactFlow graph: Agent → Services → Resources
- Impact summary chips (CRITICAL/HIGH/LOW)
- Alerts for sensitive resources

**Risk Events Tab**
- Timeline of all risk events
- Risk rings, factor badges, AI explanations
- Numbered recommendations
- Resolve button

### Step 4: Build DL Fingerprint
1. Click **Build Fingerprint** button in Agent Detail
2. Backend trains LSTM autoencoder on last 30 days of normal activity
3. Model metrics appear in **Behavioral AI** tab
4. Reconstruction error chart shows which events deviate from learned pattern

### Step 5: CloudTrail Sync
- Click **Sync CloudTrail** (top bar) to manually poll Floci S3 logs
- Or wait 60s — automatic background polling

---

## 🧠 Deep Learning Model

### Architecture: LSTM Autoencoder
```python
Input: Sequence of 50 events
  ↓
[ service_id | action_id | hour | events_per_hour | time_delta ]
  ↓
Encoder: LSTM(64) → LSTM(32) → Dense(16)
  ↓
Latent representation (16 dims)
  ↓
Decoder: RepeatVector(50) → LSTM(32) → LSTM(64) → Dense(5)
  ↓
Reconstructed sequence
  ↓
MSE Loss → Reconstruction Error
```

### Anomaly Detection Logic
- **Training**: Only on non-anomalous events
- **Threshold**: `mean(train_errors) + 2 * std(train_errors)`
- **Prediction**: New sequence → reconstruction error > threshold → anomalous
- **Rate Anomaly (Gap 1)**: `events_per_hour > 100` flagged regardless of pattern

### Features per Event
1. **Service ID** (normalized, label-encoded)
2. **Action ID** (normalized, label-encoded)
3. **Hour of day** (0-23, normalized to 0-1)
4. **Events in current hour** (normalized by max observed)
5. **Time since last action** (minutes, capped at 1440)

---

## 📁 Project Structure

```
AgentTrace/
├── docker-compose.yml          # 4 services: floci, db, backend, frontend
├── .env.example                # Template (GEMINI_API_KEY, DB creds)
├── requirements.txt            # Python deps (FastAPI, TF, boto3, etc.)
├── backend/
│   ├── Dockerfile              # Python 3.11 + TensorFlow
│   ├── main.py                 # FastAPI app + CloudTrail setup + poller start
│   ├── database.py             # SQLAlchemy engine
│   ├── models.py               # Agent, ActivityLog, RiskEvent, BehavioralFingerprint
│   ├── schemas.py              # Pydantic models
│   ├── seed_data.py            # Demo agents + Floci IAM/S3/secrets setup
│   ├── routers/
│   │   ├── agents.py           # CRUD + stats
│   │   ├── activity.py         # Logs + timeline + sync endpoint
│   │   ├── risk.py             # Scoring + Gemini AI + intent comparison + LPP
│   │   ├── fingerprint.py      # DL model build + deviation + metrics
│   │   ├── blast_radius.py     # ReactFlow graph data
│   │   └── scenarios.py        # List + execute attack scenarios
│   ├── services/
│   │   ├── cloudtrail_poller.py  # Background S3 log polling (60s)
│   │   └── attack_scenarios.py   # 6 real boto3 scenario flows
│   └── ml/
│       └── behavioral_autoencoder.py  # LSTM autoencoder class
└── frontend/
    ├── Dockerfile              # Node 20 + Vite dev server
    ├── vite.config.js          # Proxy /api → backend:8000
    ├── package.json            # React, React Router, Recharts, ReactFlow
    ├── index.html
    └── src/
        ├── main.jsx            # React DOM entry
        ├── App.jsx             # Router + Layout
        ├── index.css           # Complete dark design system (80KB)
        ├── api/client.js       # Axios API functions
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── TopBar.jsx
        │   ├── RiskBadge.jsx
        │   ├── RiskRing.jsx         # SVG circular progress
        │   ├── ActivityFeed.jsx
        │   └── BlastRadiusGraph.jsx # ReactFlow wrapper
        └── pages/
            ├── Dashboard.jsx         # Main landing page
            ├── SimulateActivity.jsx  # Attack scenario execution
            ├── AgentDetail.jsx       # 5-tab agent view
            └── RegisterAgent.jsx     # Create new agent
```

---

## 🔧 Configuration

### Environment Variables (`.env`)
```bash
# Database
POSTGRES_USER=agenttrace
POSTGRES_PASSWORD=agenttrace_secret
POSTGRES_DB=agenttrace

# Backend
SEED_ON_STARTUP=true
GEMINI_API_KEY=your-key-here  # Optional, falls back to rule-based

# AWS / Floci
AWS_ENDPOINT_URL=http://floci:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
CLOUDTRAIL_BUCKET=agenttrace-cloudtrail-logs
CLOUDTRAIL_POLL_INTERVAL=60  # seconds

# ML
ML_MODELS_DIR=/app/ml_models
```

### Backend Ports
- **8000**: FastAPI (Swagger at `/docs`)
- **5432**: PostgreSQL

### Frontend Ports
- **5173**: Vite dev server

### Floci Ports
- **4566**: All AWS services (S3, IAM, CloudTrail, DynamoDB, Secrets, KMS)

---

## 📚 API Endpoints

### Agents
- `GET /api/agents/` — List all agents (with summary stats)
- `GET /api/agents/{id}` — Get agent detail
- `POST /api/agents/` — Register new agent
- `GET /api/agents/stats` — Dashboard stats

### Activity
- `GET /api/activity/{agent_id}?limit=50` — Recent logs
- `GET /api/activity/{agent_id}/timeline?days=14` — Chart data
- `POST /api/activity/sync-cloudtrail` — Manually trigger CloudTrail poll

### Risk
- `GET /api/risk/{agent_id}/events` — Risk events for agent
- `GET /api/risk/{agent_id}/intent-comparison` — IAM vs Intended vs Actual table
- `GET /api/risk/{agent_id}/least-privilege-policy` — Auto-generate minimal IAM policy

### Fingerprint
- `GET /api/fingerprint/{agent_id}` — Get fingerprint
- `POST /api/fingerprint/{agent_id}/build` — Train DL model
- `GET /api/fingerprint/{agent_id}/model-metrics` — Reconstruction error timeline
- `GET /api/fingerprint/{agent_id}/deviation?action=X&service=Y` — Deviation score

### Blast Radius
- `GET /api/blast-radius/{agent_id}` — ReactFlow graph data

### Scenarios
- `GET /api/scenarios/` — List 6 attack scenarios
- `POST /api/scenarios/{scenario_id}/run/{agent_id}` — Execute real boto3 scenario

Full API docs at **http://localhost:8000/docs**

---

## 🎨 UI Design System

### Color Palette
- **Accent**: Indigo (`--accent-primary: #6366f1`)
- **Green**: `#10b981` (success, normal, low risk)
- **Red**: `#ef4444` (critical, anomalous)
- **Orange**: `#f97316` (high risk)
- **Yellow**: `#eab308` (medium risk)
- **Blue**: `#3b82f6` (info, activity)
- **Purple**: `#a855f7` (stats)

### Key Components
- **Stat Cards**: Colored top border, icon, value, label
- **Agent Cards**: Hover glow effect, clickable, risk badge
- **Scenario Cards**: Color-coded by severity, hover shadow
- **Risk Ring**: SVG circular progress (0-100), color gradient
- **Activity Feed**: Icon (blue=normal, red=anomalous), timestamp
- **Badges**: Rounded pills (critical/high/medium/low/info/neutral/green)
- **Buttons**: Primary/Secondary/Danger/Success/Ghost, with icons
- **Tabs**: Rounded, active state with background
- **Code Blocks**: Monospace, dark background, copy button
- **Modals**: Backdrop blur, slide-up animation

---

## 🛡️ Guardrails Implemented

### 1. IAM Enforcement (Infrastructure Layer)
- Real IAM roles in Floci with least-privilege policies
- `ENFORCE_IAM=1` in Floci config
- `AccessDenied` events logged to CloudTrail

### 2. Application-Level Validation (Business Logic Layer)
- Compares action against `expected_services` and `expected_actions`
- Flags violations before boto3 execution

### 3. Rate Anomaly Detection (Gap 1 — DL Model)
- Events-per-hour feature in autoencoder input
- `>100 events/hour` flagged as suspicious
- Detects volume spikes regardless of action legitimacy

### 4. Behavioral Drift Detection (DL Model)
- Autoencoder learns normal sequences
- High reconstruction error = unusual pattern
- Threshold = `mean + 2*std` of training errors

### 5. Intent vs Actual Comparison (Compliance Layer)
- Compares IAM permissions vs intended purpose vs actual usage
- Highlights "technically allowed but not intended" actions

---

## 📖 Usage Tips

### Building Fingerprints
- Needs **20+ normal events** minimum for training
- Best results with **50+ events**
- Retrain after major behavior changes
- Check "Model Performance" chart to verify threshold tuning

### Attack Scenarios
- **Secrets Access** — tests sensitive resource access
- **IAM Escalation** — tests privilege escalation detection
- **S3 Deletion** — tests destructive action detection
- **Prod DB Access** — tests resource scope violations
- **Normal Baseline** — establishes legitimate activity pattern
- **KMS Access** — tests unusual timing detection

### Least-Privilege Policies
- Generated from actual usage (non-anomalous events only)
- Shows % reduction from current IAM permissions
- Copy JSON and apply to Floci IAM role for stricter enforcement

### CloudTrail Sync
- Automatic poll every 60s (background thread)
- Manual sync via "Sync CloudTrail" button (top bar)
- Logs ingested from `agenttrace-cloudtrail-logs` S3 bucket
- Parsed CloudTrail JSON → `ActivityLog` table

---

## 🐛 Troubleshooting

### Backend won't start
- Check PostgreSQL is healthy: `docker-compose logs db`
- Check Floci is running: `curl http://localhost:4566/_floci/health`
- Check TensorFlow installed: `docker exec -it agenttrace_backend pip show tensorflow`

### No CloudTrail logs ingested
- Verify trail exists: `aws --endpoint-url=http://localhost:4566 cloudtrail get-trail --name agenttrace-trail`
- Check S3 bucket: `aws --endpoint-url=http://localhost:4566 s3 ls s3://agenttrace-cloudtrail-logs`
- Check backend logs: `docker-compose logs backend | grep CloudTrail`

### Frontend can't reach backend
- Verify Vite proxy: Check `vite.config.js` proxies `/api` to `http://localhost:8000`
- Check CORS: Backend allows all origins (`allow_origins=["*"]`)
- Network inspect: Open DevTools → Network tab, check `/api/*` requests

### DL model not training
- Check logs: `docker-compose logs backend | grep autoencoder`
- Verify enough events: Needs 20+ for sequences
- Check TensorFlow: `docker exec -it agenttrace_backend python -c "import tensorflow; print(tensorflow.__version__)"`

### Floci connection refused
- Ensure Floci container is running: `docker ps | grep floci`
- Check port mapping: `4566:4566` in `docker-compose.yml`
- Test from host: `curl http://localhost:4566/_floci/health`

---

## 🚧 Roadmap

- [ ] Multi-agent correlation (cross-agent blast radius)
- [ ] Webhook alerts (Slack, email) for critical risks
- [ ] Historical risk trend charts
- [ ] Custom scenario builder (UI for defining boto3 sequences)
- [ ] STS AssumeRole integration (temporary credentials)
- [ ] VPC network simulation in Floci
- [ ] Export risk reports as PDF
- [ ] Prometheus metrics endpoint

---

## 📄 License

MIT License — built for educational purposes as a college project.

---

## 🙏 Acknowledgments

- **Floci** (github.com/floci-io/floci) — Local AWS emulator (100% free, no auth tokens)
- **TensorFlow** — Deep learning framework
- **FastAPI** — Modern Python web framework
- **React** + **Vite** — Frontend stack
- **Recharts** — Beautiful charts
- **ReactFlow** — Graph visualization
- **Lucide Icons** — Clean icon set

---

## 👨💻 Author

Built as a 7th semester college project demonstrating:
- Multi-layer cloud security architecture
- Deep learning for behavioral anomaly detection
- Real-world AWS patterns (CloudTrail, IAM, boto3)
- Full-stack development (React + FastAPI + PostgreSQL + TensorFlow)
- Docker containerization
- Modern UI/UX design

**AgentTrace** — Making AI agent behavior visible, explainable, and secure.
