# Milestone 5 acceptance — Clients, locations, agreements

## Status gates

A candidate may only be called browser-verified after these are exercised in a real authenticated QA business. Static/type/domain checks are not substitutes.

1. Open **Clients** from Schedule. Returning to Schedule must retain a normal clean load and must not introduce console errors.
2. Search by client name, street address and suburb. Results must come from the separate Account + Service Location records.
3. Create an Account with contact details. Reload; it must persist once and must not create a service location implicitly.
4. Add two Service Locations to the same Account. Reload; both remain attached to the same Account with their own address/access/instructions.
5. Edit one Service Location. The other location and Account contact/billing identity must remain unchanged.
6. Create a Draft Service Agreement. It must not generate calendar visits.
7. Activate a weekly agreement for one weekday. A v2 recurrence series/version is created and rolling visits appear only for that location/team/day.
8. Activate a 2× weekly agreement. Both weekday slots appear; changing one calendar slot with **This + future** must not move the other slot.
9. Edit an active agreement. Past visits, completed visits and manual exceptions remain unchanged. Unprotected future auto-occurrences from the superseded version are replaced from the effective date.
10. End an active agreement. No new recurrence version is created. Existing historical visits remain queryable.
11. Attempt to link an agreement to another account's service location. Backend must reject it.
12. Cold reload and repeat Clients → Schedule → Clients. No duplicate accounts, sites, agreements or visits.

## Performance expectations

- Clients workspace shell should render immediately after navigation; network data fills asynchronously.
- Search filtering should feel immediate (<100 ms at 500 accounts in browser profiling).
- Account/location/agreement save is one explicit RPC each; no whole-app snapshot save.
