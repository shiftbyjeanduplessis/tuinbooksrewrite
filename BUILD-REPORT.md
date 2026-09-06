# TuinBooks UI-Restored Release R10 — Build Report

Status: IMPLEMENTED + LOCALLY VERIFIED

- Domain tests: PASS — 178 assertions
- Stress: PASS — 100-account v4, 200-client recurrence (1,408 visits), 10,000 invoices
- Release contract: PASS — 61 core checks + UI/Schedule R6/R8/R9/R10 contracts
- XLSX round-trip: PASS
- TypeScript/build: PASS
- Static route/import audit: PASS — 96 JS module copies, 212 relative imports, 0 missing
- HTTP smoke: PASS — app/mobile/management/public documents/assets HTTP 200

R10-specific checks:
- Additional Visit: X, Cancel, Escape and backdrop close paths present.
- Basket: floating, movable, minimizable, tuck-away edge strip, persistent local position/state.
- R9 full-width/dense calendar retained.

Deployed browser verification: NOT YET VERIFIED.
