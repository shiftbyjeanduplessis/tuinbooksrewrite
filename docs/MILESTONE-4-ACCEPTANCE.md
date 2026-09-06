# Milestone 4 acceptance — real browser / QA business

Do not run against a live customer first.

1. Cold-open v2 Schedule; current week renders without console exception or failed required request.
2. Cancel one recurring visit with **do not charge**. Card remains visible as cancelled; reload preserves it; future recurrence is unchanged; billing metadata is `no-charge`.
3. Undo that cancellation. Reload; the same occurrence is scheduled again and no duplicate appears.
4. Cancel another recurring visit with **charge**. Reload; it remains cancelled and billing metadata is `charge`; future recurrence is unchanged.
5. Mark a visit missed. Reload; it remains missed.
6. Reschedule that missed visit to another date/team. Original remains as resolved/rescheduled history; exactly one linked replacement visit exists; reload does not duplicate either.
7. Suspend a recurring visit. Reload; it remains suspended and the horizon generator does not recreate a duplicate scheduled occurrence. Resume it and verify the same visit returns to scheduled.
8. Set **DO NOT SERVICE** on a client. Every visible visit for that client shows the warning; bookings remain on the calendar. Clear the warning and reload.
9. Add a day instruction for a specific team/day. It renders before client visits, persists after reload, can be edited and removed.
10. Add an ad-hoc event with title/time/detail. It persists on the correct team/day and can be edited/removed.
11. Re-run Calendar movement, Basket round-trip, resize, Additional Visit and recurrence-scope tests from Milestones 2–3. None may regress.
12. Final gate: zero unexplained page exceptions, failed application writes or missing required assets.
