# Schedule parity R5

R5 deliberately does not replace the new scheduler engine. It restores operational information and familiar TuinBooks affordances around it.

Restored / expanded:
- Week summary: visits, completed count, planned hours, Basket count, attention states and Do Not Service holds.
- Rich day headers with jobs, hours and capacity meter.
- Rich team labels with scheduled/completed counts and safe capacity context.
- Team/day cell counts and capacity meter.
- Route-order number on every visit card.
- Client name, street address and suburb visible directly on the card.
- Routine / Additional / Quoted / Once-off visual distinction.
- Recurrence, status and Do Not Service markers.
- Work/task summary on the card when available.
- `i` visit-information action with contact, task, notes, access notes, site instructions, recurrence, duration and Do Not Service details.
- Existing `...` operational visit actions retained.
- Basket summary and richer Basket cards, including quoted/extra distinction.
- Additional Visit insertion remains directly in each team/day lane.
- Drag Calendar <-> Calendar and Calendar <-> Basket, resize and recurrence scope remain on the clean v2 mutation path.

No old Schedule JavaScript was reintroduced.
