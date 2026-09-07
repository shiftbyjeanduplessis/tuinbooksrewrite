# TuinBooks v54 release-gate checklist

For an existing project, re-run `migration-v42-operational-sync.sql`, then run
the v53 and v54 migrations in order. The v42 re-run repairs the slimmer invoice
table used by early pilots. Back up the project where the plan permits. Do not
use the package live until every release gate below passes against the real
project and at least one real field phone.

## Database verification

Every value in the first query must be non-null. The second query must return
the three v54 invoice indexes and must not return the old one-active-invoice
index.

```sql
select
  to_regprocedure('public.reserve_invoice_number_v54(uuid,text)') as invoice_number,
  to_regprocedure('public.complete_schedule_job_v54(uuid,text,jsonb)') as visit_outcome,
  to_regprocedure('public.create_unscheduled_work_record_v54(uuid,jsonb)') as unscheduled_work,
  to_regprocedure('public.create_field_opportunity_v54(uuid,jsonb)') as opportunity,
  to_regprocedure('public.set_work_record_photos_v54(uuid,text,text[])') as photos,
  to_regprocedure('public.create_field_client_v54(uuid,jsonb,jsonb,text)') as field_client,
  to_regprocedure('public.load_field_workspace_v54(uuid)') as field_workspace,
  to_regclass('public.mobile_pairing_attempts_v54') as pairing_attempts;

select indexname
from pg_indexes
where schemaname='public' and tablename='invoices'
order by indexname;
```

## Billing and document identity

1. Approve a once-off quote without completing its linked scheduled job. It
   must not appear in Billing Review.
2. Complete the linked job. The quote lines must appear once.
3. Send an invoice, then record a new priced-extra candidate in the same month.
   A supplemental draft with a distinct `:S2` batch must appear.
4. Open two administrator browsers and prepare different invoices. Start both
   sends at nearly the same time. Their invoice numbers must be different.
5. Create a credit note. It must have its own number and billing batch key and
   remain linked to the original invoice.
6. Duplicate a source key or remove a source visit while a draft is open. The
   draft must remain blocked from `Ready` and sending.

## In-flight autosave

1. Throttle the browser network to Slow 3G.
2. Change a client, wait until `Saving…`, then make another change before the
   first request completes.
3. Wait for the saved state, reload, and confirm both changes remain.
4. Repeat with a schedule edit while operational saving is in progress.
5. Repeat from two office browsers. A stale browser must show a conflict and
   must not overwrite the newer data.

## Pairing and field isolation

1. Generate a code. Confirm it is 10 hexadecimal characters, expires after 15
   minutes and works once only.
2. Enter invalid codes repeatedly. After ten attempts in 15 minutes, pairing
   must remain locked for that attempt window.
3. While signed in as an owner or administrator, try to claim a field code.
   The existing role must remain unchanged.
4. Create two teams with different customers. Pair one phone to each team.
5. On Team A's phone, confirm Team B customers, sites, schedules and photos are
   absent. Direct selects of business settings and other-team rows must also
   return no rows.

## Durable field work and offline reload

1. Load today's route online, then close and reopen the field page while fully
   offline. The cached route must open with an offline message.
2. Save a visit with a photo, an opportunity and a new client while offline.
   All three must increase the stored-on-phone count.
3. Attempt to unpair. TuinBooks must block it while any item is unsynced.
4. Restore the connection. All valid items must sync exactly once.
5. Force one queued item to fail validation and place a valid item after it.
   The valid item must still sync; the failed item must remain marked as needing
   attention.
6. Confirm every successful field write increments `operational_meta.revision`.

## Outcomes, multi-site and historical teams

1. Record each outcome: Completed, Partially completed, Access failed, Weather
   delay and Unable to complete. Confirm schedule status and office history are
   accurate.
2. Failed access, weather delay and unable work must not become billable.
   Partial work must create a blocked office-review billing line.
3. Give one customer two service sites, edit another customer and save. Both
   service sites must still exist after reload.
4. Remove a team that owns historical schedules/work. It must become inactive,
   remain hidden from new scheduling and preserve the historical records.

## Local automated checks

```sh
node --check app/app.js
node --check app/service-worker.js
node app/tests/v53-unit-tests.js
node app/tests/v54-regression-tests.js
```

## Boundary

The Sage connector is still a later 2.0 project. v54 safely prepares and
exports billing data; it does not post official invoices, payments or journals
into Sage.
