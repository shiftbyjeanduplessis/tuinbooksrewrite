# Schedule DNS reversible — R15

- Active visit-specific Do Not Service shows an immediate **Allow this visit again** action in the warning itself.
- Active client-level Do Not Service shows an immediate **Clear client DNS** action in the warning itself.
- Clearing either state uses the existing `active=false` mutation and does not alter recurrence, billing, or visit status.
- The generic Do not service action remains available as **Do not service settings** when a DNS state is already active, so scope can still be changed deliberately.
