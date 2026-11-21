# Nirnay Editorial Design System

## Core Aesthetic: The Living Ledger on Paper

Nirnay transforms messy meeting dialogues into clear, committed execution.
The interface is designed like a physical editorial ledger and working paper notebook:
- **Clean, warm paper backgrounds** (`#fbfbfa` / `#f7f6f2` / `#ffffff`)
- **Deep ink typography** (`#1c1917` stone-900, `#44403c` stone-700)
- **Hairline dividers** (`1px solid #e7e5e4` stone-200)
- **Serif typography reserved strictly for quotes and transcripts** (`font-serif italic`)
- **Red-pen markings** for overrides, slips, strikethroughs, and overdue items
- **Stamp-style badges** (like ink validation stamps on printed memos)

---

## The Strict "DO NOT" List
1. **NO dark theme** — no `bg-slate-950`, `#0b0f17`, or dark cards.
2. **NO uppercase labels** — no `uppercase tracking-wider` badges. Use sentence case.
3. **NO monospace everywhere** — dates, numbers, and stats render in clean sans numbers (`tabular-nums font-sans`).
4. **NO uniform floating cards with glows** — use ledgers, tables, ruled paper lists, and document sheets with hairlines.
5. **NO decorative gradients** — no indigo-to-purple neon gradients. Use solid, purposeful ink and paper tones.

---

## Token Palette
- **Paper Background**: `#fbfbfa` (body), `#ffffff` (sheets and surfaces), `#f4f3ef` (hover / subtle sections)
- **Ink Primary**: `#1c1917` (stone-900)
- **Ink Secondary**: `#57534e` (stone-600)
- **Ink Muted**: `#a8a29e` (stone-400)
- **Hairline Rule**: `#e7e5e4` (stone-200)
- **Red Pen**: `#b91c1c` (red-700, overdue, strikethrough, blocked)
- **Amber Note**: `#b45309` (amber-700, due in 2d, unassigned action)
- **Stamp Green**: `#15803d` (green-700, verified, approved, done)
- **Stamp Indigo**: `#4338ca` (indigo-700, active view, key action)

---

## Component Paradigms
- **Decisions**: A ledger with hairline dividers, not cards. Replaced decisions feature animated red-pen strike-through lines and replacement audit notes.
- **Conflicts**: Three specialized physical visualizations:
  1. *Decision Conflict*: Before/After diff card with red vs green values.
  2. *Workload Overload*: 7-day calendar strip showing overloaded distribution.
  3. *Dependency Conflict*: Visual timeline showing downstream task due before prerequisite.
- **Tasks**: Board (columns with restrained tones, flat cards) and dense Table (sortable, hairlines), with state persisted in URL hash (`#board` / `#table`). Unassigned shown with amber inline action `"Assign"`.
- **Approval Gateway (Outbox)**: Document message previews grouped into Tracker cards, Reminders, and Weekly summaries. Single "Approve all" count button.
- **Ask Nirnay**: Conversational editorial column on paper. Sans dialogue, serif quotes linking to drawer.
- **Accuracy Scoreboard**: Single clear English opening statement, clean tabular breakdown, and human-readable missed/extra notes.
