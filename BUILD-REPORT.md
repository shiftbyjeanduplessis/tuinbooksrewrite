# TuinBooks UI-Restored Release R15

Purpose: make both visit-specific and client-level Do Not Service states directly reversible from the visit dialog.

Local verification after the R15 change:
- Domain tests: PASS (178 assertions)
- Stress: PASS
- Release contracts: PASS, including R15 reversible-DNS contract
- Build: PASS
- XLSX round-trip: PASS
- Static assets/imports: PASS
- HTTP smoke: PASS

Browser verification of R15 remains pending deployment.
