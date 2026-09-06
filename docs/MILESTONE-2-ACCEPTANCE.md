# Milestone 2 acceptance — Calendar interaction engine

Run in `?demo=1` before any QA database migration.

1. Basket is a real left column. Close/open it repeatedly; Calendar width adapts without overlaying cards.
2. Drag a Calendar card into Basket. It disappears from the cell and appears once in Basket.
3. Drag that Basket item back to another team/day. It appears once in the destination and leaves Basket.
4. Drag a Calendar card to another team/day. No page jump or automatic scroll occurs.
5. Drag the bottom handle of a visit. Duration changes in 15-minute increments between 15 and 480 minutes.
6. Click `+ Additional visit` between two route cards. The dialog must not ask for date, team, billing or duration.
7. Select an existing active client, add task/notes, save. A blue `A` visit appears at the clicked route position with `Duration unset`.
8. Resize the new Additional Visit; duration becomes explicit.
9. Previous / Today / Next / Refresh continue to work after the actions above.
10. No console exception is acceptable.

Live QA additionally requires `supabase/migration-v2-schedule-mutations.sql` to be installed first.

## Deliberately NOT in Milestone 2

`This + future visits` is not yet enabled. The old backend does not expose a safe single-series recurrence mutation contract for every supported pattern (especially multi-day weekly patterns). Milestone 3 will establish that authority instead of guessing from client IDs or legacy payloads.
