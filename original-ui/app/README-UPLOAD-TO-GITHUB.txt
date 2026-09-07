GITHUB /app CLEANUP

Upload/replace these three files in the existing GitHub /app folder:
- app.js
- service-worker.js
- VERSION.txt

The following files were accidental patch-helper files from the previous bundle.
They are not used by the live app. Delete them from GitHub /app if they are still there:

- apply_calendar_history_v59660.py
- apply_work_team_restore_v59659.py
- calendar-one-month-history-v59660.js
- work-team-board-restore-v59659.js
- VERIFY-IN-BROWSER.js
- STATIC-TEST-RESULTS.txt

You do NOT need SQL.

After committing the changes, let Render deploy normally from GitHub.
Then hard-refresh the browser.
