# R19 — Settings icon + Business control repair

R19 is intentionally narrow on top of the successful R18 visual restoration.

## Fixed
- The header Settings gear no longer uses corrupted mojibake text. It uses an encoding-safe numeric entity.
- Business > Needs attention now classifies recurring schedule rows through the application's canonical work-marker helper instead of assuming every routine row has `workKind=recurring` or `workMarker=R`.
- A valid preferred team is accepted even if a stale secondary team id is present.
- The Business control panel no longer destroys/recreates its DOM every 2.5 seconds when nothing changed, so expanded affected-record lists stay open and controls keep focus.
- Business control calculation failures degrade to a local warning panel instead of breaking the Business page.

## Preserved
No Schedule, Client, Work, Billing, cancellation, DNS, mobile, Management or R18 parity-bridge logic was rewritten.
