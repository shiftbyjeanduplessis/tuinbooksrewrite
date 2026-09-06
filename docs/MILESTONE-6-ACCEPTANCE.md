# Milestone 6 acceptance — Work + Field Mobile + Owner Mobile

## Desktop Work
- Work opens as its own workspace; no Schedule renderer owns it.
- Date navigation loads one operational day only.
- Each team shows total/completed/attention/remaining progress from authoritative visit status.
- Team day instructions/events appear before route rows.
- Visit rows show R/A/Q type, account, street address/suburb, task summary and current outcome.
- Active Do Not Service holds are visible on the affected visit.
- New field opportunities are surfaced under Needs attention.
- Opportunity photos open through short-lived signed URLs from the private `tuinbooks-media` bucket.

## Field Mobile
- Uses separate `mobile.html` / `mobileApp.ts`; desktop app code is not loaded.
- Existing paired field phones resolve only their assigned active team(s).
- A not-yet-paired field phone can use the existing four-digit field pairing RPC.
- Route order follows `sort_order` and does not expose drag/rearrange controls.
- Day instruction/event appears before visits.
- Visit shows account, street address, suburb, tasks, access notes and instructions.
- Do Not Service is a prominent warning and is not treated as completion/cancellation.
- Completion requires a task checklist; failed/declined tasks require a reason.
- Completion may include visit note and photos.
- Completion is idempotent by submission receipt and unique work-record-per-schedule contract.
- Opportunity reporting supports Lawn / Plants / Irrigation / Trees / Upgrade / Other, note and photos.

## Owner Mobile
- Authenticated owner/admin resolves to Owner Mobile.
- Owner sees all active teams and can navigate previous/today/next work days.
- Owner may complete an individual visit for any team.
- Owner has no drag/rearrange scheduler on mobile.
- Owner Clients is read-only and searches account/address/suburb.
- Quotes and Money remain disabled until Milestone 7.

## Demo / safety
- `mobile.html?demo=field` exercises Field Mobile without writes.
- `mobile.html?demo=owner` exercises Owner Mobile without writes.
- Desktop `?demo=1` remains write-free.
- `migration-v2-work-mobile.sql` is generated only; do not run merely to inspect demo.

## Production approval still requires
1. Run all v2 migrations in a disposable QA Supabase business in order.
2. Pair a fresh QA field browser using a QA team PIN.
3. Confirm field mobile can see only the assigned team.
4. Complete one visit with mixed task outcomes and a photo; reload desktop Work and verify exact durable result.
5. Report an opportunity with a photo; verify it appears in desktop Work and photo opens.
6. Set Do Not Service on a QA client; verify warning on desktop and field mobile without deleting the scheduled visit.
7. Sign into Owner Mobile; verify all teams, read-only planning and completion across a different team.
8. Double-submit / refresh during completion; prove one work record only.
9. Verify no unexplained console errors, failed application requests or cross-business data leakage.
