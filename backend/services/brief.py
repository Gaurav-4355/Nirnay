import json
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..models import Meeting, Decision, Task, Conflict
from ..llm import call_groq_json
from .time_service import get_today


AGENDA_PROMPT = """You are Nirnay, an executive meeting preparation agent.
Based ONLY on the provided meeting brief data (blocked tasks, overdue tasks, active decisions, dependencies, and conflicts), generate 3 to 5 sharp, constructive agenda discussion questions for the upcoming sync.

CRITICAL RULES:
- Ground questions ONLY in the provided deliverables and people.
- Address specific owners constructively (e.g. "Amit, payment gateway is blocked on KYC — what assistance is needed from Rahul or the vendor?").
- Return strict JSON:
{
  "agenda_suggestions": [
    "Question 1",
    "Question 2",
    "Question 3"
  ]
}
"""


def generate_meeting_brief(db: Session, include_agenda_ai: bool = True) -> Dict[str, Any]:
    today: date = get_today(db)
    today_str: str = today.strftime("%Y-%m-%d")

    # 1. Last meeting
    last_meeting_obj = db.query(Meeting).order_by(Meeting.meeting_date.desc(), Meeting.id.desc()).first()
    last_meeting = {
        "id": last_meeting_obj.id,
        "title": last_meeting_obj.title,
        "meeting_date": last_meeting_obj.meeting_date,
    } if last_meeting_obj else None

    # 2. Decisions (Active vs Superseded)
    all_decisions = db.query(Decision, Meeting).join(Meeting, Decision.meeting_id == Meeting.id).all()
    active_decisions = []
    superseded_decisions = []

    for d, m in all_decisions:
        item = {
            "id": d.id,
            "topic": d.topic,
            "value": d.value,
            "text": d.text,
            "meeting_title": m.title,
            "meeting_date": m.meeting_date,
        }
        if d.status == "active":
            active_decisions.append(item)
        else:
            rep = db.query(Decision, Meeting).join(Meeting, Decision.meeting_id == Meeting.id).filter(Decision.id == d.superseded_by_id).first() if d.superseded_by_id else None
            item["superseded_by_value"] = rep[0].value if rep else None
            item["superseded_by_meeting"] = rep[1].title if rep else None
            superseded_decisions.append(item)

    # 3. Tasks
    all_tasks = db.query(Task, Meeting).join(Meeting, Task.meeting_id == Meeting.id).all()
    open_tasks_by_owner: Dict[str, List[Dict[str, Any]]] = {}
    overdue_tasks = []
    blocked_tasks = []
    clarification_tasks = []
    dependencies_at_risk = []

    tasks_by_id = {t.id: t for t, m in all_tasks}

    for t, m in all_tasks:
        if t.status == "done":
            continue

        owner_name = t.owner or "Unassigned"
        task_dict = {
            "id": t.id,
            "title": t.title,
            "owner": owner_name,
            "deadline": t.deadline,
            "status": t.status,
            "needs_clarification": t.needs_clarification,
            "clarification_question": t.clarification_question,
            "meeting_title": m.title,
            "depends_on_title": t.depends_on_task.title if t.depends_on_task else None,
        }

        if owner_name not in open_tasks_by_owner:
            open_tasks_by_owner[owner_name] = []
        open_tasks_by_owner[owner_name].append(task_dict)

        # Check blocked
        if t.status == "blocked":
            blocked_tasks.append(task_dict)

        # Check clarification
        if t.needs_clarification or not t.owner or not t.deadline:
            clarification_tasks.append(task_dict)

        # Check overdue
        if t.deadline:
            try:
                td = datetime.strptime(t.deadline.strip(), "%Y-%m-%d").date()
                if td < today:
                    task_dict["days_overdue"] = (today - td).days
                    overdue_tasks.append(task_dict)
            except ValueError:
                pass

        # Check dependencies at risk
        if t.depends_on_task_id:
            dep_task = tasks_by_id.get(t.depends_on_task_id)
            if dep_task:
                dep_risk = False
                reason = ""
                if dep_task.status == "blocked":
                    dep_risk = True
                    reason = f"Prerequisite '{dep_task.title}' is blocked"
                elif dep_task.deadline:
                    try:
                        dep_d = datetime.strptime(dep_task.deadline.strip(), "%Y-%m-%d").date()
                        if dep_d < today and dep_task.status != "done":
                            dep_risk = True
                            reason = f"Prerequisite '{dep_task.title}' is overdue ({dep_task.deadline})"
                        elif t.deadline:
                            my_d = datetime.strptime(t.deadline.strip(), "%Y-%m-%d").date()
                            if my_d < dep_d:
                                dep_risk = True
                                reason = f"Due {t.deadline} before prerequisite '{dep_task.title}' ({dep_task.deadline})"
                    except ValueError:
                        pass

                if dep_risk:
                    dependencies_at_risk.append({
                        **task_dict,
                        "risk_reason": reason,
                    })

    # 4. Conflicts
    conflicts_query = db.query(Conflict, Meeting).join(Meeting, Conflict.meeting_id == Meeting.id).all()
    recent_conflicts = [
        {
            "id": c.id,
            "type": c.type,
            "title": c.title,
            "description": c.description,
            "resolution": c.resolution,
            "meeting_title": m.title,
            "meeting_date": m.meeting_date,
        }
        for c, m in conflicts_query
    ]

    # 5. Optional Agenda Suggestions via Groq
    agenda_suggestions = []
    if include_agenda_ai:
        try:
            brief_summary_for_ai = {
                "blocked": [t["title"] for t in blocked_tasks],
                "overdue": [f"{t['title']} ({t['owner']}, due {t['deadline']})" for t in overdue_tasks],
                "dependencies_at_risk": [f"{t['title']}: {t.get('risk_reason')}" for t in dependencies_at_risk],
                "conflicts": [c["title"] for c in recent_conflicts if not c.get("resolution")],
                "active_decisions": [f"{d['topic']}: {d['value']}" for d in active_decisions[:5]],
            }
            raw, _ = call_groq_json(
                AGENDA_PROMPT,
                f"Data for upcoming meeting preparation on {today_str}:\n{json.dumps(brief_summary_for_ai, indent=2)}"
            )
            agenda_suggestions = raw.get("agenda_suggestions", [])
        except Exception:
            agenda_suggestions = []

    return {
        "today": today_str,
        "last_meeting": last_meeting,
        "active_decisions": active_decisions,
        "superseded_decisions": superseded_decisions,
        "open_tasks_by_owner": open_tasks_by_owner,
        "overdue_tasks": overdue_tasks,
        "blocked_tasks": blocked_tasks,
        "clarification_tasks": clarification_tasks,
        "dependencies_at_risk": dependencies_at_risk,
        "recent_conflicts": recent_conflicts,
        "agenda_suggestions": agenda_suggestions,
    }
