# Milestone 3 acceptance — Recurrence authority

## Required before any production promotion

1. A mapped recurring card shows the recurrence indicator; a non-recurring / Additional Visit does not.
2. Drag a recurring visit and choose **This visit only**. Only that visit moves. Reload: it remains moved and the next automatic occurrence remains on the original pattern.
3. Drag the same recurring slot and choose **This + future visits**. The selected occurrence moves and later automatic occurrences for that slot follow the new weekday/team.
4. For a 2× weekly client (for example Monday + Thursday), change Monday **This + future** to Tuesday. Thursday must remain Thursday.
5. Attempt to move the Monday slot onto Thursday when the same series already has a Thursday slot. The change must be rejected without mutation.
6. Fortnightly cadence remains every 14 days after a future-pattern move.
7. Every-4-weeks cadence remains every 28 days after a future-pattern move.
8. Monthly recurrence follows the selected weekday + ordinal rule and falls back to the previous week when a fifth occurrence does not exist.
9. Past occurrences, completed visits and previous manual exceptions are not rewritten by **This + future**.
10. Move a recurring visit to Basket. Reload and extend the horizon. The same occurrence must NOT be recreated by rolling generation.
11. Move that Basket item back to Calendar. Reload: it remains a single manual exception linked to the original recurrence occurrence.
12. Load / refresh an 8-week horizon repeatedly. No duplicate `(series, slot, occurrence date)` may be created.
13. No unexplained console exception, failed v2 write RPC, or duplicate Schedule job is acceptable as PASS.

## Current local evidence

- Pure TypeScript domain recurrence tests: PASS.
- Full strict TypeScript compile: PASS.
- Local Chromium runtime: NOT VERIFIED in this container (headless Chromium stalls on the container DBus environment).
- Supabase recurrence SQL: generated and statically reviewed, NOT executed against any QA/live Supabase project from this environment.
