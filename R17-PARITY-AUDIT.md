# R17 parity audit handoff

## Preserved product behaviour
- R16 Service normally / Do not service remains a true reversible state.
- Visit detail keeps the original-style service icon language.
- Schedule cards retain street address.
- Rearrange/drag retains the visible visit identifier.
- Sunday remains a supported routine service day (weekday 7).
- Existing R8–R14 schedule/basket/missed-visit/group-drag contracts remain active.

## R17 remediation
The rebuilt v2 already writes operational/admin changes to `public.audit_events`, but there was no office-facing reader. R17 adds a Recent activity panel in Settings and the additive admin-only RPC `tuinbooks_v2_list_audit_log_r17`.

## Verification boundary
All local automated tests/build/static/HTTP checks pass. The R17 SQL is included but was not executed against a Supabase database in this packaging session. The UI deliberately reports that the activity-log bridge is not installed instead of breaking Settings if the RPC is absent.
