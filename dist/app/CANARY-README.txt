TuinBooks v60.0.5 — Consolidation Canary — Schedule Stage 1B Operations

ADD/REPLACE THESE CANARY FILES INSIDE /app ONLY.
Production index.html, app.js and service-worker.js remain untouched.

Stage 1B adds to the canary Schedule:
- recurring move choice: This visit only / This + future visits
- multiple day instructions per team/date
- ad-hoc non-client events per team/date, optional time
- team-day items render before client jobs
- 56-day / 8-week recurrence PREVIEW using the canonical recurrence engine

CANARY SAFETY:
- 8-week maintenance is DRY-RUN in the canary. Opening it does not generate/remove recurring work.
- Saved day instructions/ad-hoc events and explicit schedule moves are real user edits.
