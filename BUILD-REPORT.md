# TuinBooks UI-restored release R3 — build report

Date: 2026-09-06

Purpose: restore compatibility between the original TuinBooks Management portal and the rewritten application workspace without changing the Management workflow.

## Fixed

- Original Management opens the app with `?support=1&business=<uuid>&session=<uuid>`.
- The rewritten app incorrectly treated `support=1` as though `1` were the business UUID, causing `invalid input syntax for type uuid: "1"` and dropping the user onto the sign-in screen.
- R3 now reads the business UUID from `business`, the audited support-session UUID from `session`, verifies that exact session with `tuinbooks_management_open_context_v5938`, validates business/session/status/expiry/read access, and then opens the requested workspace.
- Removed customer-facing `TuinBooks v2` and `Completely separate calendar frontend` copy from the sign-in screen.

## Automated verification

- Domain tests: PASS — 178 assertions
- Stress tests: PASS — 100-account/110-location v4 fixture; 200-client recurrence 1,408 visits; 10,000 invoices
- Release contract: PASS — 61 checks
- UI preservation contract: PASS
- XLSX round-trip: PASS
- Static module/asset validation: PASS — 96 JS module copies, 206 relative imports, 0 missing
- HTTP smoke: PASS — `/app`, mobile, `/management`, public document routes and assets HTTP 200

## Targeted regression guard

The release contract explicitly rejects the broken pattern where `support` is assigned directly as the business ID, and requires the original Management route contract (`support=1`, `business`, `session`) plus exact support-session verification.

## Deployment

No SQL/database change is required for R3. Deploy the complete release codebase. The Render build log must include:

`TUINBOOKS UI-RESTORED RELEASE R3: original Management + v2 application build published to /management/ + /app/.`

## Remaining verification

Actual live Management → account workspace opening must still be confirmed after deployment against the existing Supabase support-session RPCs. Automated/local checks do not substitute for that deployed browser test.
