# TuinBooks UI-Restored Release R17

Purpose: package the restored product after the R17 parity pass, preserving the R16 visit-detail/DNS improvements and restoring an office-visible audit/activity history reader.

R17 additions:
- Settings now includes **Recent activity**, backed by the established `audit_events` history.
- `supabase/APPLY-R17-AUDIT-LOG.sql` adds an admin-only read RPC; it is additive and does not rewrite operational data.
- The UI degrades safely if the R17 SQL has not yet been applied.
- The parity contract explicitly protects Sunday as a valid routine service day.
- R16 remains intact: Service normally / Do not service is a literal reversible state; original-style service icons remain in visit detail.
- Schedule-card street address and the visible drag identifier remain protected by release contracts.

Verification performed while creating this package:
- Domain tests: PASS (178 assertions)
- Stress: PASS (100-account v4, 200-client recurrence / 1,408 visits, 10,000 invoices)
- Release/UI/Schedule contracts: PASS, including R17 parity/audit-log contract
- Build: PASS
- XLSX round-trip: PASS
- Static assets/imports: PASS
- HTTP smoke: PASS

Verification boundary:
- The R17 audit-log SQL has been statically validated and is included in the package, but it has NOT been executed against the live/staging Supabase database in this packaging session.
- Browser verification remains a deployment/QA step.
