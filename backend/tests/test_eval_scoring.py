import pytest
from backend.services.eval_scoring import (
    score_decisions,
    score_tasks,
    score_task_updates,
    score_conflicts,
    compute_clarification_handling,
    normalize_val,
)


def test_normalize_val():
    assert normalize_val("Rs 499/month") == "499"
    assert normalize_val("Rs. 599 / mo") == "599"
    assert normalize_val("15 Jan 2027") == "15 jan 2027"


def test_perfect_scoring_run():
    exp_tasks = [
        {"title": "Build backend", "owner": "Amit", "deadline": "2026-12-20"},
        {"title": "Design landing page", "owner": "Priya", "deadline": "2026-12-05"},
    ]
    found_tasks = [
        {"title": "Build backend", "owner": "Amit", "deadline": "2026-12-20"},
        {"title": "Design landing page", "owner": "Priya", "deadline": "2026-12-05"},
    ]
    res = score_tasks(exp_tasks, found_tasks)
    assert res["expected"] == 2
    assert res["found"] == 2
    assert res["correct"] == 2
    assert res["precision"] == 1.0
    assert res["recall"] == 1.0
    assert len(res["missed"]) == 0
    assert len(res["extra"]) == 0


def test_missed_task():
    exp_tasks = [
        {"title": "Build backend", "owner": "Amit", "deadline": "2026-12-20"},
        {"title": "Design landing page", "owner": "Priya", "deadline": "2026-12-05"},
    ]
    found_tasks = [
        {"title": "Build backend", "owner": "Amit", "deadline": "2026-12-20"},
    ]
    res = score_tasks(exp_tasks, found_tasks)
    assert res["expected"] == 2
    assert res["found"] == 1
    assert res["correct"] == 1
    assert res["precision"] == 1.0
    assert res["recall"] == 0.5
    assert len(res["missed"]) == 1
    assert res["missed"][0]["title"] == "Design landing page"


def test_extra_task():
    exp_tasks = [
        {"title": "Build backend", "owner": "Amit", "deadline": "2026-12-20"},
    ]
    found_tasks = [
        {"title": "Build backend", "owner": "Amit", "deadline": "2026-12-20"},
        {"title": "Unwanted extra task", "owner": "Rahul", "deadline": "2026-12-22"},
    ]
    res = score_tasks(exp_tasks, found_tasks)
    assert res["expected"] == 1
    assert res["found"] == 2
    assert res["correct"] == 1
    assert res["precision"] == 0.5
    assert res["recall"] == 1.0
    assert len(res["extra"]) == 1
    assert res["extra"][0]["title"] == "Unwanted extra task"


def test_title_similarity_alone_must_not_match_different_owners():
    # If the title is identical but the owner is different, it must NOT match!
    exp_tasks = [
        {"title": "Deliver finalized landing page designs and copy review", "owner": "Priya", "deadline": "2026-12-05"},
    ]
    found_tasks = [
        {"title": "Deliver finalized landing page designs and copy review", "owner": "Amit", "deadline": "2026-12-05"},
    ]
    res = score_tasks(exp_tasks, found_tasks)
    assert res["correct"] == 0
    assert res["precision"] == 0.0
    assert res["recall"] == 0.0
    assert len(res["missed"]) == 1
    assert len(res["extra"]) == 1


def test_clarification_handling_no_guessing():
    exp_tasks = [
        {"title": "Set up PostHog analytics", "owner": None, "deadline": None, "needs_clarification": True},
    ]
    # Model correctly left owner as None and flagged needs_clarification
    found_good = [
        {"title": "Set up PostHog event tracking and analytics", "owner": None, "needs_clarification": True},
    ]
    score_good = compute_clarification_handling(exp_tasks, found_good)
    assert score_good == 100.0

    # Model guessed an owner (e.g. Rahul)
    found_bad = [
        {"title": "Set up PostHog event tracking and analytics", "owner": "Rahul", "needs_clarification": False},
    ]
    score_bad = compute_clarification_handling(exp_tasks, found_bad)
    assert score_bad == 0.0
