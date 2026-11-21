import os
import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..db import Base
from ..models import AppSetting
from ..schemas import MeetingConfirmRequest, ProposalDecision, ProposalTask, ProposalTaskUpdate
from .meeting_service import analyze_meeting, save_confirmed_meeting
from .eval_scoring import (
    score_decisions,
    score_tasks,
    score_task_updates,
    score_conflicts,
    compute_evidence_quote_validity,
    compute_clarification_handling,
)

# Global in-memory job state
_eval_job_lock = threading.Lock()
_current_eval_job: Dict[str, Any] = {
    "state": "idle",  # "idle" | "running" | "done" | "error"
    "job_id": None,
    "progress": "",
    "result": None,
    "error": None,
    "finished_at": None,
}


def get_eval_status() -> Dict[str, Any]:
    with _eval_job_lock:
        return dict(_current_eval_job)


def start_eval_job() -> str:
    with _eval_job_lock:
        if _current_eval_job["state"] == "running":
            return _current_eval_job["job_id"] or "running"

        job_id = f"eval_{int(time.time())}"
        _current_eval_job["state"] = "running"
        _current_eval_job["job_id"] = job_id
        _current_eval_job["progress"] = "Initializing evaluation sandbox..."
        _current_eval_job["result"] = None
        _current_eval_job["error"] = None
        _current_eval_job["finished_at"] = None

    thread = threading.Thread(target=_run_eval_pipeline, args=(job_id,), daemon=True)
    thread.start()
    return job_id


