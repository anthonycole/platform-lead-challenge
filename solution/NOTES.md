# Notes

## Assumptions

These are decisions the brief and `CONTRACTS.md` left open, where I made a call:

* **Deterministic signals outvote probabilistic ones** — a lone `device_id` only matches when no deterministic signal did, so a shared device can't silently merge two people.
* **Oldest customer wins a merge** — the earlier-created `Customer` stays canonical; the brief doesn't specify a winner.
* **`(type, value)` is globally unique** — one signal maps to one customer, with no "contested" state (see Tradeoffs).
* I've built in the browser_fingerprint, app_user_id, fbclid, gclid analytics codes despite them not being a requirement. In my experience it's good to get this data in earlier rather than later.
* I note that customer names are not included and have intentionally left that out.


## Tradeoffs
* The data model optimises for **reversibility and auditability of identity decisions** over richer modelling of identity
* Merging rewrites `Event.customer_id` for fast reads but every merge writes a row to the `Merge` table recording what triggered it, so any decision can be reconstructed and undone. 
* To keep lookups O(1), `(type, value)` is globally unique — one signal maps to exactly one customer — which is fast and unambiguous but forces a merge decision the instant two customers collide on a value, with no "contested" state to fall back on. 
* Where the matching evidence is only probabilistic, the resolver declines to merge rather than guess; shared-device cases are handled by refusing the merge instead of introducing a `Household` entity initially. 
* The identity data itself is deliberately thin. PII lives on signals rather than on `Customer`, so a customer can carry multiple emails cleanly — at the cost of a join on every customer-facing read and no canonical "primary" value without an added rule. *
* Confidence is a binary enum (`deterministic | probabilistic`) rather than a numeric score: legible and auditable today, where a score or source-weighted trust would be more expressive but needs calibration data we don't yet have. Underpinning all of it, the schema favours warehouse portability over relational richness — flat tables, JSON-as-text payloads, no DB-enforced enums — so it lands cleanly in BigQuery or Clickhouse (the Phase 2 bet), trading away Postgres niceties like partial indexes.

## What I'd do differently with more time
* Backfill and replay both work today, but only as properties of the design — the idempotent webhook path and the append-only `Event` log.
* `resolver_version` is already stamped on every `Merge` row so re-resolutions are auditable; with a production timeline I'd make backfill/replay first-class with a dedicated worker rather than relying on them as emergent properties of the design.
* More thought and progress due dilligence on build vs buy and TCO
* More work around activation and marketing; build out the "We missed you" campaign plan.
* CI/CD Pipelines.