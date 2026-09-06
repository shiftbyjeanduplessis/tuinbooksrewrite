# TuinBooks UI-Restored Release R11 — Build Report

Scope: Schedule team colours, Basket placement reliability, and a meaningful Normal-vs-Drag mode split. Scheduler engine remains the v2 engine.

Changes:
- Teams now receive distinct, restrained colour accents across team labels, cell headers and route markers.
- Normal mode is explicitly operational/read mode.
- Drag mode is now a dedicated rearrangement workspace: operational day actions are suppressed, Basket opens automatically, and planning affordances are emphasised.
- Recurring moves no longer use a global scope selector. On drop, the existing recurrence dialog asks **This visit** or **This + future** only when needed.
- Basket cards are draggable only while Drag mode is active.
- Basket placement RPC is idempotent: if the original `schedule_jobs` row still exists, it is updated/reused rather than inserted again. This directly addresses `duplicate key value violates unique constraint "schedule_jobs_pkey"`.
- Street address on cards and the visible drag ghost ID are retained.
- Floating/minimizable/tuck-away Basket, visit-specific Do Not Service, Note/Event dialogs, Additional Visit and dense full-width Schedule are retained.

Verification:
- Domain: PASS (178 assertions)
- Stress: PASS
- Release contract: PASS (61 checks)
- R6 workspace display contract: PASS
- UI preservation contract: PASS
- Schedule usability contract: PASS
- R8 Schedule cleanup contract: PASS
- R9 Schedule layout contract: PASS
- R10 floating Basket contract: PASS
- R11 rearrange/Basket contract: PASS
- XLSX roundtrip: PASS
- TypeScript/build: PASS
- Static assets/imports: PASS
- HTTP smoke: PASS

Deployed browser verification: NOT YET VERIFIED.
