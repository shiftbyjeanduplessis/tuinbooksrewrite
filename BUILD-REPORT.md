# TuinBooks UI-Restored Release R18 — verification report

Purpose: correct the R17 packaging error that made the stripped rewrite shell the active `/app/` UI.

## Active build contract
- full established office product -> `/app/`
- established Management -> `/management/`
- TypeScript rewrite -> `/rewrite/` only
- root -> immediate redirect to `/app/`

## Protected parity carried into the restored office UI
- street address directly on Schedule cards;
- visible visit ID while dragging;
- literal `Service normally / Do not service` two-state control;
- visit-only vs client-wide Do Not Service scope;
- service icon chips and specific instructions in visit detail;
- Sunday as a seventh routine service day across schedule/import/mobile paths;
- mobile visibility of visit/client Do Not Service;
- R17 `Recent activity` reader in Settings, with graceful fallback if its SQL has not been applied.

## Exact local verification completed on the packaged source
`npm run check` — PASS
- domain tests: PASS — 178 assertions
- stress tests: PASS — 100 accounts / 110 locations; 200-client recurrence = 1,408 visits; 10,000 invoices
- release contracts: PASS — base V2 + R6/R8/R9/R10/R11/R12/R13/R14/R16/R17/R18
- TypeScript/build: PASS
- XLSX round-trip: PASS — 100-account v4 binary -> v2 -> generated v4 binary -> v2, 0 errors
- static references: PASS — 48 isolated rewrite modules, 106 relative imports, 0 missing
- local HTTP smoke: PASS — `/app/`, `/management/`, `/rewrite/` all HTTP 200
- active old-office script syntax/reference audit: PASS

Active generated office sizes after build:
- `dist/app/index.html`: ~151 KB (not the 451-byte R17 shell)
- `dist/app/app.js`: ~2.54 MB
- `dist/app/styles.css`: ~353 KB
- `dist/app/r18-ui-parity-bridge.js`: ~22 KB

## Verification boundary
These are local build/static/domain/stress checks. They do **not** claim a live Render browser session or Supabase database migration was executed from this environment. The R17 audit RPC SQL remains database-dependent; the restored Settings UI fails safely when it is absent.
