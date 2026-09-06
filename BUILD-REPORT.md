# TuinBooks UI-Restored Release R8 — Build Report

## Scope
Schedule cleanup on top of the fast v2 scheduler. No scheduler-engine replacement.

### Preserved improvements
- Street address remains directly visible on schedule cards.
- Visible drag identifier remains in the drag ghost.
- Fast v2 drag/drop, Basket, recurrence authority, resize and optimistic persistence remain.

### R8 Schedule cleanup
- Normal mode and Drag mode are visually distinct.
- Drag mode hides Note/Event/+Visit controls and visit action buttons to reduce accidental actions.
- Rolling week cards remain at the top.
- Capacity meters remain removed.
- Calendar cards are simplified for readability: route, client name, street, suburb, compact status markers.
- Basket remains compact: client name + street + suburb only.
- Note, Event and + Visit remain small calendar controls in Normal mode.
- Visit actions remain in dialogs rather than cluttering the board.
- Visit-specific DO NOT SERVICE is separate from client-level DO NOT SERVICE.
- Visit-specific DO NOT SERVICE is surfaced in desktop Work and Mobile, and Mobile does not offer completion for that visit.
- Event dialog now supports Response / outcome and Respond & resolve while keeping an audit trail.

## Database addition
`supabase/APPLY-R8-SCHEDULE-OPERATIONS.sql`

Adds only:
- `response` / `resolved_at` support to existing schedule day actions.
- `resolved` as a durable day-action status.
- `tuinbooks_v2_save_day_action_r8(...)`.
- `tuinbooks_v2_set_visit_do_not_service(...)`.

It does not alter recurrence, invoices, quotes, clients, teams or existing schedule dates.

## Automated verification
- Domain: PASS — 178 assertions
- Stress: PASS — 100-account v4, 200-client recurrence = 1,408 visits, 10,000 invoices
- Release contract: PASS — 61 baseline checks
- R6 workspace display contract: PASS
- UI preservation contract: PASS
- Schedule usability contract: PASS
- R8 Schedule cleanup contract: PASS
- TypeScript production build: PASS
- XLSX round-trip: PASS
- Static assets/imports: PASS — 96 JS module copies, 212 relative imports, 0 missing
- HTTP smoke: PASS — `/app/`, mobile, `/management/`, public docs and assets

## Browser status
R8 is IMPLEMENTED / LOCALLY VERIFIED by automated checks. It is NOT YET VERIFIED on Render until deployed and tested in a browser.
