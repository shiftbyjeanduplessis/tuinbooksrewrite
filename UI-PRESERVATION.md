# TuinBooks UI preservation contract

The existing TuinBooks product interface is the authority. The clean rewrite may replace implementation internals, but it must not redesign or strip established workflows unless explicitly requested.

## Preserved now

- Original Management HTML, CSS and JavaScript from the existing TuinBooks staging source.
- Original Management navigation: Accounts, Support activity, Trash.
- Original Management account setup, subscription, support-session and account lifecycle flows remain on the established Management RPC contract.
- Original office header treatment: full TuinBooks logo, business name, Schedule / Work / Clients / Quotes / Billing / Business navigation, Settings control and workspace state.
- Original TuinBooks terminology and page-heading language restored for Schedule, Work, Clients, Quotes and Billing.

## Rewrite boundary

The v2 domain/repository code remains responsible for Schedule, recurrence, Clients authority, Work/mobile, Billing, documents and import/export. The presentation layer must conform to TuinBooks rather than invent a replacement product.
