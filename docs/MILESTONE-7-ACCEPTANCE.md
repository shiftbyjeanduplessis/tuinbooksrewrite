# Milestone 7 — Quotes + Billing acceptance

## Product contract
- Quotes are separate from Additional Visits.
- Accepted quotes may be placed into the Schedule Basket as quoted work.
- Billing reads visit facts; it does not infer work from UI state.
- Routine monthly billing uses the active Service Agreement monthly fee.
- Additional Visits and chargeable cancellations are priced later in Billing, never on the Calendar.
- Cancel — no charge never becomes billable.
- A visit may not appear on two active invoices.
- Issued invoices are immutable; payments/reversals are separate events.
- Partial payments remain visible until fully paid.
- Statements are derived from issued invoices and active payments.
- Owner Mobile Money/Quotes are read-only summaries.

## Browser acceptance required before deployment
1. Create/edit a draft quote with multiple lines; VAT/total must calculate correctly.
2. Prepare quote via Email and WhatsApp; mark sent; mark accepted; send accepted quote to Basket; refresh and prove it remains one Basket item.
3. Complete a routine visit, an Additional Visit and a chargeable cancellation. Leave one cancellation no-charge.
4. Billing Review must show the first three as billable and exclude no-charge.
5. Enter an amount for Additional/cancellation in Billing. Calendar must never ask for it.
6. Create draft invoice from Billing Review. Routine monthly service appears once from agreement monthly fee; linked visits cannot be invoiced again.
7. Edit Draft/Ready invoice; assign invoice number; mark Ready then Sent. After Sent, line editing must be blocked.
8. Record a partial payment, reload, record final payment, reload; balance and status must stay correct.
9. Reverse a payment; balance must reopen without altering the invoice body.
10. Statement balance must equal invoice debits less active payments.
11. Email/WhatsApp invoice and statement handoff must open the correct client recipient with correct totals.
12. Owner Mobile Quotes and Money must load without exposing edit controls.
13. Schedule, Work, Clients and mobile completion regression smoke must remain unchanged.

## Not claimed by static/domain tests
- Real browser interaction has not been verified in this container.
- No Supabase M7 migration has been executed.
- Email/WhatsApp are client-app handoffs, not background server delivery or PDF attachment automation.
