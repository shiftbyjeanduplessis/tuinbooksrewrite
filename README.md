# TuinBooks v2 — final single codebase

This is the clean TuinBooks v2 rebuild. It does not load the legacy `app.js` or Schedule hotfix chain.

## Deploy surfaces

- `/app/` — office TuinBooks
- `/app/mobile.html` — Field / Owner Mobile
- `/management/` — platform Management
- `/app/accept.html` — secure quote response
- `/app/document.html` — secure invoice / statement view

## Build

```bash
npm install
npm run check
```

Render configuration is included in `render.yaml`. The build publishes `dist/` only after the full gate passes.

## Supabase

The existing Supabase project is retained.

Default additive installer:

`supabase/INSTALL-V2-CORE.sql`

This includes the eight required v2 migrations in dependency order. The conservative legacy recurrence adoption bridge remains separate:

`supabase/migration-v2-optional-adopt-legacy-recurrence.sql`

Do not silently run the optional adoption bridge against production data.

## Current verification

- 178/178 domain assertions PASS
- 35/35 release-contract checks PASS
- 200-client recurrence stress PASS
- 10,000-invoice stress PASS
- exact binary v4 workbook round-trip PASS
- TypeScript/static/HTTP build gates PASS

Real deployed browser + real Supabase acceptance is still required before production approval.
