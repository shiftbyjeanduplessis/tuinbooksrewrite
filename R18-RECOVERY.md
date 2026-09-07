# R18 recovery record

## Failure corrected
R17's build published a 451-byte shell as the active office `index.html`. Render therefore deployed a valid but visually bare application. The deployment platform was not the cause.

## R18 correction
The authoritative established TuinBooks office tree is now stored under `original-ui/app/` and copied verbatim to `dist/app/` during every build. The TypeScript rewrite is still compiled and tested, but is published only under `dist/rewrite/`.

This changes the cutover rule: the rewrite cannot become `/app/` again until the full office parity contract explicitly changes.

## Protected newer improvements
A late-loaded `r18-ui-parity-bridge.js` adds the small improvements that were intentionally kept from the rewrite work without replacing the established interface:
- street address on Schedule cards;
- visible drag visit ID;
- Service normally / Do not service toggle with visit/client scope;
- distinct service icons;
- visit/client Do not service visibility;
- Sunday support across the active schedule/import/mobile path;
- the R17 Settings → Recent activity reader, now injected into the established office Settings page.

## Database boundary
R18 does not require a new Supabase migration for the visual recovery. The restored office UI also carries the R17 Recent activity reader. If `supabase/APPLY-R17-AUDIT-LOG.sql` has not been applied, that one panel shows a clear unavailable message while the rest of Settings continues to work. The SQL is not represented as live-verified here.
