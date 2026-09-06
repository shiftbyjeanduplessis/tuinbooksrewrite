# TuinBooks UI-Restored Release R14

R14 restores useful visit detail to Schedule card clicks while keeping the clean, fast scheduler engine.

## Deploy
1. Run `supabase/APPLY-R14-VISIT-DETAIL.sql` in Supabase SQL Editor.
2. Copy the complete contents of this release into the `tuinbooksrewrite` repository.
3. Commit and push.
4. Render build proof line must be:

`TUINBOOKS UI-RESTORED RELEASE R14: visit work detail restored + simplified administrative actions published to /management/ + /app/.`

Do not run the optional legacy recurrence-adoption migration as part of this release.
