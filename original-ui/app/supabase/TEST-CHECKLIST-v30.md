# TuinBooks v30 Users & Teams test

## Database

- Run `migration-v30-users-teams.sql` once in the existing Supabase project.
- Confirm the SQL Editor reports success.

## Owner/Admin

1. Sign in at `/`.
2. Open **Settings → Users & teams**.
3. Confirm the owner appears as active.
4. Create a Field access link with a real email and team.
5. Copy the link.

## Field account

1. Open the link in a private/incognito browser or on the field phone.
2. Create an account using the exact invited email.
3. Confirm the email if Supabase email confirmation is enabled.
4. Return to the same invitation link and sign in.
5. Confirm TuinBooks opens `/mobile.html`.
6. Confirm the assigned team selector is locked to the chosen team.
7. Sign out and sign in again directly at `/mobile.html`.

## Access changes

1. As owner, change the field user to another team.
2. Refresh/re-sign in on mobile and confirm the new team appears.
3. Disable the field user.
4. Confirm the user can no longer open an active business workspace.
5. Re-enable the user and confirm access returns.

## Role routing

- Field account opening `/` is redirected to `/mobile.html`.
- Owner/Admin opening `/mobile.html` is redirected to `/`.

## Known boundary

The weekly schedule is not cloud-backed yet. The field account and team assignment are real, but office-created bookings will not sync to the phone until the scheduling backend phase is completed.
