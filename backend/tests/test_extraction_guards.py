import json
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models import Meeting, Decision, Task
from backend.schemas import ProposalDecision, ProposalTask, ProposalTaskUpdate
from backend.services.meeting_service import (
    extract_transcript_speakers,
    check_owner_guard,
    apply_duplicate_guard,
)
from backend.services.conflicts import detect_conflicts


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_extract_transcript_speakers():
    transcript = """
    Rahul: Welcome everyone to the sprint planning.
    Amit: Database setup is ready.
    Karan: QA environment needs verification.
    Priya: I will take design polish.
    Sneha: Marketing campaign is on track.
    """
    speakers = extract_transcript_speakers(transcript)
    assert "rahul" in speakers
    assert "amit" in speakers
    assert "karan" in speakers
    assert "priya" in speakers
    assert "sneha" in speakers
    assert "vikram" not in speakers


def test_owner_guard_real_vs_invented():
    speakers = {"rahul", "amit", "priya", "karan", "sneha"}

    # 1. Real speaker (case-insensitive) stays owner
    owner, needs_clar, clar_q = check_owner_guard("Amit", "Backend APIs", speakers)
    assert owner == "Amit"
    assert needs_clar is False
    assert clar_q is None

    # 2. Invented owner (not in transcript speakers) becomes None with clarification
    owner, needs_clar, clar_q = check_owner_guard("Vikram", "Setup server", speakers)
    assert owner is None
    assert needs_clar is True
    assert "Who will take ownership" in clar_q
    assert "Vikram" in clar_q

    # 3. None or unassigned stays None with clarification
    owner, needs_clar, clar_q = check_owner_guard(None, "Event tracking", speakers)
    assert owner is None
    assert needs_clar is True
    assert "Who will take ownership" in clar_q

    owner2, needs_clar2, clar_q2 = check_owner_guard("unassigned", "Event tracking", speakers)
    assert owner2 is None
    assert needs_clar2 is True


def test_duplicate_guard():
    # An existing task update for Amit's backend task with new deadline 2026-12-28
    task_updates = [
        ProposalTaskUpdate(
            task_id=5,
            task_title="Complete backend REST API endpoints and database setup",
            owner="Amit",
            old_status="pending",
            new_status=None,
            old_deadline="2026-12-20",
            new_deadline="2026-12-28",
            evidence_quote="Main core REST API endpoints aur database setup ki deadline 20 Dec se badhakar 28 Dec 2026 kar raha hoon",
            confidence=0.95,
        )
    ]

    # Model outputs a duplicate new task for Amit + a valid new task for Priya
    # + a task for Karan depending on Amit's task (new_task_index 0)
    tasks = [
        ProposalTask(
            title="Backend core REST APIs and database setup",
            owner="Amit",
            deadline="2026-12-28",
            evidence_quote="Main core REST API endpoints aur database setup...",
            confidence=0.95,
        ),
        ProposalTask(
            title="Mobile responsive polish",
            owner="Priya",
            deadline="2026-12-24",
            evidence_quote="mobile responsive...",
            confidence=0.9,
        ),
        ProposalTask(
            title="Integration testing",
            owner="Karan",
            deadline="2026-12-22",
            evidence_quote="integration testing...",
            confidence=0.9,
            depends_on_new_task_index=0,  # depends on Amit's duplicate task
        ),
    ]

    filtered = apply_duplicate_guard(tasks, task_updates)

    # The duplicate task (Amit) should be dropped
    assert len(filtered) == 2
    titles = [t.title for t in filtered]
    assert "Backend core REST APIs and database setup" not in titles
    assert "Mobile responsive polish" in titles
    assert "Integration testing" in titles

    # Karan's task should now be remapped to depend on the existing task (id=5)
    karan_task = next(t for t in filtered if t.owner == "Karan")
    assert karan_task.depends_on_existing_task_id == 5
    assert karan_task.depends_on_title == "Complete backend REST API endpoints and database setup"
    assert karan_task.depends_on_new_task_index is None


