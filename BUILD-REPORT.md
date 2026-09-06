# TuinBooks v2 — frozen single-codebase release candidate

## Status

Feature implementation: COMPLETE for the agreed v2 rebuild scope.
Deployment: NOT YET PERFORMED.
Real deployed browser/Supabase acceptance: PENDING.

## Exact final gate

`npm run check` on this exact folder:

- Domain: 178/178 assertions PASS
- Release contract: 35/35 checks PASS
- Stress: 100-account/110-location v4 model PASS
- Recurrence stress: 200 clients / 220 locations / 8 weeks = 1,408 visits PASS
- Billing stress: 10,000 invoices PASS
- Real binary v4 XLSX import -> export -> re-import: PASS, 0 errors
- TypeScript build: PASS
- Production route tree: `/app/` + `/management/` PASS
- Compiled static integrity: 94 JS module copies / 190 relative imports / 0 missing
- Forbidden legacy patterns: 0
- Static HTTP smoke: office + field/owner mobile + management + public documents PASS

## Deployment contents

- Complete source under `src/`
- Generated deploy tree under `dist/`
- Render blueprint: `render.yaml`
- Combined additive DB installer: `supabase/INSTALL-V2-CORE.sql`
- Optional legacy recurrence adoption bridge remains separate by design
- Full automated test suite under `tests/`

## Honesty gate

This report does NOT claim production readiness. The next authority is the deployed real-browser + real-Supabase acceptance run.
