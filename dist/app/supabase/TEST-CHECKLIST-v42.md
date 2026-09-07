# TuinBooks v42 Pilot Test

Run `migration-v42-operational-sync.sql` before deploying the v42 app.

## Database installation

1. Run the migration in Supabase SQL Editor.
2. Confirm `Success. No rows returned`.
3. Run this verification query:

```sql
select
  to_regclass('public.schedule_jobs') as schedule_jobs,
  to_regclass('public.work_records') as work_records,
  to_regclass('public.field_opportunities') as field_opportunities,
  to_regclass('public.quotes') as quotes,
  to_regclass('public.invoices') as invoices,
  to_regclass('public.client_reports') as client_reports,
  to_regclass('public.operational_meta') as operational_meta,
  to_regprocedure('public.complete_schedule_job(uuid,text,jsonb)') as complete_schedule_job,
  to_regprocedure('public.save_operational_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)') as save_operational_snapshot;
```

Every returned value must be non-null.

## Required cross-device pilot test

Use one owner/admin browser and one assigned field phone.

1. Admin creates a client and schedules that site for today.
2. Confirm the phone sees the booking without manually copying data.
3. Move the booking to another team/day and confirm the phone updates.
4. Move it back to the field phone's assigned team for today.
5. Field phone completes the visit with tasks, one photo and an extra.
6. Confirm the booking becomes completed on the admin calendar.
7. Confirm a compact Work Record appears on the admin screen.
8. Confirm the visit photo opens from the admin record.
9. Field phone records an opportunity with a photo.
10. Confirm it appears in the office opportunity queue with the correct reporting team.
11. Create a quote from the opportunity, sign out, sign back in, and confirm it remains.
12. Create an invoice draft, sign out, sign back in, and confirm it remains.

## Connection interruption test

1. Open a scheduled job on the phone.
2. Disconnect the phone from the internet.
3. Complete the visit.
4. Confirm the phone says the record is waiting to sync and the job does not reappear as unfinished.
5. Reconnect the phone.
6. Tap `Retry now` if automatic retry has not completed.
7. Confirm exactly one work record appears in the office.

## Permission test

1. A field user must only receive schedule jobs and work records for assigned teams.
2. A field account must redirect away from the desktop app.
3. Disabling the field user must block further access.
4. A field user must not be able to call the admin snapshot function.

## Pilot boundary

Keep the previous weekly schedule as a fallback during the first live week. Do not remove the fallback until the cross-device test above passes with real devices.