def test_ground_truth_quotes_are_verbatim_substrings():
    gt_path = Path(__file__).parent.parent / "seed" / "ground_truth.json"
    assert gt_path.exists(), "ground_truth.json not found"
    gt_data = json.loads(gt_path.read_text(encoding="utf-8"))

    for m in gt_data["meetings"]:
        mid = m["meeting_id"]
        t_path = Path(__file__).parent.parent / "seed" / f"meeting_{mid}.txt"
        assert t_path.exists(), f"meeting_{mid}.txt not found"
        transcript = t_path.read_text(encoding="utf-8")

        for d in m.get("expected_decisions", []):
            eq = d["evidence_quote"]
            assert eq in transcript, f"Meeting {mid} decision quote not in transcript: {eq}"

        for t in m.get("expected_tasks", []):
            eq = t["evidence_quote"]
            assert eq in transcript, f"Meeting {mid} task quote not in transcript: {eq}"

        for tu in m.get("expected_task_updates", []):
            eq = tu["evidence_quote"]
            assert eq in transcript, f"Meeting {mid} task_update quote not in transcript: {eq}"


def test_meeting_3_dependency_conflict_and_resolution(db_session):
    # Setup Meeting 1 in DB
    m1 = Meeting(
        title="Meeting 1: Launch Timeline & Core Milestones",
        meeting_date="2026-12-01",
        transcript="...",
    )
    db_session.add(m1)
    db_session.flush()

    d1 = Decision(
        meeting_id=m1.id,
        topic="launch_date",
        text="Product launch date is set to 15 Jan 2027",
        value="15 Jan 2027",
        evidence_quote="Product launch date is 15 Jan 2027.",
        confidence=0.95,
        status="active",
    )
    db_session.add(d1)

    t_amit = Task(
        meeting_id=m1.id,
        title="Complete backend REST API endpoints and database setup",
        owner="Amit",
        deadline="2026-12-20",
        status="pending",
        evidence_quote="main core REST API endpoints and database setup 20 Dec 2026 tak pura kar dunga.",
        confidence=0.95,
    )
    db_session.add(t_amit)
    db_session.commit()

    # In Meeting 3:
    # 1. Decision launch_date moves to 5 Feb 2027
    decisions = [
        ProposalDecision(
            topic="launch_date",
            text="Launch date postponed to 5 Feb 2027",
            value="5 Feb 2027",
            evidence_quote="Launch date is officially postponed to 5 Feb 2027.",
            confidence=0.95,
            status="active",
        )
    ]

    # 2. Task update for Amit: deadline slips from 20 Dec to 28 Dec 2026
    task_updates = [
        ProposalTaskUpdate(
            task_id=t_amit.id,
            task_title=t_amit.title,
            owner=t_amit.owner,
            old_status="pending",
            new_status=None,
            old_deadline="2026-12-20",
            new_deadline="2026-12-28",
            evidence_quote="Main core REST API endpoints aur database setup ki deadline 20 Dec se badhakar 28 Dec 2026 kar raha hoon, tak complete kar paunga.",
            confidence=0.95,
        )
    ]

    # 3. Karan's task due 2026-12-22 depends on Amit's task
    # Plus Priya's 5 deliverables (causing workload overload)
    tasks = [
        ProposalTask(
            title="Finish end-to-end regression and integration testing",
            owner="Karan",
            deadline="2026-12-22",
            evidence_quote="Mujhe end-to-end regression aur integration testing 22 Dec 2026 tak complete karni hai, ye Amit ke backend APIs par depend karti hai.",
            confidence=0.95,
            depends_on_existing_task_id=t_amit.id,
            depends_on_title=t_amit.title,
        ),
        ProposalTask(
            title="Mobile responsive layout polish",
            owner="Priya",
            deadline="2026-12-24",
            evidence_quote="mobile responsive layout polish by 24 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="User onboarding walkthrough illustrations",
            owner="Priya",
            deadline="2026-12-25",
            evidence_quote="onboarding walkthrough illustrations by 25 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="Social media launch cards for Sneha's campaign",
            owner="Priya",
            deadline="2026-12-24",
            evidence_quote="social media launch cards by 24 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="Email newsletter templates for transactional emails",
            owner="Priya",
            deadline="2026-12-26",
            evidence_quote="email newsletter templates by 26 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="In-app iconography refresh for dark mode",
            owner="Priya",
            deadline="2026-12-25",
            evidence_quote="in-app iconography refresh for dark mode by 25 Dec 2026.",
            confidence=0.95,
        ),
    ]

    conflicts = detect_conflicts(
        db=db_session,
        decisions=decisions,
        tasks=tasks,
        task_updates=task_updates,
    )

    types = [c.type for c in conflicts]
    assert "decision_conflict" in types
    assert "dependency_conflict" in types
    assert "workload_overload" in types

    # Check dependency conflict details
    dep_conflict = next(c for c in conflicts if c.type == "dependency_conflict")
    assert "Karan" in dep_conflict.description
    assert "2026-12-22" in dep_conflict.description
    assert "2026-12-28" in dep_conflict.description
