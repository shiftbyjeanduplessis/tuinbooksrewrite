# TuinBooks v2 M8 — QA handoff

The code rebuild is complete; production confidence is not.

## Safe next sequence

1. Use a disposable/isolated TuinBooks QA business.
2. Back up/snapshot its current Supabase state.
3. Apply `supabase/APPLY-ORDER.txt` exactly.
4. Deploy `dist/` to a separate v2 QA URL/path; do not replace current customer staging yet.
5. First real-browser gate: Schedule only.
   - cold login/open
   - week navigation
   - Basket open/close
   - Basket → Calendar and Calendar → Basket
   - Calendar → Calendar drag without page auto-scroll
   - resize
   - reload persistence
   - This visit only / This + future
   - Additional Visit
   - cancellation charge/no-charge, undo
   - missed → reschedule
   - suspension/resume
6. Then Clients/agreements and rolling recurrence.
7. Then Field Mobile and Owner Mobile.
8. Then the exact v4 QA workbook import and round-trip export.
9. Then Quotes/Billing/Invoice/Payments/Statements.
10. Management/support-grant flows last.

A failed real-user acceptance item means the candidate is NOT READY even if `npm run check` remains green.
