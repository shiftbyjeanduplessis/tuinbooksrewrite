# TuinBooks Schedule R11

R11 makes Drag mode a dedicated rearrangement workspace rather than a duplicate of normal Calendar mode.

- Teams have distinct, restrained row accents.
- Normal mode: read/operate, visit information/actions, Note/Event/Additional Visit.
- Drag mode: operational controls are suppressed; Basket opens automatically; cards are planning-focused.
- Basket cards can only be dragged while Drag mode is active.
- Recurring visit moves ask **This visit** or **This + future** at the moment of drop.
- Basket placement RPC is hardened to reuse an existing source schedule row instead of failing on `schedule_jobs_pkey`.
- Street address and the visible drag ghost ID remain protected improvements.
