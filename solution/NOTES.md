# Notes

## Assumptions
<!-- What assumptions did you make that aren't stated in the brief? -->

## Tradeoffs
The data model optimises for **reversibility and auditability of identity decisions** at the cost of **richer modelling of identity itself** — the right call for an early-stage SCV where being wrong is the main risk. The specific concessions:

- **`Event.customer_id` is rewritten on merge.** Keeps timeline reads to a single indexed lookup, but the event row is no longer a pure historical fact — reconstructing who owned an event at time T requires the `Merge` table. The alternative (frozen `customer_id`, resolve through merge chains at read) preserves strict immutability at the cost of recursive joins on every customer query.
- **`(type, value)` is globally unique — one signal → one customer.** Makes lookup O(1) and prevents ambiguity, but forces a merge decision the moment two customers collide on a value. There is no "contested signal" state; the resolver must pick a winner immediately, even when the right answer is "wait for corroboration."
- **PII lives on signals, not on `Customer`.** Clean expiry/GDPR semantics and natural support for the multi-email case, but no canonical "primary email" without an additional rule layer (recency? source priority?), and every customer-facing read needs a join.
- **Single confidence enum (`deterministic | probabilistic`).** Cheap and legible, but coarse — `shopify_customer_id` and `email` are both "deterministic" despite different trust profiles, and there's no numeric score to threshold against. Upgrading later is a schema change.
- **`expires_at` is overloaded across signal types.** One column, different policy per type (null for platform IDs, 90 days for click IDs). Simple now; becomes a `CASE` statement in every query once a third policy appears.
- **No `Household` or group entity.** Shared-iPad is handled by *refusing* to merge probabilistic-only matches, not by modelling the household as a first-class thing. Correct for Phase 1; needs a new table the moment marketing wants household-level CLTV.
- **Warehouse portability prioritised over relational richness.** Flat tables, no ORM-specific types, JSON payload — lands cleanly in BigQuery/Clickhouse (the Phase 2 bet), but leaves value on the table in Postgres (no partial indexes on signal types, no DB-enforced enums beyond strings).
- **Backfill fidelity is capped by source-system data quality.** Signals not historically captured (e.g. `device_id` pre-SDK rollout) won't resolve as well as live events — historical profiles will be weaker than current ones. Accepted as a property of the input data, not something the model can fix.

## What I'd do differently with more time
<!-- What would change with a full production timeline? -->

- **First-class backfill and replay tooling.** Today, backfill reuses the live webhook path (relying on `(source, external_id)` idempotency) and replay leans on `Event` being append-only with `Customer`/`IdentitySignal`/`Merge` as derived state. Both work, but they're properties of the design rather than features — production would want a dedicated backfill worker, a replay harness, and `resolver_version` stamped on every `Merge` row so re-resolutions are auditable.
- **Real-time replay path.** Re-resolving 12 months of events is currently batch — measured in hours, not seconds. Fine for algorithm fixes, not for live operator workflows. A streaming replay would let operators trigger re-resolution from the internal tool and see the result inline.