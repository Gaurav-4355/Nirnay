import os
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

print("=== 1. Testing GET /api/health ===")
health_res = client.get("/api/health")
assert health_res.status_code == 200
health_data = health_res.json()
print("Health Data:", health_data)
assert "model" in health_data
assert health_data["model"] == os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
print(f"Verified active model in health: {health_data['model']}")

print("\n=== 2. Testing No-Fallback Behavior when GROQ_API_KEY is not set ===")
# Ensure DEMO_FALLBACK is not active
orig_demo = os.environ.get("DEMO_FALLBACK")
orig_key = os.environ.get("GROQ_API_KEY")
if "DEMO_FALLBACK" in os.environ:
    del os.environ["DEMO_FALLBACK"]
if "GROQ_API_KEY" in os.environ:
    del os.environ["GROQ_API_KEY"]

demo_list = client.get("/api/seed/demo-meetings").json()
m1_data = demo_list[0]
m2_data = demo_list[1]
m3_data = demo_list[2]

no_key_res = client.post("/api/meetings/analyze", json={
    "title": m1_data["title"],
    "meeting_date": m1_data["meeting_date"],
    "transcript": m1_data["transcript"],
})
assert no_key_res.status_code in (400, 500)
assert "GROQ_API_KEY is not configured" in no_key_res.json()["detail"]
print("Verified clear error message when no API key and DEMO_FALLBACK is not set!")

print("\n=== 3. Enabling DEMO_FALLBACK=true for Demo Progression ===")
os.environ["DEMO_FALLBACK"] = "true"

print("--- Resetting Database via POST /api/reset ---")
reset_res = client.post("/api/reset")
assert reset_res.status_code == 200
assert len(client.get("/api/meetings").json()) == 0
assert len(client.get("/api/decisions").json()) == 0
assert len(client.get("/api/tasks").json()) == 0
assert len(client.get("/api/conflicts").json()) == 0
print("Database cleanly reset!")

print("\n--- Analyzing Meeting 1 ---")
m1_analyze = client.post("/api/meetings/analyze", json={
    "title": m1_data["title"],
    "meeting_date": m1_data["meeting_date"],
    "transcript": m1_data["transcript"],
}).json()

assert m1_analyze["cached_demo"] is True
print("Decisions in Meeting 1:", [d["topic"] for d in m1_analyze["decisions"]])
print("Tasks in Meeting 1:")
karan_qa_task = None
for t in m1_analyze["tasks"]:
    print(f"  - {t['title']} (Owner: {t['owner']}, Waits for: {t.get('depends_on_title')})")
    if "QA environment" in t["title"]:
        karan_qa_task = t

assert karan_qa_task is not None, "Karan's QA environment task must be extracted!"
assert karan_qa_task["needs_clarification"] is True
assert karan_qa_task["depends_on_title"] is not None
print("Verified Karan's task has dependency:", karan_qa_task["depends_on_title"])

# Confirm Meeting 1
m1_confirm = client.post("/api/meetings/confirm", json={
    "title": m1_analyze["title"],
    "meeting_date": m1_analyze["meeting_date"],
    "transcript": m1_analyze["transcript"],
    "decisions": m1_analyze["decisions"],
    "tasks": m1_analyze["tasks"],
    "task_updates": [],
    "conflict_resolutions": [],
    "conflicts": [],
}).json()
print(f"Meeting 1 Confirmed! (Meeting ID: {m1_confirm['id']})")

print("\n--- Analyzing Meeting 2 with Cross-Meeting Memory ---")
m2_analyze = client.post("/api/meetings/analyze", json={
    "title": m2_data["title"],
    "meeting_date": m2_data["meeting_date"],
    "transcript": m2_data["transcript"],
}).json()

print(f"Meeting 2 Task Updates ({len(m2_analyze['task_updates'])}):")
for tu in m2_analyze["task_updates"]:
    print(f"  - Task {tu['task_id']} ({tu['task_title']}): {tu['old_status']} -> {tu['new_status']}")

# Verify task_updates show landing page DONE, campaign plan DONE
updated_titles = [tu["task_title"].lower() for tu in m2_analyze["task_updates"]]
assert any("landing page" in ut for ut in updated_titles), "Landing page should be in task_updates!"
assert any("campaign plan" in ut for ut in updated_titles), "Campaign plan should be in task_updates!"

# Verify Meeting 2 creates NO duplicate tasks for existing commitments
new_task_titles = [t["title"].lower() for t in m2_analyze["tasks"]]
assert not any("landing page designs and copy review" in nt for nt in new_task_titles), "Must not duplicate landing page!"
assert not any("launch marketing campaign plan aur influencer" in nt for nt in new_task_titles), "Must not duplicate campaign plan!"
print("Verified NO duplicate tasks created for existing work!")

# Verify Pricing Conflict (Rs 499 -> Rs 599)
print(f"Meeting 2 Conflicts ({len(m2_analyze['conflicts'])}):")
pricing_conflict = None
for c in m2_analyze["conflicts"]:
    print(f"  - [{c['type']}] {c['title']}: {c['description']}")
    if c["type"] == "decision_conflict" and "pricing" in c["title"].lower():
        pricing_conflict = c

assert pricing_conflict is not None, "Pricing conflict must be detected in Meeting 2!"
assert "499" in pricing_conflict["old_value"]
assert "599" in pricing_conflict["new_value"]
print("Verified Pricing Decision Conflict (499 -> 599)!")