def _run_eval_pipeline(job_id: str):
    seed_dir = Path(__file__).parent.parent / "seed"
    gt_path = seed_dir / "ground_truth.json"

    try:
        if not gt_path.exists():
            raise FileNotFoundError("Ground truth file ground_truth.json not found in backend/seed/")

        gt_data = json.loads(gt_path.read_text(encoding="utf-8"))
        meetings_gt = gt_data.get("meetings", [])

        # Create temporary in-memory database
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        temp_db = SessionLocal()

        meeting_files = {
            1: "meeting_1.txt",
            2: "meeting_2.txt",
            3: "meeting_3.txt",
        }

        meeting_eval_results = []
        all_found_items_for_quote_check = []
        all_transcripts = ""

        total_exp_dec = 0
        total_cor_dec = 0
        total_fnd_dec = 0

        total_exp_tsk = 0
        total_cor_tsk = 0
        total_fnd_tsk = 0

        total_exp_upd = 0
        total_cor_upd = 0
        total_fnd_upd = 0

        total_exp_cnf = 0
        total_cor_cnf = 0
        total_fnd_cnf = 0

        clarification_scores = []

        for idx, m_gt in enumerate(meetings_gt):
            m_id = m_gt["meeting_id"]
            title = m_gt["title"]
            date_str = m_gt["meeting_date"]
            txt_file = seed_dir / meeting_files.get(m_id, f"meeting_{m_id}.txt")
            transcript = txt_file.read_text(encoding="utf-8").strip() if txt_file.exists() else ""
            all_transcripts += "\n" + transcript

            with _eval_job_lock:
                _current_eval_job["progress"] = f"Meeting {idx + 1} of {len(meetings_gt)}: Analyzing transcript with live LLM..."

            # Real analyze with live LLM (ignoring demo fallback)
            analyze_res = analyze_meeting(
                db=temp_db,
                title=title,
                meeting_date=date_str,
                transcript=transcript,
                ignore_demo_fallback=True,
            )

            # Score this meeting against ground truth
            found_decisions = [d.model_dump() for d in analyze_res.decisions]
            found_tasks = [t.model_dump() for t in analyze_res.tasks]
            found_updates = [u.model_dump() for u in analyze_res.task_updates]
            found_conflicts = [c.model_dump() for c in analyze_res.conflicts]

            all_found_items_for_quote_check.extend(found_decisions)
            all_found_items_for_quote_check.extend(found_tasks)

            dec_score = score_decisions(m_gt.get("expected_decisions", []), found_decisions)
            tsk_score = score_tasks(m_gt.get("expected_tasks", []), found_tasks)
            upd_score = score_task_updates(m_gt.get("expected_task_updates", []), found_updates)
            cnf_score = score_conflicts(m_gt.get("expected_conflicts", []), found_conflicts)

            clar_score = compute_clarification_handling(m_gt.get("expected_tasks", []), found_tasks)
            clarification_scores.append(clar_score)

            total_exp_dec += dec_score["expected"]
            total_cor_dec += dec_score["correct"]
            total_fnd_dec += dec_score["found"]

            total_exp_tsk += tsk_score["expected"]
            total_cor_tsk += tsk_score["correct"]
            total_fnd_tsk += tsk_score["found"]

            total_exp_upd += upd_score["expected"]
            total_cor_upd += upd_score["correct"]
            total_fnd_upd += upd_score["found"]

            total_exp_cnf += cnf_score["expected"]
            total_cor_cnf += cnf_score["correct"]
            total_fnd_cnf += cnf_score["found"]

            meeting_eval_results.append({
                "meeting_id": m_id,
                "title": title,
                "meeting_date": date_str,
                "decisions": dec_score,
                "tasks": tsk_score,
                "task_updates": upd_score,
                "conflicts": cnf_score,
                "clarification_score": clar_score,
            })

            # Auto-confirm proposal into temp database
            confirm_req = MeetingConfirmRequest(
                title=title,
                meeting_date=date_str,
                transcript=transcript,
                decisions=analyze_res.decisions,
                tasks=analyze_res.tasks,
                task_updates=analyze_res.task_updates,
                conflicts=analyze_res.conflicts,
                conflict_resolutions=[
                    {"conflict_index": c_i, "resolution": "kept_new"}
                    for c_i in range(len(analyze_res.conflicts))
                ],
            )
            save_confirmed_meeting(db=temp_db, request=confirm_req, queue_outbox=False)

            # Sleep 2 seconds between LLM calls to respect rate limits
            if idx < len(meetings_gt) - 1:
                with _eval_job_lock:
                    _current_eval_job["progress"] = f"Meeting {idx + 1} confirmed into memory. Waiting 2s before next call..."
                time.sleep(2)

        temp_db.close()

        # Compute aggregates
        evidence_validity = compute_evidence_quote_validity(all_transcripts, all_found_items_for_quote_check)
        avg_no_guess = round(sum(clarification_scores) / len(clarification_scores), 1) if clarification_scores else 100.0

        total_expected_all = total_exp_dec + total_exp_tsk + total_exp_upd + total_exp_cnf
        total_correct_all = total_cor_dec + total_cor_tsk + total_cor_upd + total_cor_cnf
        overall_recall = round((total_correct_all / total_expected_all) * 100, 1) if total_expected_all > 0 else 100.0

        def calc_pr(c, f, e):
            p = round((c / f) * 100, 1) if f > 0 else (100.0 if e == 0 else 0.0)
            r = round((c / e) * 100, 1) if e > 0 else 100.0
            return p, r

        p_dec, r_dec = calc_pr(total_cor_dec, total_fnd_dec, total_exp_dec)
        p_tsk, r_tsk = calc_pr(total_cor_tsk, total_fnd_tsk, total_exp_tsk)
        p_upd, r_upd = calc_pr(total_cor_upd, total_fnd_upd, total_exp_upd)
        p_cnf, r_cnf = calc_pr(total_cor_cnf, total_fnd_cnf, total_exp_cnf)

        summary = {
            "overall_recall": overall_recall,
            "evidence_validity": evidence_validity,
            "no_guess_rate": avg_no_guess,
            "decisions": {
                "expected": total_exp_dec,
                "found": total_fnd_dec,
                "correct": total_cor_dec,
                "precision": p_dec,
                "recall": r_dec,
            },
            "tasks": {
                "expected": total_exp_tsk,
                "found": total_fnd_tsk,
                "correct": total_cor_tsk,
                "precision": p_tsk,
                "recall": r_tsk,
            },
            "task_updates": {
                "expected": total_exp_upd,
                "found": total_fnd_upd,
                "correct": total_cor_upd,
                "precision": p_upd,
                "recall": r_upd,
            },
            "conflicts": {
                "expected": total_exp_cnf,
                "found": total_fnd_cnf,
                "correct": total_cor_cnf,
                "precision": p_cnf,
                "recall": r_cnf,
            },
        }

        finished_at = datetime.utcnow().isoformat()
        final_result = {
            "summary": summary,
            "meetings": meeting_eval_results,
            "evaluated_at": finished_at,
            "snapshot": False,
        }

        # Persist in real database via app_settings
        from ..db import SessionLocal as ProdSessionLocal
        prod_db = ProdSessionLocal()
        try:
            setting = prod_db.query(AppSetting).filter(AppSetting.key == "last_eval").first()
            if not setting:
                setting = AppSetting(key="last_eval", value=json.dumps(final_result))
                prod_db.add(setting)
            else:
                setting.value = json.dumps(final_result)
            prod_db.commit()
        finally:
            prod_db.close()

        with _eval_job_lock:
            _current_eval_job["state"] = "done"
            _current_eval_job["progress"] = "Completed evaluation across 3 meetings."
            _current_eval_job["result"] = final_result
            _current_eval_job["finished_at"] = finished_at

    except Exception as e:
        with _eval_job_lock:
            _current_eval_job["state"] = "error"
            _current_eval_job["error"] = str(e)
            _current_eval_job["progress"] = f"Evaluation failed: {str(e)}"
            _current_eval_job["finished_at"] = datetime.utcnow().isoformat()


def export_eval_snapshot(result_data: Dict[str, Any]) -> str:
    """Writes the evaluation result snapshot to backend/seed/eval_snapshot.json."""
    seed_dir = Path(__file__).parent.parent / "seed"
    snapshot_path = seed_dir / "eval_snapshot.json"
    snapshot_data = dict(result_data)
    snapshot_data["snapshot"] = True
    snapshot_path.write_text(json.dumps(snapshot_data, indent=2), encoding="utf-8")
    return str(snapshot_path)


def get_latest_eval_result(db) -> Optional[Dict[str, Any]]:
    """Returns the latest live eval from app_settings, or loads the snapshot file."""
    # Check DB
    setting = db.query(AppSetting).filter(AppSetting.key == "last_eval").first()
    if setting and setting.value:
        try:
            data = json.loads(setting.value)
            data["snapshot"] = False
            return data
        except Exception:
            pass

    # Check snapshot file
    seed_dir = Path(__file__).parent.parent / "seed"
    snapshot_path = seed_dir / "eval_snapshot.json"
    if snapshot_path.exists():
        try:
            data = json.loads(snapshot_path.read_text(encoding="utf-8"))
            data["snapshot"] = True
            return data
        except Exception:
            pass

    return None
