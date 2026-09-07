# TuinBooks v28 Supabase test checklist

## Connection and authentication

- Run `schema.sql` successfully in a new Supabase project.
- Enter the Project URL and Publishable/anon key.
- Create a new account.
- Confirm the account email if confirmation is enabled.
- Sign in and confirm that the onboarding wizard opens.
- Sign out and sign back in.

## First workspace

- Complete business details, first team and first service area.
- Refresh the page and confirm all three return from Supabase.
- Confirm the browser header shows a cloud-save state.
- Confirm Settings shows the connected account and role.

## Core records

- Add a client and refresh.
- Edit the client address, suburb, customer type and service area, then refresh.
- Add a second team and refresh.
- Add or edit a service-area cluster and refresh.
- Archive a client and confirm the status remains archived after refresh.

## Isolation

- Create a second Supabase Auth user without adding it to the first business.
- Sign in as the second user and confirm it cannot see the first business.
- Complete onboarding for the second user and confirm it creates a separate business.
- Check the Supabase Table Editor and verify every core row has the correct `business_id`.

## Failure handling

- Temporarily disconnect the internet, change a core record and confirm **Cloud save failed** is shown.
- Reconnect and use **Settings → Sync now**.
- Enter a deliberately incorrect key and confirm the app does not open the workspace.
- Confirm the UI rejects a service-role or `sb_secret_` key.

## Reset

- Use **Clear all business data** only in a test project.
- Confirm teams, clusters, customers and service sites are removed from Supabase.
- Confirm the onboarding wizard opens again.

## Current scope boundary

Schedules, work records, opportunities, quotes and invoices are not yet persisted in v28. Do not use this build as the live operating system until those phases are connected and tested.
