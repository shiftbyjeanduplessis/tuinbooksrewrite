# TuinBooks UI-Restored Release R19 — verification report

Purpose: narrow repair on top of the successful R18 full-office restoration.

## Fixed in R19
- Header Settings gear is encoding-safe (`&#9881;`), replacing the corrupted `âš™` text.
- Business > Needs attention now classifies routine schedule rows through the canonical work-marker helper.
- Business control accepts either valid team-assignment field instead of failing on a stale secondary id.
- The Business control panel no longer destroys/recreates unchanged DOM every 2.5 seconds, so open affected-record details and control focus remain stable.
- Business control calculation failure is contained inside the panel instead of breaking the Business page.
- Service-worker cache/version is bumped to R19 so the repaired icon/script cannot remain hidden behind R18 cache.

## Preserved
The R18 restored office product remains the production `/app/`. Schedule, Work, Clients, Billing, Management, cancellation/billing logic, DNS controls, Sunday support, address-on-card, drag ID and audit reader were not rewritten.

## Exact local verification on this source
`npm run check` — PASS
- domain: PASS — 178 assertions
- stress: PASS — 100 accounts / 110 locations; 200-client recurrence = 1,408 visits; 10,000 invoices
- release contracts: PASS — includes R19 Settings/Business-control contract
- build: PASS
- XLSX round-trip: PASS
- static references: PASS
- HTTP smoke: PASS — `/app/`, `/management/`, `/rewrite/` HTTP 200
- repaired Business-control JS syntax: PASS
- repaired service-worker JS syntax: PASS

Expected Render proof line:
`TUINBOOKS UI-RESTORED RELEASE R19: Settings icon + Business control repaired on full established office UI.`

## Verification boundary
Local automated verification cannot prove the exact live business data shown by Render/Supabase. R19 corrects the code paths identified in the deployed R18 source and preserves the working R18 product surface.
