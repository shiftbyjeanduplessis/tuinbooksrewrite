# TuinBooks UI-Restored Release R13 — Build Report

Status: IMPLEMENTED / LOCAL AUTOMATED GATE PASS / DEPLOYED BROWSER NOT YET VERIFIED

R13 Schedule changes:
- Normal mode has one click surface: the visit card opens Visit Actions.
- The three-dot card action button is removed.
- The `i` affordance is hover/focus information only and includes address, team/route, status/type, recurrence, task, access notes, site instructions and DNS warnings where present.
- Rearrange mode adds per-card checkboxes for movable visits.
- Multiple selected visits can be dragged together to one team/day or into Basket.
- Group moves are occurrence-only by design; future recurrence is not silently changed.
- A single recurring visit still uses the existing This visit / This + future decision.
- Group calendar and Basket moves use R13 atomic server RPCs.
- Street address, team colours, visible drag ID, floating Basket, Additional Visit and missed/DNS flows remain.

Automated verification:
- Domain: PASS — 178 assertions
- Stress: PASS — v4 100 accounts / 110 locations; 200-client recurrence 1,408 visits; 10,000 invoices
- Release contract: PASS — base + R6 + UI preservation + R7/R8/R9/R10/R11/R12/R13 Schedule contracts
- XLSX round-trip: PASS — 0 errors
- TypeScript production build: PASS
- Static module integrity: PASS — 96 JS module copies, 212 relative imports, 0 missing, 0 forbidden legacy patterns
- HTTP smoke: PASS — /app, mobile, /management, public documents and assets HTTP 200

Required SQL before browser-testing multi-select group drag:
- supabase/APPLY-R13-GROUP-DRAG.sql

Do not run migration-v2-optional-adopt-legacy-recurrence.sql as part of this release.
