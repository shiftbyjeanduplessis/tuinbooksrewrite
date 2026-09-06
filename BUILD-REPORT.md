# TuinBooks UI-Restored Release R4

Purpose: preserve the established TuinBooks Management/UI while keeping the clean v2 internals.

R4 corrects the Management handoff authorization boundary:
- original Management creates an audited `tuinbooks_support_sessions` row;
- v2 RPCs now recognise an active, unexpired, full-scope support session for the same authenticated platform staff user and business;
- customer memberships are unchanged;
- no support membership is created;
- expired/revoked/non-full sessions do not receive v2 admin-write authority;
- runtime PostgREST errors now render their actual message instead of `[object Object]`.

Verification run after the change:
- Domain: PASS — 178 assertions
- Stress: PASS — 100-account v4; 200-client recurrence=1,408 visits; 10,000 invoices
- Release contract: PASS — 61 checks
- UI preservation contract: PASS
- Build/TypeScript: PASS
- XLSX round-trip: PASS
- Static route/import check: PASS
- HTTP smoke: PASS

Deployed browser verification remains required.
