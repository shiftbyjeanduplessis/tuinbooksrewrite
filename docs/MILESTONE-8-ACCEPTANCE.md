# Milestone 8 acceptance — Business, v4 Import/Export, Management and final automated gates

## Implemented

### Business / Settings
- business name/contact/address
- Planning Only vs Planning + Financials mode
- VAT defaults
- invoice day, payment terms and prefix
- statement / WhatsApp defaults
- Week A anchor
- Teams with capacity + scheduling buffer
- single active Services list
- explicit per-domain RPC writes; no whole-app snapshot save

### v4 Import / Export
Exact sheet names:

1. `1 Business Info`
2. `2 Services`
3. `3 Teams`
4. `4 Clients Accounts`
5. `5 Service Locations`
6. `6 Needs Attention`
7. `7 Schedule Preview`
8. `8 Route Order`

Import is preview-first. A workbook with validation errors cannot be committed by the UI. Accounts remain separate from service locations. Recurrence and route-order fields are converted into the v2 agreement/recurrence model.

Export produces the same 8-sheet contract for round-trip use.

### Management
- separate `management.html` entry point
- platform-staff authentication authority retained
- business search and basic health counts
- explicit scoped/revocable support grants
- no business membership is created by a support grant

## Automated acceptance results

- Domain assertions: **162/162 PASS**
- Actual v4 binary fixture: **100 accounts / 110 service locations / 5 teams / 1 service / 165 route rows / 0 errors**
- Actual v4 binary → v2 → generated v4 binary → v2: **PASS with identical entity counts and all 8 sheets**
- Synthetic recurrence stress: **200 accounts / 220 locations / 8 weeks → 1,408 due visits**
- Billing aggregation stress: **10,000 invoices → deterministic totals PASS**
- Strict TypeScript build: **PASS**
- Compiled JS module integrity: **PASS**
- Forbidden legacy runtime scan: **PASS**
- Static HTTP smoke: **Desktop + Field Mobile + Owner Mobile + Management + JS/CSS all HTTP 200**

## Not accepted / not claimed

- Real browser clicking/dragging/visual interaction: **NOT VERIFIED in this container**.
- M8 or earlier v2 Supabase migrations installed in QA: **NOT DONE**.
- Real authenticated Supabase end-to-end writes: **NOT TESTED**.
- Existing customer migration/reconciliation: **NOT TESTED**.
- Production promotion: **NOT APPROVED**.

The next gate is therefore not more feature development. It is QA deployment of the additive migrations to an isolated Supabase QA business, followed by real-browser acceptance of the exact user workflows.
