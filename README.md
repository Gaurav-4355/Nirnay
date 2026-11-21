# Nirnay - Meeting-to-Execution Agent
> "Meeting ke faisle, kaam mein badlo."

## Quickstart (Run Both in 5 Lines)

```bash
# 1. Configure Groq API Key (get free key at https://console.groq.com/keys)
echo GROQ_API_KEY=your_groq_api_key_here > backend/.env

# 2. Start Backend API Server (FastAPI on port 8000)
uvicorn backend.main:app --reload --port 8000

# 3. Start Frontend Development Server (Vite on port 5173)
cd frontend && npm run dev
```

Visit **http://localhost:5173** in your browser.
