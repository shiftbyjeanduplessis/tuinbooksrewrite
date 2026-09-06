# Milestone 1 acceptance — Calendar foundation

A PASS requires observable browser behavior, not source inspection.

1. Sign in with a QA office account.
2. Schedule becomes usable without loading Quotes/Billing/Work data.
3. Correct active teams appear.
4. Current week visits appear under the correct team/date.
5. Each card shows account name and address/suburb when the service location can be resolved.
6. Previous → Today → Next works repeatedly.
7. Drag one QA visit to another team/day.
8. During drag the page must not jump or call `scrollIntoView`.
9. Drop must move the card immediately.
10. Refresh. The moved visit must remain in the new position.
11. Simulate/force a failed write. The card must restore its previous position and show an error.
12. Browser console must contain no unexplained application exceptions or failed required assets/API calls.
13. Existing legacy TuinBooks remains untouched because v2 is deployed separately.

Milestone 1 is **not** a PASS for Basket/recurrence/Additional Visit; those are later gates.
