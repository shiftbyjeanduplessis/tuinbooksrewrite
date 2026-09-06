# TuinBooks v2 — frozen single-codebase release candidate

## Status

Feature implementation: COMPLETE for the agreed v2 rebuild scope.
Deployment: NOT YET PERFORMED.
Real deployed browser/Supabase acceptance: PENDING.

## Exact final gate

`npm run check` on this exact folder:

- Domain: 178/178 assertions PASS
- Release contract: 43/43 checks PASS
- Stress: 100-account/110-location v4 model PASS
- Recurrence stress: 200 clients / 220 locations / 8 weeks = 1,408 visits PASS
- Billing stress: 10,000 invoices PASS
- Real binary v4 XLSX import -> export -> re-import: PASS, 0 errors
- TypeScript build: PASS
- Production route tree: `/app/` + `/management/` PASS
- Compiled static integrity: 94 JS module copies / 190 relative imports / 0 missing
- Forbidden legacy patterns: 0
- Static HTTP smoke: office + field/owner mobile + management + public documents PASS

## SQL installer correction

- SQLFIX1: v4 export route query now uses explicit aliases `day_name`, `week_label`, `stop_order`, and `row_json` instead of bare SQL-keyword-like aliases.
- `supabase/INSTALL-V2-CORE.sql` and `supabase/migration-v2-business-import-management.sql` were corrected together.
- The regression is now enforced by the release-contract test.

## Deployment contents

- Complete source under `src/`
- Generated deploy tree under `dist/`
- Render blueprint: `render.yaml`
- Combined additive DB installer: `supabase/INSTALL-V2-CORE.sql`
- Optional legacy recurrence adoption bridge remains separate by design
- Full automated test suite under `tests/`

## Honesty gate

This report does NOT claim production readiness. The next authority is the deployed real-browser + real-Supabase acceptance run.

## SQLFIX2 — live Management support-grant compatibility
- Corrected v2 Management SQL to use the deployed grant columns: `allow_operational_read`, `allow_operational_edit`, `allow_financial_read`, `allow_financial_edit`.
- New grant inserts now include the existing `reason` column.
- Corrected `is_business_admin` full-support check to use the live grant schema.
- Added release-contract regression checks for these live column names.
- Full `npm run check`: PASS (178 domain assertions; stress; 53 release checks; build; binary XLSX round-trip; static; HTTP smoke).
