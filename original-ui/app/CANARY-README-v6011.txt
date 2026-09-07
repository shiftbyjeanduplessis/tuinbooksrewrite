TuinBooks v60.0.11 CANARY — operational action save permission fix

Before testing, run:
  TUINBOOKS-SQL-v60.0.11-OPERATIONAL-ACTION-PERMISSION.sql
in Supabase SQL Editor.

Then upload the canary files inside /app and open:
  /app/consolidation-v6011.html?support=1&business=...&session=...

Changes in this stage only:
- + Note has a direct click handler as well as delegated fallback.
- + Event uses the same direct editor path.
- saves use a new support-session-aware security-definer RPC.
- Management Mode must provide the exact session id from the URL and operational_edit=true.
- normal client owner/admin workspace remains authorised without a support session.
- mobile-v6011.html keeps Day Instructions as the first route item.
- production index.html/app.js/mobile.html/service-worker.js are untouched.
