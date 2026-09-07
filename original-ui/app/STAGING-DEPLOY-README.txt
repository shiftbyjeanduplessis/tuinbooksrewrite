TUINBOOKS CLEAN STAGING DEPLOY â€” v60.8.3
==========================================

PURPOSE
-------
Standalone Render staging site for automated QA.
This package intentionally contains only:
- /app        authoritative application tree
- /management current management tree (included: YES)
- root index.html redirect to /app/
- robots.txt blocking search indexing

It does NOT include:
- /3D Objects
- root-level historical app.js/index copies
- V55/V58/V59 deployment notes
- old migration notes at repository root
- test artefacts or unrelated personal files

RENDER STATIC SITE SETTINGS
---------------------------
Root Directory: leave blank
Build Command: leave blank
Publish Directory: .

Expected URLs:
- https://YOUR-STAGING.onrender.com/
- https://YOUR-STAGING.onrender.com/app/
- https://YOUR-STAGING.onrender.com/management/   (only if included)

IMPORTANT DATA WARNING
----------------------
This builder preserves app/supabase-config.js exactly from the source tree.
If that file points at PRODUCTION Supabase, the staging frontend will also talk
to production data. Do not let an automated QA agent perform destructive/write
tests until you have either:
1. pointed staging at a dedicated staging Supabase project, or
2. restricted the test account and test plan to safe/non-destructive actions.

FIRST CHECK
-----------
1. Deploy this ZIP as the complete staging site, not as an overlay.
2. Open / and confirm it redirects to /app/.
3. Confirm login renders.
4. Confirm /management/ renders if management is included.
5. Only then point Playwright at staging.
