# Nirnay - Meeting-to-Execution Agent
> *"Meeting ke faisle, kaam mein badlo."*

Nirnay reads conversational meeting transcripts in Hindi, English, and Hinglish, extracts decisions and tasks with exact quote citations, remembers past commitments across meetings, detects 3 distinct types of cross-meeting conflicts, and gates every external ticket or notification behind human confirmation in an Outbox.

---

## 🌟 Feature List

1. **Hinglish & English Multi-lingual Extraction:** Understands conversational dialogue (e.g., *"kal tak kar dena"*, *"agle Friday tak"*), resolving relative deadlines using meeting dates.
2. **Cross-Meeting Memory & Task Evolution:** Automatically tracks status completions and deadline updates on earlier tasks without duplicate recreation.
3. **Triple Conflict Radar:**
   - **Decision Overrides:** Detects policy or pricing changes (e.g., ₹499 -> ₹599) and supersedes older decisions.
   - **Workload Spikes:** Identifies team members with $\ge 3$ deadlines clustered in a 7-day window.
   - **Dependency Clashes:** Flags when a dependent task is scheduled before its prerequisite finishes.
4. **Outbox Confirmation Gateway:** Nothing leaves the system without human review. Cards and reminders queue for 1-click approval or rejection.
5. **Tracker Integration (Trello & Internal Mode):** Automatically maps tasks to Trello lists ("To Do", "Blocked", "Done") or operates smoothly in internal mode when unconfigured.
6. **Automated Reminders & Simulated "Today":** Scans for due-soon ($\le 2$ days), overdue, and blocked tasks against any simulated demo calendar date.
7. **Interactive Kanban Board:** Switch between Table and Board views with native HTML5 drag-and-drop between Pending, Blocked, and Done.
8. **Ask Nirnay (Grounded AI with Citations):** Answers questions strictly from meeting memory with verbatim quotes that open source transcript highlights.
9. **Operations Dashboard:** Live KPIs, plain SVG/CSS capacity bars, decision evolution chains, upcoming deadlines, and activity feeds.
10. **Pre-Meeting Executive Brief:** Printable PDF briefing pack with active decisions, owner commitments, and agenda focus items.
11. **Weekly Team Digests:** Synthesizes commitment summaries and AI highlights per owner.
12. **Accuracy Scoreboard:** Benchmarks the live pipeline against ground truth across 3 seed meetings, measuring precision, recall, and quote validity.
13. **Guided Demo Mode:** Presenter-assisted step-by-step walkthrough drawer with built-in presenter scripts.

---

## 🏗️ Architecture in 6 Lines

- **Frontend:** React 19 + Vite + Tailwind CSS with dark theme, plain SVG workload charts, and native HTML5 drag-and-drop.
- **Backend API:** FastAPI (Python 3.11+) with clean modular services (`meeting_service`, `conflicts`, `eval_scoring`, `ask_nirnay`, `dashboard`, `outbox_service`).
- **Database:** SQLite with SQLAlchemy ORM and schema auto-migration (`PRAGMA table_info` column diffing on startup).
- **LLM Gateway:** Groq Python SDK with `openai/gpt-oss-120b` (temperature 0, strict JSON object response mode).
- **Quote Verification:** Invariant character-for-character substring verification guaranteeing zero hallucinated quotes.
- **External Trackers:** Non-blocking HTTP clients via `httpx` for Trello REST APIs and Discord/Slack incoming webhooks.

---

## ⚙️ Environment Variables

Create `backend/.env` with the following variables:

```bash
# Required for live LLM extraction and Ask Nirnay
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b

# Optional: Groq reasoning effort parameter ("low" | "medium" | "high")
GROQ_REASONING_EFFORT=

# Optional: Trello integration (if omitted, runs in internal tracker mode)
TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=

# Optional: Incoming webhook URL for Discord / Slack alerts
NOTIFY_WEBHOOK_URL=

# Fallback mode for testing when no Groq key is supplied
DEMO_FALLBACK=false
```

---

## 🚀 How to Run Locally

Run both commands from the **PROJECT ROOT**:

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Run backend API server (FastAPI on port 8000)
uvicorn backend.main:app --reload --port 8000

# 3. In another terminal, run frontend dev server (Vite on port 5173)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## ☁️ Deployment

- **Backend:** Hosted on **Render** (`https://nirnay-iqf3.onrender.com`) running `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend:** Hosted on **Vercel** with `vercel.json` rewrites routing all `/api/*` requests directly to the Render backend.

---

## 🧪 Running Unit Tests

Unit tests require **no API key and zero network access**:

```bash
python -m pytest backend/tests/ -v
```