# Confirm Meeting 2 with "kept_new"
m2_confirm = client.post("/api/meetings/confirm", json={
    "title": m2_analyze["title"],
    "meeting_date": m2_analyze["meeting_date"],
    "transcript": m2_analyze["transcript"],
    "decisions": m2_analyze["decisions"],
    "tasks": m2_analyze["tasks"],
    "task_updates": m2_analyze["task_updates"],
    "conflict_resolutions": [{
        "conflict_index": 0,
        "type": "decision_conflict",
        "topic": "pricing",
        "resolution": "kept_new",
        "old_decision_id": pricing_conflict["old_decision_id"]
    }],
    "conflicts": m2_analyze["conflicts"],
}).json()
print("Meeting 2 Confirmed!")

# Verify Decisions view shows old decision superseded by new decision
all_decs = client.get("/api/decisions").json()
pricing_decs = [d for d in all_decs if d["topic"] == "pricing"]
assert len(pricing_decs) == 2
old_pricing = next(d for d in pricing_decs if "499" in d["value"])
new_pricing = next(d for d in pricing_decs if "599" in d["value"])
assert old_pricing["status"] == "superseded"
assert new_pricing["status"] == "active"
assert old_pricing["superseded_by_id"] == new_pricing["id"]
assert old_pricing["superseded_by_value"] == new_pricing["value"]
print("Verified old pricing decision is marked 'superseded' with superseded_by link!")

print("\n--- Analyzing Meeting 3 with Cross-Meeting Memory ---")
m3_analyze = client.post("/api/meetings/analyze", json={
    "title": m3_data["title"],
    "meeting_date": m3_data["meeting_date"],
    "transcript": m3_data["transcript"],
}).json()

print(f"Meeting 3 Task Updates ({len(m3_analyze['task_updates'])}):")
amit_deadline_update = None
for tu in m3_analyze["task_updates"]:
    print(f"  - Task {tu['task_id']} ({tu['task_title']}): deadline {tu['old_deadline']} -> {tu['new_deadline']}")
    if "backend" in tu["task_title"].lower() and tu["new_deadline"] == "2026-12-28":
        amit_deadline_update = tu

assert amit_deadline_update is not None, "Amit's backend deadline update (2026-12-20 -> 2026-12-28) must be in task_updates!"
m3_new_titles = [t["title"].lower() for t in m3_analyze["tasks"]]
assert not any("complete backend rest api" in t for t in m3_new_titles), "Amit backend must NOT be a duplicate task!"
print("Verified Amit's 28 Dec deadline change is a task update, not a new task!")

print(f"Meeting 3 Conflicts ({len(m3_analyze['conflicts'])}):")
c_types = {}
for c in m3_analyze["conflicts"]:
    print(f"  - [{c['type']}] {c['title']}: {c['description']}")
    c_types[c["type"]] = c

assert "decision_conflict" in c_types, "Launch date decision conflict must be detected!"
assert "workload_overload" in c_types, "Priya workload overload must be detected!"
assert "dependency_conflict" in c_types, "Karan vs Amit dependency conflict must be detected!"

# Assert specific conflict details
launch_conf = c_types["decision_conflict"]
assert "15 Jan 2027" in launch_conf["old_value"]
assert "5 Feb 2027" in launch_conf["new_value"]

workload_conf = c_types["workload_overload"]
assert "Priya" in workload_conf["title"]
assert len(workload_conf["related_titles"]) >= 4

dep_conf = c_types["dependency_conflict"]
assert "2026-12-22" in dep_conf["description"]
assert "2026-12-28" in dep_conf["description"]
print("All 3 Meeting 3 conflicts verified!")

# Confirm Meeting 3
m3_confirm = client.post("/api/meetings/confirm", json={
    "title": m3_analyze["title"],
    "meeting_date": m3_analyze["meeting_date"],
    "transcript": m3_analyze["transcript"],
    "decisions": m3_analyze["decisions"],
    "tasks": m3_analyze["tasks"],
    "task_updates": m3_analyze["task_updates"],
    "conflict_resolutions": [
        {"conflict_index": 0, "type": "decision_conflict", "resolution": "kept_new", "topic": "launch_date"},
        {"conflict_index": 1, "type": "dependency_conflict", "resolution": "acknowledged"},
        {"conflict_index": 2, "type": "workload_overload", "resolution": "acknowledged"}
    ],
    "conflicts": m3_analyze["conflicts"],
}).json()
print("Meeting 3 Confirmed!")

print("\n--- Verifying GET /api/conflicts ---")
conflicts_list = client.get("/api/conflicts").json()
print(f"Total conflicts stored in DB: {len(conflicts_list)}")
assert len(conflicts_list) >= 4  # 1 from Meeting 2 + 3 from Meeting 3

print("\n--- Verifying GET /api/tasks ---")
tasks_list = client.get("/api/tasks").json()
print(f"Total tasks stored in DB: {len(tasks_list)}")
for t in tasks_list:
    if t.get("updated_in_meeting_title"):
        print(f"  Task '{t['title']}' was updated in '{t['updated_in_meeting_title']}' with status '{t['status']}', deadline '{t['deadline']}'")
    if t.get("depends_on_title"):
        print(f"  Task '{t['title']}' waits for '{t['depends_on_title']}'")

print("\n==============================================")
print("ALL ACCEPTANCE CRITERIA SUCCESSFULLY VERIFIED!")
print("==============================================")
