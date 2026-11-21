import re
import difflib
from typing import Dict, Any, List, Optional, Tuple
from .quote_matcher import find_quote_span


def normalize_val(val: Optional[str]) -> str:
    """Normalizes decision values for robust semantic comparison."""
    if not val:
        return ""
    v = val.strip().lower()
    # Normalize currency representations
    v = re.sub(r"\b(rs\.?|inr|rupees)\b", "", v)
    # Normalize frequency indicators with or without slashes/spaces
    v = re.sub(r"\s*/\s*(month|mo|pm)\b", "", v)
    v = re.sub(r"\bper\s+month\b", "", v)
    v = re.sub(r"\b(month|mo|pm)\b", "", v)
    # Strip non-alphanumeric chars at edges and collapse spaces
    v = re.sub(r"[^\w\s]", "", v)
    v = re.sub(r"\s+", " ", v).strip()
    return v


def title_similarity(t1: str, t2: str) -> float:
    """Calculates fuzzy similarity ratio between two titles."""
    if not t1 or not t2:
        return 0.0
    s1 = t1.strip().lower()
    s2 = t2.strip().lower()
    return difflib.SequenceMatcher(None, s1, s2).ratio()


def score_decisions(
    expected_list: List[Dict[str, Any]],
    found_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    matched_expected = set()
    matched_found = set()
    correct = 0

    for f_idx, found in enumerate(found_list):
        f_topic = (found.get("topic") or "").strip().lower()
        f_val = normalize_val(found.get("value"))

        for e_idx, exp in enumerate(expected_list):
            if e_idx in matched_expected:
                continue
            e_topic = (exp.get("topic") or "").strip().lower()
            e_val = normalize_val(exp.get("value"))

            if f_topic == e_topic and (f_val == e_val or f_val in e_val or e_val in f_val):
                matched_expected.add(e_idx)
                matched_found.add(f_idx)
                correct += 1
                break

    expected_count = len(expected_list)
    found_count = len(found_list)
    precision = (correct / found_count) if found_count > 0 else (1.0 if expected_count == 0 else 0.0)
    recall = (correct / expected_count) if expected_count > 0 else 1.0

    missed = [exp for idx, exp in enumerate(expected_list) if idx not in matched_expected]
    extra = [f for idx, f in enumerate(found_list) if idx not in matched_found]

    return {
        "expected": expected_count,
        "found": found_count,
        "correct": correct,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "missed": missed,
        "extra": extra,
    }


def score_tasks(
    expected_list: List[Dict[str, Any]],
    found_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    matched_expected = set()
    matched_found = set()
    correct = 0

    for f_idx, found in enumerate(found_list):
        f_owner = (found.get("owner") or "").strip().lower() if found.get("owner") else None
        f_deadline = (found.get("deadline") or "").strip() if found.get("deadline") else None
        f_title = found.get("title") or ""

        best_e_idx = None
        best_sim = -1.0

        for e_idx, exp in enumerate(expected_list):
            if e_idx in matched_expected:
                continue
            e_owner = (exp.get("owner") or "").strip().lower() if exp.get("owner") else None
            e_deadline = (exp.get("deadline") or "").strip() if exp.get("deadline") else None
            e_title = exp.get("title") or ""

            # Check owner compatibility
            # RULE: Title similarity alone must NOT match two tasks that have different owners.
            if e_owner and f_owner and e_owner != f_owner:
                continue

            sim = title_similarity(f_title, e_title)

            # Condition 1: Same owner (case-insensitive) AND same deadline
            owner_match = bool(e_owner and f_owner and e_owner == f_owner)
            deadline_match = bool(e_deadline and f_deadline and e_deadline == f_deadline)

            if owner_match and deadline_match:
                best_e_idx = e_idx
                break

            # Condition 2: Expected owner/deadline is null -> fuzzy title similarity >= 0.5
            if (not e_owner or not e_deadline) and sim >= 0.5:
                # Must not conflict with owners
                if sim > best_sim:
                    best_sim = sim
                    best_e_idx = e_idx

            # Condition 3: Same owner with high title similarity >= 0.6 (even if deadline missing/slightly off)
            elif owner_match and sim >= 0.6:
                if sim > best_sim:
                    best_sim = sim
                    best_e_idx = e_idx

        if best_e_idx is not None:
            matched_expected.add(best_e_idx)
            matched_found.add(f_idx)
            correct += 1

    expected_count = len(expected_list)
    found_count = len(found_list)
    precision = (correct / found_count) if found_count > 0 else (1.0 if expected_count == 0 else 0.0)
    recall = (correct / expected_count) if expected_count > 0 else 1.0

    missed = [exp for idx, exp in enumerate(expected_list) if idx not in matched_expected]
    extra = [f for idx, f in enumerate(found_list) if idx not in matched_found]

    return {
        "expected": expected_count,
        "found": found_count,
        "correct": correct,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "missed": missed,
        "extra": extra,
    }


def score_task_updates(
    expected_list: List[Dict[str, Any]],
    found_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    matched_expected = set()
    matched_found = set()
    correct = 0

    for f_idx, found in enumerate(found_list):
        f_title = (found.get("task_title") or "").lower()
        f_status = (found.get("new_status") or "").lower() if found.get("new_status") else None
        f_deadline = (found.get("new_deadline") or "").strip() if found.get("new_deadline") else None

        for e_idx, exp in enumerate(expected_list):
            if e_idx in matched_expected:
                continue
            kw = (exp.get("title_keyword") or "").lower()
            e_status = (exp.get("new_status") or "").lower() if exp.get("new_status") else None
            e_deadline = (exp.get("new_deadline") or "").strip() if exp.get("new_deadline") else None

            # Check title target match
            title_matched = (kw in f_title) or (title_similarity(kw, f_title) >= 0.4)
            if not title_matched:
                continue

            status_matched = (e_status is None) or (f_status == e_status)
            deadline_matched = (e_deadline is None) or (f_deadline == e_deadline)

            if status_matched and deadline_matched:
                matched_expected.add(e_idx)
                matched_found.add(f_idx)
                correct += 1
                break

    expected_count = len(expected_list)
    found_count = len(found_list)
    precision = (correct / found_count) if found_count > 0 else (1.0 if expected_count == 0 else 0.0)
    recall = (correct / expected_count) if expected_count > 0 else 1.0

    missed = [exp for idx, exp in enumerate(expected_list) if idx not in matched_expected]
    extra = [f for idx, f in enumerate(found_list) if idx not in matched_found]

    return {
        "expected": expected_count,
        "found": found_count,
        "correct": correct,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "missed": missed,
        "extra": extra,
    }


def score_conflicts(
    expected_list: List[Dict[str, Any]],
    found_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    matched_expected = set()
    matched_found = set()
    correct = 0

    for f_idx, found in enumerate(found_list):
        f_type = (found.get("type") or "").strip().lower()
        f_title = (found.get("title") or "").lower()
        f_desc = (found.get("description") or "").lower()

        for e_idx, exp in enumerate(expected_list):
            if e_idx in matched_expected:
                continue
            e_type = (exp.get("type") or "").strip().lower()
            e_topic = (exp.get("topic") or "").strip().lower()
            e_owner = (exp.get("owner") or "").strip().lower()

            if f_type != e_type:
                continue

            if e_type == "decision_conflict":
                # Check topic in title or description
                if e_topic and (e_topic in f_title or e_topic in f_desc):
                    matched_expected.add(e_idx)
                    matched_found.add(f_idx)
                    correct += 1
                    break
            elif e_type == "workload_overload":
                # Check owner if specified
                if not e_owner or (e_owner in f_title or e_owner in f_desc):
                    matched_expected.add(e_idx)
                    matched_found.add(f_idx)
                    correct += 1
                    break
            elif e_type == "dependency_conflict":
                matched_expected.add(e_idx)
                matched_found.add(f_idx)
                correct += 1
                break

    expected_count = len(expected_list)
    found_count = len(found_list)
    precision = (correct / found_count) if found_count > 0 else (1.0 if expected_count == 0 else 0.0)
    recall = (correct / expected_count) if expected_count > 0 else 1.0

    missed = [exp for idx, exp in enumerate(expected_list) if idx not in matched_expected]
    extra = [f for idx, f in enumerate(found_list) if idx not in matched_found]

    return {
        "expected": expected_count,
        "found": found_count,
        "correct": correct,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "missed": missed,
        "extra": extra,
    }


def compute_evidence_quote_validity(transcript: str, items: List[Dict[str, Any]]) -> float:
    """Computes percentage of evidence quotes that matched transcript exactly."""
    if not items:
        return 100.0
    exact_matches = 0
    total = len(items)

    for item in items:
        quote = item.get("evidence_quote") or ""
        if not quote.strip():
            continue
        _, _, _, multiplier, matched = find_quote_span(transcript, quote)
        if matched and multiplier >= 0.99:
            exact_matches += 1

    return round((exact_matches / total) * 100, 1)


def compute_clarification_handling(
    expected_tasks: List[Dict[str, Any]],
    found_tasks: List[Dict[str, Any]],
) -> float:
    """
    Of the tasks with no owner in expected ground truth,
    checks how many were flagged needs_clarification instead of being given a guessed owner.
    """
    unowned_expected = [t for t in expected_tasks if not t.get("owner")]
    if not unowned_expected:
        return 100.0

    correctly_flagged = 0
    for exp in unowned_expected:
        for found in found_tasks:
            if title_similarity(found.get("title", ""), exp.get("title", "")) >= 0.5:
                # If flagged for clarification and didn't invent an owner
                if found.get("needs_clarification") and not found.get("owner"):
                    correctly_flagged += 1
                break

    return round((correctly_flagged / len(unowned_expected)) * 100, 1)
