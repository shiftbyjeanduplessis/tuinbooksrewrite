# Performance contract

Targets to validate in browser QA:

- Returning session → usable shell: target < 1.5 s on normal broadband.
- Cold login → usable Schedule: target < 3 s excluding user credential entry.
- Click/selection feedback: < 100 ms perceived.
- Week switch: target < 500 ms after request reaches application; old week must not blank the whole shell.
- Drag start: immediate, no native browser drag image, no `scrollIntoView`.
- Dragging: pointer-following only; no forced page scroll caused by application code.
- Drop: optimistic immediate placement; Supabase save occurs after visual update.

Milestone 1 instrumentation logs `[TuinBooks v2] Week ready in Nms` to the browser console.
