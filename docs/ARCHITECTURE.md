# Architecture contract

## Hard rules

1. One owner for each domain operation.
2. No global `window.*` feature overrides.
3. No MutationObserver used to repair application state or layout.
4. No recurring polling used to make a page become correct.
5. No "loaded last wins" authority files.
6. UI renders from typed domain state; it does not rewrite DOM after render.
7. Supabase compatibility quirks live only inside repositories/adapters.
8. A failed write rolls optimistic UI back and displays the actual error.
9. Schedule loads the requested date window only.
10. Previously fixed acceptance scenarios become permanent regression tests.

## Canonical runtime model

Business → Account → Service Location → Service Agreement → Visit → Completion/Cancellation → Billing.

The existing database uses `customers` for Account and `service_sites` for Service Location. That naming difference is isolated at the repository boundary.

## Schedule ownership

- `domain/schedule.ts`: pure business/state transformations.
- `features/schedule/scheduleRepository.ts`: Supabase read/write adapter.
- `features/schedule/Calendar.tsx`: calendar rendering + one pointer-drag owner.
- `features/schedule/SchedulePage.tsx`: page orchestration and optimistic persistence.

No other file is allowed to move or render visits.

## Milestone 3 recurrence authority

Recurring work is not inferred from client ID or from whatever future jobs happen to exist.

The authority is:

`ScheduleSeries -> ScheduleSeriesSlot -> ScheduleOccurrence -> schedule_jobs`

- **Series** owns client/site and cadence (`weekly`, `fortnightly`, `four-weekly`, `monthly`).
- **Slot** owns one repeating service position: weekday, default team, duration and services. A 2× weekly agreement has two slots; 3× weekly has three.
- **Occurrence** is the durable identity of one due recurrence. It survives Calendar -> Basket -> Calendar and records manual exceptions.
- **schedule_jobs** remains the actual operational visit used by existing Work/Mobile/Billing systems.

`This visit only` changes the Schedule job and marks its occurrence as a manual exception. `This + future` changes only the selected slot and regenerates future automatic occurrences for that slot. Other slots, past work, completed work and previous manual exceptions are not rewritten.
