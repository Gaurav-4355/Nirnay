import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db import Base
from backend.models import Meeting, Decision, Task
from backend.schemas import ProposalDecision, ProposalTask, ProposalTaskUpdate
from backend.services.conflicts import detect_conflicts


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_meeting_2_pricing_conflict(db_session):
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
        topic="pricing",
        text="Pricing is fixed at Rs 499/month for pro plan",
        value="Rs 499/month",
        evidence_quote="Pricing is fixed at Rs 499/month for pro plan.",
        confidence=0.95,
        status="active",
    )
    db_session.add(d1)
    db_session.commit()

    # Meeting 2 proposes pricing change to Rs 599/month
    prop_decisions = [
        ProposalDecision(
            topic="pricing",
            text="Revised pricing to Rs 599/month for the pro tier",
            value="Rs 599/month",
            evidence_quote="New pricing will be Rs 599/month for the pro tier instead of earlier Rs 499.",
            confidence=0.95,
            status="active",
        )
    ]

    conflicts = detect_conflicts(
        db=db_session,
        decisions=prop_decisions,
        tasks=[],
        task_updates=[],
    )

    decision_conflicts = [c for c in conflicts if c.type == "decision_conflict"]
    assert len(decision_conflicts) == 1
    dc = decision_conflicts[0]
    assert dc.old_value == "Rs 499/month"
    assert dc.new_value == "Rs 599/month"
    assert "pricing" in dc.description.lower()
    assert "499" in dc.description and "599" in dc.description


def test_meeting_3_conflicts(db_session):
    # Setup Meeting 1 in DB with launch date and Amit's backend task
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
        evidence_quote="Main core REST API endpoints and database setup 20 Dec 2026 tak pura kar dunga.",
        confidence=0.95,
    )
    db_session.add(t_amit)
    db_session.commit()

    # In Meeting 3:
    # 1. Launch date proposed as 5 Feb 2027 (conflicts with 15 Jan 2027)
    prop_decisions = [
        ProposalDecision(
            topic="launch_date",
            text="Launch date postponed to 5 Feb 2027",
            value="5 Feb 2027",
            evidence_quote="Launch date is officially postponed to 5 Feb 2027.",
            confidence=0.95,
            status="active",
        )
    ]

    # 2. Amit's backend deadline is moved from 2026-12-20 to 2026-12-28 via a task_update
    task_updates = [
        ProposalTaskUpdate(
            task_id=t_amit.id,
            task_title=t_amit.title,
            owner="Amit",
            old_deadline="2026-12-20",
            new_deadline="2026-12-28",
            old_status="pending",
            new_status=None,
            evidence_quote="Main backend core APIs and auth integration 28 Dec 2026 tak complete kar paunga.",
            confidence=0.95,
        )
    ]

    # 3. Karan's integration testing is due 2026-12-22 and depends on Amit's backend task (due 2026-12-28)
    # 4. Priya is assigned 5 tasks between 24 Dec and 26 Dec (workload overload >= 4 in 7 days)
    prop_tasks = [
        ProposalTask(
            title="Finish end-to-end regression and integration testing",
            owner="Karan",
            deadline="2026-12-22",
            status="pending",
            evidence_quote="Mujhe end-to-end regression aur integration testing complete karni hai by 22 Dec 2026",
            confidence=0.95,
            depends_on_existing_task_id=t_amit.id,
        ),
        ProposalTask(
            title="Mobile responsive layout polish",
            owner="Priya",
            deadline="2026-12-24",
            status="pending",
            evidence_quote="mobile responsive layout polish by 24 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="User onboarding walkthrough illustrations",
            owner="Priya",
            deadline="2026-12-25",
            status="pending",
            evidence_quote="onboarding walkthrough illustrations by 25 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="Social media launch cards",
            owner="Priya",
            deadline="2026-12-24",
            status="pending",
            evidence_quote="social media launch cards by 24 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="Email newsletter templates",
            owner="Priya",
            deadline="2026-12-26",
            status="pending",
            evidence_quote="email newsletter templates by 26 Dec 2026.",
            confidence=0.95,
        ),
        ProposalTask(
            title="In-app iconography refresh",
            owner="Priya",
            deadline="2026-12-25",
            status="pending",
            evidence_quote="in-app iconography refresh for dark mode by 25 Dec 2026.",
            confidence=0.95,
        ),
    ]

    conflicts = detect_conflicts(
        db=db_session,
        decisions=prop_decisions,
        tasks=prop_tasks,
        task_updates=task_updates,
    )

    # 1. Assert launch_date decision conflict
    dec_conflicts = [c for c in conflicts if c.type == "decision_conflict"]
    assert len(dec_conflicts) == 1
    assert dec_conflicts[0].old_value == "15 Jan 2027"
    assert dec_conflicts[0].new_value == "5 Feb 2027"

    # 2. Assert dependency conflict between Karan and Amit
    dep_conflicts = [c for c in conflicts if c.type == "dependency_conflict"]
    assert len(dep_conflicts) == 1
    assert "Karan" in dep_conflicts[0].description
    assert "Amit" in dep_conflicts[0].description
    assert "2026-12-22" in dep_conflicts[0].description
    assert "2026-12-28" in dep_conflicts[0].description

    # 3. Assert workload overload for Priya
    workload_conflicts = [c for c in conflicts if c.type == "workload_overload"]
    assert len(workload_conflicts) == 1
    assert "Priya" in workload_conflicts[0].title
    assert len(workload_conflicts[0].related_titles) == 5
