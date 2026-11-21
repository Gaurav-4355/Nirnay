# Nirnay Frontend Design System: Marked-Up Record (Pure White)

## Tokens
- Surface: `#FFFFFF` (all page and container backgrounds; strictly no grey panels).
- Subtle fill: `#F7F8FA` (hover rows, table headers, inputs, selected nav).
- Hairline: `#E7E9EE` (1px dividers and borders). Strong line: `#CDD1DA` (inputs).
- Ink: `#0F1222`, ink-soft: `#5E6477`, ink-faint: `#8A90A2`.
- Accent (Pen-Blue): `#1E35C7`, hover: `#172AA3`, tint: `#EEF1FD` (buttons, links, active bar, focus).
- Meaning: red-pen `#D0272D` (tint `#FDF1F1`), stamp-green `#14795A` (tint `#EEF8F3`), pencil-amber `#B26B00` (tint `#FFF6E5`), highlighter `#FFE066`.
- Typography: Newsreader (spoken serif), Hanken Grotesk (concluded sans).
- Type scale: 12, 13 (meta), 15 (body/1.55), 17 (section, 650), 22, 30 (page title, 700, -0.02em), 44. `tabular-nums` on all figures.
- Radius: controls 6px, bordered objects 10px, ledger rows 0px. Max-width: 1200px (reading 760px).
- Shadows: None on surfaces. Only sticky bars/modals: `0 8px 24px rgba(15,18,34,.08)`. Transitions: 120ms.

## Wireframe: Today
```
[Nav 248px]  Today  ·  2026-12-17 (simulated)                 [Waiting (3)] [Guided demo]
──────────────────────────────────────────────────────────────────────────────────────────
Needs your call
 1 conflict to settle                                                    Review ->
 3 messages waiting for approval                                         Approve ->
 2 tasks without an owner                                                Assign ->
──────────────────────────────────────────────────────────────────────────────────────────
Decision ledger (wide left)                          Who is loaded (right)
 Launch date   ~~15 Jan 2027~~  5 Feb 2027            Priya  ▮▮▮▮▮ 5 due this week
 Pricing       ~~Rs 499~~  Rs 599                     Amit   ▮▮
Coming up (next 10 deadlines, red-pen if overdue)    Recently (short activity timeline)
```

## Wireframe: New Meeting Review
```
1. Paste  ——  2. Review  ——  3. Saved
──────────────────────────────────────────────────────────────────────────────────────────
[ Left 62% ]                                          [ Right 38% Sticky Transcript ]
Conflicts (10px box, 3px red-pen left border)         Line 1  Speaker: Spoken text (serif)
  Launch date                                         Line 2  Speaker: [Highlighted Quote]
  Was 15 Jan 2027 (Meeting 1) -> Now 5 Feb 2027
  [Keep the new one] [Keep the old one]
Task updates (Pending -> Done + Quote + confidence)
Ledger: New decisions · New tasks (inline owner edit)
──────────────────────────────────────────────────────────────────────────────────────────
[Sticky bar: 1 conflict left · 2 updates · 5 tasks              [Back] [Approve and save]]
```
