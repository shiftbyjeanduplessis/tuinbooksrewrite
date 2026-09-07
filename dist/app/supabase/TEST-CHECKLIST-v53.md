# TuinBooks v53 release-gate checklist

Run `migration-v53-pilot-tightening.sql` before testing.

## Database verification

Run this query in Supabase SQL Editor. Every function and table value must be
non-null, and both revision columns must exist.

```sql
select
  to_regclass('public.schedule_jobs') as schedule_jobs,
  to_regclass('public.work_records') as work_records,
  to_regclass('public.field_opportunities') as field_opportunities,
  to_regclass('public.operational_meta') as operational_meta,
  to_regprocedure('public.complete_schedule_job(uuid,text,jsonb)') as complete_schedule_job,
  to_regprocedure('public.save_core_snapshot_v53(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,bigint)') as save_core_snapshot_v53,
  to_regprocedure('public.save_operational_snapshot_v53(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,bigint)') as save_operational_snapshot_v53,
  to_regprocedure('public.set_work_record_photos_v53(uuid,text,text[])') as set_work_record_photos_v53,
  to_regprocedure('public.create_mobile_access_code(uuid,text,text)') as create_mobile_access_code,
  to_regprocedure('public.claim_mobile_access_code(text,text)') as claim_mobile_access_code;

select column_name
from information_schema.columns
where table_schema='public'
  and ((table_name='businesses' and column_name='core_revision')
    or (table_name='operational_meta' and column_name='revision'));
```

## Critical cross-device tests

1. Enable anonymous sign-ins in Supabase Auth for field-device pairing.
2. Generate a field-phone code and pair a fresh private/incognito browser.
3. Confirm the code works once, rejects a second claim, and expires after 15 minutes.
4. Create and schedule a test client from the owner app.
5. Confirm the assigned field phone receives the job.
6. Complete it once with tasks, an extra and a photo.
7. Confirm exactly one work record appears and the schedule becomes completed.
8. Try to open/complete the same scheduled job again. It must not create a
   second work record.
9. Confirm the photo opens from the office work record.
10. Submit an opportunity and confirm it appears in the office queue.

## Offline outbox test

1. Open a scheduled job, then disable the phone's connection.
2. Complete the visit with a small photo.
3. Confirm the phone says the item is saved on the phone and waiting to sync.
4. Reload the field page while still offline; the waiting count must remain.
5. Restore the connection and leave the page open for up to 30 seconds.
6. Confirm the waiting count returns to zero and exactly one work record exists.

## Recurrence test

1. Create a fortnightly Monday client anchored on a known Monday.
2. Generate the anchor week, following week and second following week.
3. Confirm the client is due only in the first and third weeks.
4. Create a monthly client anchored on a fifth occurrence of its weekday.
5. Confirm a month without a fifth occurrence schedules it on the last matching
   weekday rather than omitting the client.

## Concurrent-office test

1. Open the owner app in two separate browsers as admins.
2. Save a schedule change in browser A.
3. Without refreshing browser B, make and save a different schedule change.
4. Browser B must report a newer-change conflict; it must not overwrite A.
5. Repeat with a client/setup change to exercise the core revision check.

## Billing-draft test

1. Open a client's billing draft after its first completed visit.
2. Complete another visit with an extra during the same month.
3. Reopen Billing Review. The existing draft must include the new extra once.
4. Reopen the view repeatedly; the extra must not duplicate.
5. Confirm an unpriced extra blocks `Ready` status.
6. Confirm the database rejects a second active invoice for the same client and
   month and rejects a reused non-draft invoice number.

## Release boundary

The Sage connector is not part of v53. `Billing Review` still prepares the
billing information; it does not automatically create an official Sage invoice.
