import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models import Meeting, Decision, Task, Conflict
from backend.services.time_service import set_simulated_today
from backend.services.dashboard import get_dashboard_data


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_dashboard_kpis_and_simulated_today(db_session):
    set_simulated_today(db_session, "2026-12-10")

    m1 = Meeting(title="Meeting 1", meeting_date="2026-12-01", transcript="m1")
    m2 = Meeting(title="Meeting 2", meeting_date="2026-12-08", transcript="m2")
    db_session.add_all([m1, m2])
    db_session.flush()

    # Decisions: 1 active, 1 superseded
    d1 = Decision(meeting_id=m1.id, topic="pricing", value="Rs 499", text="Old", status="superseded", evidence_quote="quote 1")
    d2 = Decision(meeting_id=m2.id, topic="pricing", value="Rs 599", text="New", status="active", evidence_quote="quote 2")
    db_session.add_all([d1, d2])

    # Tasks:
    # t1: Overdue (deadline 2026-12-05 < 2026-12-10)
    t1 = Task(meeting_id=m1.id, title="Overdue task", owner="Amit", deadline="2026-12-05", status="pending", evidence_quote="evidence")
    # t2: Due in next 7 days (deadline 2026-12-14: 4 days away)
    t2 = Task(meeting_id=m2.id, title="Due soon task", owner="Priya", deadline="2026-12-14", status="pending", evidence_quote="evidence")
    # t3: Done task (was due 2026-12-04)
    t3 = Task(meeting_id=m1.id, title="Finished task", owner="Amit", deadline="2026-12-04", status="done", evidence_quote="evidence")
    # t4: Far future task (deadline 2026-12-28: 18 days away)
    t4 = Task(meeting_id=m2.id, title="Far task", owner="Karan", deadline="2026-12-28", status="pending", evidence_quote="evidence")
    # t5: Clarification task
    t5 = Task(meeting_id=m2.id, title="Unassigned task", owner=None, deadline=None, needs_clarification=True, status="pending", evidence_quote="evidence")

    db_session.add_all([t1, t2, t3, t4, t5])
    db_session.commit()

    data = get_dashboard_data(db_session)

    assert data["today"] == "2026-12-10"
    kpis = data["kpis"]
    assert kpis["meetings_count"] == 2
    assert kpis["active_decisions_count"] == 1
    assert kpis["total_tasks"] == 5
    assert kpis["pending_tasks"] == 4
    assert kpis["done_tasks"] == 1
    assert kpis["overdue_tasks"] == 1
    assert kpis["due_next_7_days"] == 1
    assert kpis["clarification_count"] == 1
    assert kpis["completion_rate"] == 20.0

    # Decision chains
    chains = data["decision_chains"]
    assert len(chains) == 1
    assert chains[0]["topic"] == "pricing"
    assert len(chains[0]["chain"]) == 2
    assert chains[0]["chain"][0]["value"] == "Rs 499"
    assert chains[0]["chain"][1]["value"] == "Rs 599"


def test_dashboard_workload_overload(db_session):
    set_simulated_today(db_session, "2026-12-20")

    m = Meeting(title="Sprint", meeting_date="2026-12-20", transcript="transcript")
    db_session.add(m)
    db_session.flush()

    # Priya has 4 tasks due between 21 Dec and 26 Dec (all <= 7 days from 20 Dec)
    # This exceeds WORKLOAD_THRESHOLD (3) -> is_overloaded=True
    tasks = [
        Task(meeting_id=m.id, title="T1", owner="Priya", deadline="2026-12-22", status="pending", evidence_quote="ev"),
        Task(meeting_id=m.id, title="T2", owner="Priya", deadline="2026-12-23", status="pending", evidence_quote="ev"),
        Task(meeting_id=m.id, title="T3", owner="Priya", deadline="2026-12-24", status="pending", evidence_quote="ev"),
        Task(meeting_id=m.id, title="T4", owner="Priya", deadline="2026-12-25", status="pending", evidence_quote="ev"),
        Task(meeting_id=m.id, title="T5", owner="Amit", deadline="2026-12-22", status="pending", evidence_quote="ev"),
    ]
    db_session.add_all(tasks)
    db_session.commit()

    data = get_dashboard_data(db_session)
    workload = {w["owner"]: w for w in data["workload"]}

    assert workload["Priya"]["due_next_7_days"] == 4
    assert workload["Priya"]["is_overloaded"] is True

    assert workload["Amit"]["due_next_7_days"] == 1
    assert workload["Amit"]["is_overloaded"] is False
