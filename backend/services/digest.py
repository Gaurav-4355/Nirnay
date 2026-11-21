import json
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from ..models import Task, Decision, Meeting, Conflict, OutboxItem
from ..llm import call_groq_json
from .time_service import get_today


DIGEST_SYSTEM_PROMPT = """You are Nirnay, an intelligent execution assistant that writes concise, encouraging weekly digests for team members.
Your goal is to summarize each person's workload and priority focus for the coming week.

CRITICAL RULES:
1. Tone: Friendly, professional, simple Hinglish (e.g. "Aapka focus is hafte landing page polish aur assets finalize karne pe hona chahiye.").
2. STRICT ACCURACY: Use ONLY the exact tasks, decisions, and blockers provided in the prompt. NEVER invent tasks, deadlines, decisions, or people that are not explicitly provided.
3. Return strict JSON matching this exact structure:
{
  "digests": [
    {
      "owner": "<Exact person name>",
      "summary": "<2-3 friendly sentences in simple Hinglish summarizing their week>",
      "highlights": ["<Key highlight 1>", "<Key highlight 2>"]
    }
  ]
}
"""


def generate_weekly_digests(db: Session, force_template: bool = False) -> Dict[str, Any]:
    """
    Collects per-person tasks, decisions, and conflicts, generates weekly digests
    (via 1 Groq call with safe fallback), and queues them as outbox items.
    """
    today: date = get_today(db)
    # Calculate Monday of current week
    week_start: date = today - timedelta(days=today.weekday())
    week_start_str: str = week_start.strftime("%Y-%m-%d")

    # 1. Gather all tasks and group by owner
    all_tasks = db.query(Task).all()
    all_conflicts = db.query(Conflict).all()
    active_decisions = db.query(Decision).filter(Decision.status == "active").all()

    # Pre-index meetings
    meetings_by_id = {m.id: m for m in db.query(Meeting).all()}

    # Group by owner
    people_data: Dict[str, Dict[str, Any]] = {}
    for t in all_tasks:
        if not t.owner or not t.owner.strip():
            continue
        owner = t.owner.strip()
        if owner not in people_data:
            people_data[owner] = {
                "owner": owner,
                "due_next_7_days": [],
                "overdue": [],
                "blocked": [],
                "waiting": [],
                "done": [],
            }

        # Check status and dates
        if t.status == "done":
            people_data[owner]["done"].append(t)
        elif t.status == "blocked":
            people_data[owner]["blocked"].append(t)
        else:
            if t.deadline:
                try:
                    td = datetime.strptime(t.deadline.strip(), "%Y-%m-%d").date()
                    if td < today:
                        people_data[owner]["overdue"].append(t)
                    elif 0 <= (td - today).days <= 7:
                        people_data[owner]["due_next_7_days"].append(t)
                except ValueError:
                    pass

        if t.depends_on_task_id and t.status != "done":
            people_data[owner]["waiting"].append(t)

    if not people_data:
        return {"week_start": week_start_str, "digests_count": 0, "digests": []}

    # 2. Build LLM payload
    owners_prompt_input = []
    for owner, data in people_data.items():
        # Match conflicts involving this owner
        owner_conflicts = [
            c.title for c in all_conflicts
            if owner.lower() in c.title.lower() or owner.lower() in c.description.lower()
        ]

        owners_prompt_input.append({
            "owner": owner,
            "tasks_due_next_7_days": [t.title for t in data["due_next_7_days"]],
            "overdue_tasks": [t.title for t in data["overdue"]],
            "blocked_tasks": [t.title for t in data["blocked"]],
            "waiting_on_prerequisites": [t.title for t in data["waiting"]],
            "relevant_conflicts": owner_conflicts,
        })

    user_prompt = f"""Current Date: {today.strftime('%Y-%m-%d')}
Week Starting: {week_start_str}

Team Members Workload Data:
{json.dumps(owners_prompt_input, indent=2)}

Active Organization Decisions:
{json.dumps([f"{d.topic}: {d.value}" for d in active_decisions], indent=2)}

Generate a friendly weekly digest summary for each team member using ONLY this data."""

    # 3. Call LLM (or fallback)
    llm_summaries: Dict[str, Dict[str, Any]] = {}
    is_template = force_template

    if not force_template:
        try:
            raw_response, _ = call_groq_json(DIGEST_SYSTEM_PROMPT, user_prompt)
            for d in raw_response.get("digests", []):
                own = d.get("owner", "").strip()
                if own in people_data:
                    llm_summaries[own] = {
                        "summary": d.get("summary", ""),
                        "highlights": d.get("highlights", []),
                    }
        except Exception as e:
            is_template = True

    # 4. Create or update Outbox Items with CODE-RENDERED task bullets
    outbox_results = []
    for owner, data in people_data.items():
        summary_info = llm_summaries.get(owner)
        if summary_info and summary_info.get("summary"):
            summary_text = summary_info["summary"]
        else:
            is_template = True
            summary_text = (
                f"Namaste {owner}! Yeh hai aapka weekly execution digest for week of {week_start_str}. "
                f"Aapke paas {len(data['due_next_7_days'])} upcoming deliverables hain aur {len(data['overdue'])} overdue items."
            )

        # Code-rendered task bullet list
        bullet_lines = []
        if data["due_next_7_days"]:
            bullet_lines.append("\n📅 **Upcoming Deadlines (Next 7 Days):**")
            for t in data["due_next_7_days"]:
                bullet_lines.append(f"  • {t.title} — due {t.deadline}")

        if data["overdue"]:
            bullet_lines.append("\n⚠️ **Overdue Deliverables:**")
            for t in data["overdue"]:
                bullet_lines.append(f"  • {t.title} — was due {t.deadline}")

        if data["blocked"]:
            bullet_lines.append("\n⛔ **Blocked Deliverables:**")
            for t in data["blocked"]:
                bullet_lines.append(f"  • {t.title} (needs attention)")

        if data["waiting"]:
            bullet_lines.append("\n🔗 **Waiting on Dependencies:**")
            for t in data["waiting"]:
                dep_name = t.depends_on_task.title if t.depends_on_task else "prerequisite"
                bullet_lines.append(f"  • {t.title} (waits for '{dep_name}')")

        if not (data["due_next_7_days"] or data["overdue"] or data["blocked"] or data["waiting"]):
            bullet_lines.append("\n🎉 All commitments currently up to date! Great job.")

        full_body = summary_text + "\n" + "\n".join(bullet_lines)

        dedupe_key = f"digest:{owner.lower()}:{week_start_str}"
        title = f"Weekly Digest: {owner} (Week of {week_start_str})"

        # Check existing outbox item
        existing_item = db.query(OutboxItem).filter(OutboxItem.dedupe_key == dedupe_key).first()
        if existing_item:
            existing_item.title = title
            existing_item.body = full_body
            existing_item.error = "template digest" if is_template else None
            item = existing_item
        else:
            item = OutboxItem(
                kind="digest",
                target="webhook",
                recipient=owner,
                title=title,
                body=full_body,
                dedupe_key=dedupe_key,
                status="pending",
                error="template digest" if is_template else None,
            )
            db.add(item)

        outbox_results.append({
            "owner": owner,
            "title": title,
            "summary": summary_text,
            "body": full_body,
            "dedupe_key": dedupe_key,
            "mode": "template" if is_template else "ai",
        })

    db.commit()
    return {
        "week_start": week_start_str,
        "mode": "template" if is_template else "ai",
        "digests_count": len(outbox_results),
        "digests": outbox_results,
    }
