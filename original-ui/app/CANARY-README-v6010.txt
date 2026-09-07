TuinBooks v60.0.10 canary — Schedule actions + mobile first note

CANARY ONLY. Does not replace production index.html, app.js, mobile.html or service-worker.js.

Desktop test page:
  /app/consolidation-v6010.html?support=1&business=...&session=...

Mobile test page:
  /app/mobile-v6010.html

Changes:
- + Note / + Event buttons on team-day calendar open a real editor.
- Actions persist through operational_actions_v59674 using the existing RPC with direct-upsert fallback.
- Multiple day instructions per team/day are supported.
- Saved instructions/events render before client jobs in the calendar.
- On mobile, today's day instructions are prepended before the first route/client item; events follow notes.
- Recurring move prompt and normal basket behavior retained from the v60 canary schedule work.
