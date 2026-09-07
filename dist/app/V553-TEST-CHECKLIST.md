# TuinBooks v55.3 — Staging Test Checklist

## A. Existing app regression

- Sign in as owner/admin.
- Confirm the four-team scheduler still loads.
- Open a route and visit workspace.
- Confirm photos and Opportunity Spotter still work.
- Confirm Catch-up Queue opens.
- Confirm Capacity & Commitments loads.
- Confirm Billing Review and Work Records load.
- Run the training-demo reset and confirm the tenant remains correct.

## B. Marketing eligibility

Create or inspect clients representing each case:

- active, valid WhatsApp number, permission recorded;
- no permission;
- explicit opt-out;
- invalid number;
- duplicate number;
- inactive/paused client;
- contacted inside the cooldown period.

Confirm only the first case becomes an eligible paid recipient. Confirm filters work for service, client type, cluster and language.

## C. Capacity-aware campaign

- Build an audience.
- Select a service and fulfilment window.
- Change likely response rate and duration.
- Confirm likely bookings, required hours and suitable capacity update.
- Create an over-capacity scenario.
- Confirm a resolution/override reason is required before saving.
- Save a covered campaign draft.
- Approve the draft.
- Confirm sending remains blocked when WhatsApp/approved templates are not configured.

## D. Accepted reply to work

- Record an accepted offer.
- Link it to the next visit.
- Confirm the service appears on that visit.
- Record another acceptance as a separate job.
- Confirm it appears on the schedule.
- Record one as office follow-up.
- Confirm the original campaign, response and work link remain connected.

## E. Vehicles and mileage

- Add a vehicle.
- Assign it to a team.
- Record realistic working L/100 km.
- Save route/fuel settings.
- Create a route log with planned km.
- Enter beginning and ending odometers.
- Confirm actual km equals ending minus beginning.
- Confirm estimated litres and fuel cost are correct.
- Confirm cost per visit uses the saved visit count or matching schedule.
- Edit the same team/date route and confirm it updates rather than duplicates.
- Enter an ending odometer below the start and confirm save is blocked.

## F. Route estimates

- Test with business base and all client coordinates present.
- Confirm a planning estimate is shown and identified as a straight-line minimum.
- Remove one coordinate and confirm the configured fallback is used.
- Remove coordinates and fallback and confirm the app honestly reports no estimate.
- Treat odometer data as the actual record in every case.

## G. Reports

- Open Reports for a month with campaign and route data.
- Confirm campaign count and recipients.
- Confirm accepted and completed campaign value.
- Confirm actual mileage and estimated fuel cost.
- Confirm no duplicate report panel or duplicate HTML ID exists.

## H. Permissions and tenant isolation

Using two businesses and separate users:

- Tenant A cannot read Tenant B campaigns, recipients, responses, vehicles or route logs.
- Field users cannot send campaigns or edit fleet records.
- Owner/admin can manage marketing and operations.
- An explicit opt-out cannot be re-enabled by a casual field action.
- No frontend request exposes the Supabase service-role key or Meta token.

## I. Real WhatsApp setup only

After server-side configuration:

- Connect a test WhatsApp Business number.
- Load one approved Meta template.
- Send to a tiny internal/test audience.
- Confirm recipient revalidation at send time.
- Confirm sent, delivered, read and failed statuses return through the webhook.
- Confirm button/reply response is linked to the correct recipient and campaign.
- Confirm STOP/opt-out is honoured before any later send.
- Reconcile estimated message cost against Meta billing separately.

Do not use a production client audience until every section above passes.
