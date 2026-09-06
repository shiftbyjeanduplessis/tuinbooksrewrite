# TuinBooks UI-Restored Release R9 — Build Report

Scope: Schedule layout/density only. Scheduler behavior and R8 operations are unchanged.

Changes:
- Desktop calendar fills the available page width.
- Removed desktop nested calendar max-height/vertical scrolling.
- Basket no longer has its own vertical scroll; the page scrolls naturally.
- Calendar only uses a horizontal scroller on smaller screens (<1080px).
- Normal visit cards compact to name + street/suburb.
- Busy cells compact automatically above 8 visits and again above 14 visits.
- Drag mode keeps visible visit ID and modest duration-resize height feedback.
- Visit-specific Do Not Service, Note/Event dialogs, Additional Visit, week cards, Drag Mode and R8 operations remain unchanged.

Verification:
- Domain: PASS (178 assertions)
- Stress: PASS
- Release contract: PASS (61 checks)
- R6 workspace display contract: PASS
- UI preservation contract: PASS
- Schedule usability contract: PASS
- R8 Schedule cleanup contract: PASS
- R9 Schedule layout contract: PASS
- XLSX roundtrip: PASS
- TypeScript/build: PASS
- Static assets/imports: PASS
- HTTP smoke: PASS

Deployed browser verification: NOT YET VERIFIED.
