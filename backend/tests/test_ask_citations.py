import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models import Meeting
from backend.services.ask_nirnay import answer_nirnay_question


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_ask_nirnay_unanswerable_fixed_message(db_session):
    m = Meeting(
        title="Meeting 1",
        meeting_date="2026-12-01",
        transcript="Rahul: We decided pricing is Rs 499.",
    )
    db_session.add(m)
    db_session.commit()

    # Mock LLM returning answerable=false
    mock_llm_res = {
        "answerable": False,
        "answer": "Not found",
        "citations": [],
    }

    with patch("backend.services.ask_nirnay.call_groq_json", return_value=(mock_llm_res, False)):
        res = answer_nirnay_question(db_session, "What is our office address?")
        assert res["answerable"] is False
        assert res["answer"] == "Mujhe meetings mein iska jawab nahi mila."
        assert len(res["citations"]) == 0


def test_ask_nirnay_drops_hallucinated_citations(db_session):
    m = Meeting(
        title="Meeting 1",
        meeting_date="2026-12-01",
        transcript="Rahul: Product launch date is 15 Jan 2027.",
    )
    db_session.add(m)
    db_session.commit()

    # LLM returns two citations: one genuine, one fabricated/hallucinated
    mock_llm_res = {
        "answerable": True,
        "answer": "Launch date 15 Jan 2027 hai.",
        "citations": [
            {
                "meeting_id": m.id,
                "quote": "Product launch date is 15 Jan 2027.",
            },
            {
                "meeting_id": m.id,
                "quote": "This sentence was never said in the meeting ever.",
            },
        ],
    }

    with patch("backend.services.ask_nirnay.call_groq_json", return_value=(mock_llm_res, False)):
        res = answer_nirnay_question(db_session, "Launch date kab hai?")
        assert res["answerable"] is True
        # Only the genuine citation survived
        assert len(res["citations"]) == 1
        assert "15 Jan 2027" in res["citations"][0]["quote"]


def test_ask_nirnay_unverified_source_line_note(db_session):
    m = Meeting(
        title="Meeting 1",
        meeting_date="2026-12-01",
        transcript="Rahul: Pricing is Rs 499.",
    )
    db_session.add(m)
    db_session.commit()

    # LLM returns answerable=True but with completely fake quote
    mock_llm_res = {
        "answerable": True,
        "answer": "Pricing Rs 499 hai.",
        "citations": [
            {
                "meeting_id": m.id,
                "quote": "Fake quote totally absent from transcript",
            }
        ],
    }

    with patch("backend.services.ask_nirnay.call_groq_json", return_value=(mock_llm_res, False)):
        res = answer_nirnay_question(db_session, "Pricing kya hai?")
        assert res["answerable"] is True
        assert len(res["citations"]) == 0
        assert "(could not verify the source line)" in res["answer"]
