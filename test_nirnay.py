import sys
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

print("--- 1. Testing health check ---")
res = client.get("/api/health")
assert res.status_code == 200, res.text
print("Health check passed:", res.json())

print("\n--- 2. Testing demo meetings endpoint ---")
res = client.get("/api/seed/demo-meetings")
assert res.status_code == 200, res.text
demos = res.json()
assert len(demos) == 3, f"Expected 3 demo meetings, got {len(demos)}"
print(f"Successfully loaded {len(demos)} demo meetings.")

m1 = demos[0]
print(f"Meeting 1: {m1['title']}, date: {m1['meeting_date']}, lines: {len(m1['transcript'].splitlines())}")

print("\n--- 3. Testing /api/meetings/analyze with Demo Meeting 1 ---")
analyze_payload = {
    "title": m1["title"],
    "meeting_date": m1["meeting_date"],
    "transcript": m1["transcript"]
}
res = client.post("/api/meetings/analyze", json=analyze_payload)
assert res.status_code == 200, res.text
proposal = res.json()

print(f"Proposal generated successfully!")
print(f"Extracted Decisions ({len(proposal['decisions'])}):")
for d in proposal["decisions"]:
    print(f"  - [{d['topic']}] {d['value']}: \"{d['text']}\" (quote: \"{d['evidence_quote'][:40]}...\")")

print(f"Extracted Tasks ({len(proposal['tasks'])}):")
vague_task_found = False
for t in proposal["tasks"]:
    print(f"  - {t['title']} | Owner: {t['owner']} | Deadline: {t['deadline']} | Clarify: {t['needs_clarification']}")
    if t["needs_clarification"] and not t["owner"]:
        vague_task_found = True
        print(f"    -> Clarification Question: \"{t['clarification_question']}\"")

assert vague_task_found, "Expected vague task with needs_clarification=True and owner=None!"
print("Vague task verification PASSED!")

print("\n--- 4. Testing /api/meetings/confirm (human save) ---")
res = client.post("/api/meetings/confirm", json=proposal)
assert res.status_code == 200, res.text
saved_meeting = res.json()
print(f"Saved Meeting ID {saved_meeting['id']}: \"{saved_meeting['title']}\"")
print(f"Decisions count: {len(saved_meeting['decisions'])}")
print(f"Tasks count: {len(saved_meeting['tasks'])}")

print("\n--- 5. Testing GET /api/meetings, /api/decisions, /api/tasks ---")
m_list = client.get("/api/meetings").json()
assert len(m_list) >= 1
print(f"Total meetings in DB: {len(m_list)}")

d_list = client.get("/api/decisions").json()
assert len(d_list) >= 2
print(f"Total decisions in DB: {len(d_list)}")

t_list = client.get("/api/tasks").json()
assert len(t_list) >= 4
print(f"Total tasks in DB: {len(t_list)}")

print("\n--- 6. Testing owner filter /api/tasks?owner=Amit ---")
amit_tasks = client.get("/api/tasks?owner=Amit").json()
print(f"Amit tasks count: {len(amit_tasks)}")
assert any("Amit" in (t["owner"] or "") for t in amit_tasks)

print("\n--- 7. Testing PATCH /api/tasks/{id} ---")
first_task_id = t_list[0]["id"]
patch_res = client.patch(f"/api/tasks/{first_task_id}", json={"status": "done"})
assert patch_res.status_code == 200
updated_task = patch_res.json()
assert updated_task["status"] == "done"
print(f"Task {first_task_id} successfully updated to status 'done'!")

print("\nALL BACKEND ACCEPTANCE CHECKS PASSED!")
