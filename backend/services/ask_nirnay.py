import json
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from ..models import Meeting, Decision, Task, Conflict
from ..llm import call_groq_json
from .quote_matcher import find_quote_span

ASK_NIRNAY_SYSTEM_PROMPT = """You are Nirnay, an AI Meeting-to-Execution assistant for a fast-paced product and engineering team.
You have access to historical meeting context including transcripts, finalized and superseded decisions, tasks, deadlines, ownership, and conflicts.

RULES:
1. Answer strictly using ONLY the provided meeting data. NEVER guess, assume, or fabricate facts.
2. If the user asks something not present or verifiable in the data, set "answerable": false, "answer": "Mujhe meetings mein iska jawab nahi mila.", "citations": [].
3. DECISION HISTORY: When asked about a decision that changed (e.g. pricing, launch date), explicitly state the current/final decision AND explain the previous decision and which meeting changed it.
4. LANGUAGE STYLE: Match the language style of the user's question. If the user asks in Hinglish ("Pricing ka final decision kya hai aur pehle kya tha?"), reply naturally in Hinglish ("Current pricing Rs 599/month hai jo Meeting 2 mein revise hui thi, pehle Meeting 1 mein Rs 499/month decide hui thi."). If English, reply in English.
5. CONCISENESS: Keep answers clear, direct, and concise (2-4 sentences).
6. CITATIONS: For every factual claim, provide a citation in the "citations" array. The "quote" field MUST be copied EXACTLY character-for-character from that meeting's transcript, and "meeting_id" must match the meeting integer id.

OUTPUT FORMAT:
Return strict JSON:
{
  "answerable": true,
  "answer": "...",
  "citations": [
    {
      "meeting_id": 1,
      "quote": "Exact sentence copied from transcript."
    }
  ]
}"""


def build_context_for_ask(db: Session) -> Tuple[str, Dict[int, str]]:
    """Gathers structured context and transcripts from database."""
    meetings = db.query(Meeting).order_by(Meeting.meeting_date.asc(), Meeting.id.asc()).all()
    decisions = db.query(Decision).all()
    tasks = db.query(Task).all()
    conflicts = db.query(Conflict).all()

    meetings_by_id = {m.id: m for m in meetings}
    transcripts_by_id = {m.id: m.transcript for m in meetings}

    context_lines = ["=== MEETINGS ==="]
    for m in meetings:
        context_lines.append(f"Meeting {m.id}: '{m.title}' held on {m.meeting_date}")

    context_lines.append("\n=== DECISIONS (ACTIVE & SUPERSEDED) ===")
    for d in decisions:
        m_info = f"Meeting {d.meeting_id}" if d.meeting_id else "Unknown"
        status_info = f"Status: {d.status}"
        if d.superseded_by_id:
            status_info += f" (Superseded by Decision #{d.superseded_by_id})"
        context_lines.append(
            f"Decision #{d.id} [{m_info}] Topic: '{d.topic}' | Value: '{d.value}' | Text: '{d.text}' | {status_info} | Evidence: \"{d.evidence_quote}\""
        )

    context_lines.append("\n=== TASKS & COMMITMENTS ===")
    for t in tasks:
        m_info = f"Meeting {t.meeting_id}" if t.meeting_id else "Unknown"
        dep_str = f" | Waits for Task #{t.depends_on_task_id}" if t.depends_on_task_id else ""
        upd_str = f" | Updated in Meeting #{t.updated_in_meeting_id}" if t.updated_in_meeting_id else ""
        ev_str = f" | Update Evidence: \"{t.status_evidence}\"" if t.status_evidence else ""
        context_lines.append(
            f"Task #{t.id} [{m_info}] Title: '{t.title}' | Owner: {t.owner or 'Unassigned'} | Deadline: {t.deadline or 'None'} | Status: {t.status}{dep_str}{upd_str} | Original Evidence: \"{t.evidence_quote}\"{ev_str}"
        )

    context_lines.append("\n=== CONFLICTS RECORDED ===")
    for c in conflicts:
        m_info = f"Meeting {c.meeting_id}" if c.meeting_id else "Unknown"
        context_lines.append(
            f"Conflict #{c.id} [{m_info}] Type: '{c.type}' | Title: '{c.title}' | Description: '{c.description}' | Resolution: '{c.resolution or 'Unresolved'}'"
        )

    context_lines.append("\n=== TRANSCRIPTS ===")
    # Cap total transcript text at ~30,000 characters
    char_budget = 30000
    for m in meetings:
        t_text = m.transcript.strip()
        if len(t_text) > char_budget:
            t_text = t_text[:char_budget] + "... [truncated]"
        context_lines.append(f"\n--- TRANSCRIPT FOR MEETING {m.id}: {m.title} ({m.meeting_date}) ---\n{t_text}")
        char_budget -= len(t_text)
        if char_budget <= 0:
            break

    full_context = "\n".join(context_lines)
    return full_context, transcripts_by_id


def answer_nirnay_question(
    db: Session,
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Answers user question grounded in meeting memory with verified citations."""
    context_str, transcripts_by_id = build_context_for_ask(db)

    user_prompt_parts = [
        "MEETING MEMORY & DATABASE STATE:",
        context_str,
        "\nUSER CONVERSATION HISTORY:",
    ]

    if history:
        for msg in history[-4:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            user_prompt_parts.append(f"{role.upper()}: {content}")

    user_prompt_parts.append(f"\nCURRENT QUESTION: {question}")
    user_prompt = "\n".join(user_prompt_parts)

    try:
        raw_res, _ = call_groq_json(
            system_prompt=ASK_NIRNAY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
    except Exception as e:
        return {
            "answerable": False,
            "answer": f"Error communicating with AI assistant: {str(e)}",
            "citations": [],
        }

    answerable = bool(raw_res.get("answerable", False))
    answer = raw_res.get("answer", "")
    citations_raw = raw_res.get("citations", [])

    if not answerable:
        return {
            "answerable": False,
            "answer": "Mujhe meetings mein iska jawab nahi mila.",
            "citations": [],
        }

    # Verify citations code-side against actual transcripts
    surviving_citations = []
    for cit in citations_raw:
        m_id = cit.get("meeting_id")
        quote = (cit.get("quote") or "").strip()
        if not m_id or not quote:
            continue

        transcript = transcripts_by_id.get(m_id, "")
        if not transcript:
            continue

        q_start, q_end, matched_quote, multiplier, matched = find_quote_span(transcript, quote)
        if matched and multiplier >= 0.7:
            surviving_citations.append({
                "meeting_id": m_id,
                "quote": matched_quote or quote,
                "speaker": cit.get("speaker"),
            })

    # If model claimed answerable=true but 0 citations survived, append note
    if not surviving_citations and citations_raw:
        answer = answer.strip() + " (could not verify the source line)"
    elif not surviving_citations and not citations_raw:
        # If no citations were even provided for factual response
        answer = answer.strip()

    return {
        "answerable": True,
        "answer": answer,
        "citations": surviving_citations,
    }
