# Implementation Plan — Rolling Out the Single Customer View

## 1. What this plan is for
Two mechanisms carry the whole thing:

- **Gradual delivery** — the resolver earns trust in stages (shadow → canary →
  enforced), and each stage has an explicit gate it must pass before the next.
- **Continual evaluation** — a standing review of merge decisions, not a
  one-time sign-off, because the inputs (source payloads, customer behaviour,
  the cookie ecosystem) drift and the resolver's accuracy drifts with them.

The work itself flows through a kanban board (§5) rather than fixed sprints,
because ingestion bugs and bad-merge reports don't wait for a sprint boundary.

---

## 2. Delivery stages — the resolver earns trust

The resolver moves through four stages. Each is a column the *whole system*
sits in, distinct from the per-task kanban board in §5. A stage advances only
when its exit gate is met; the gate is a number, not a vibe.

### Stage 0 — Shadow ingest (no decisions)

Both webhooks land, events persist, signals are extracted and stored — but the
resolver runs in **shadow**: it computes what it *would* merge and writes that
to the `Merge` table with a `shadow` flag, without actually re-pointing any
`Event` or `IdentitySignal`. Profiles stay separate.

- **Why first:** it exercises the riskiest code path (resolution) against real
  production traffic with zero blast radius. Idempotency, signal normalisation,
  and payload-drift handling all get validated on live data before any merge is
  real.
- **What we watch:** ingest success rate, duplicate-collapse rate (idempotency
  working), and the *shadow merge log* — every would-be merge, reviewable
  before it's ever enacted.
- **Exit gate:** ≥7 days of clean ingest (no unhandled payloads, idempotency
  holding), and a human has eyeballed the shadow merge log and agrees the
  proposed merges look right.

### Stage 1 — Enforce deterministic merges only

Turn on real merges, but **only for deterministic signals** (`email`, `phone`,
platform IDs — §5.2). Probabilistic signals (`device_id`,
`browser_fingerprint`) keep running in shadow. This is the safest possible
"real" mode: a deterministic collision is almost always the same human, and
every merge writes a reversible `Merge` row.

- **What we watch:** merge volume vs. the Stage-0 shadow prediction (a spike
  means a normalisation bug fusing unrelated people), reversal rate, and
  manual-review queue depth.
- **Exit gate:** reversal rate < an agreed threshold (start at **<2% of merges
  reversed on review**), no unexplained merge spikes for 2 weeks.

### Stage 2 — Enable probabilistic corroboration

Let probabilistic signals *contribute* to merges under the corroboration rules
(§5.2 — a `device_id` match alone never merges; it only strengthens a
deterministic case). This is where the shared-iPad guard is genuinely tested in
production.

- **What we watch:** specifically the false-merge rate on probabilistic-adjacent
  cases — the studio-iPad and shared-household scenarios. The review queue (§4)
  oversamples merges that touched a probabilistic signal.
- **Exit gate:** probabilistic-touched merges hold the same reversal threshold
  as deterministic ones over a full review cycle.

### Stage 3 — Steady state + activation

The resolver is trusted. Now the downstream consumers turn on: the unified
`/api/customers` timeline becomes the source for CLTV/segmentation, and the
"We Missed You" campaign ([MISSED_YOU_PLAN.md](./MISSED_YOU_PLAN.md)) can run
against real lapsed cohorts. Continual evaluation (§4) doesn't stop — it
*becomes* the steady state.

> **Reversibility note:** because no stage rewrites history (§5.3) and every
> merge carries `resolver_version`, a regression found at Stage 2 can be rolled
> back to Stage 1 behaviour by config, and the affected merges re-evaluated.
> Stages are advances, not one-way doors.

---

## 3. Feature flags as the stage control

The four stages are config, not deploys. One resolver, behaviour gated by flags:

| Flag | Stage it unlocks | Default |
|---|---|---|
| `RESOLVER_ENFORCE` | 0 → 1 (writes real merges) | `false` |
| `RESOLVER_DETERMINISTIC_ONLY` | gate on Stage 1 | `true` |
| `RESOLVER_PROBABILISTIC` | 1 → 2 | `false` |
| `ACTIVATION_ENABLED` | 2 → 3 (campaigns read the graph) | `false` |

This keeps stage transitions cheap to reverse (ARCHITECTURE.md §2 — "cheap to
reverse" is the platform principle), and means a bad Stage-2 rollout is a flag
flip back to Stage 1, not a redeploy + data repair. The flag state is logged
alongside `resolver_version` on each `Merge` row so any decision is attributable
to the exact regime that produced it.

---

## 4. Continual evaluation — the review loop

Resolution accuracy isn't a property you verify once; it degrades as source
payloads change, customer behaviour shifts, and click-ID signals decay
(ARCHITECTURE.md §5.5). So review is a standing loop, not a launch checklist.

**The merge-review queue.** Every `Merge` row is reviewable. The internal tool
gains a `/merges` view (mirroring the existing search/detail layout) that lists
recent merges with their `triggered_by_signal`, `reason`, `resolver_version`,
and a one-click **reverse** action wired to the existing forward-only reversal
(§5.4). Reviewers don't read every merge — the queue prioritises:

- merges that touched a **probabilistic** signal (highest false-merge risk),
- merges that absorbed a customer with significant history (high blast radius if
  wrong),
- any **cascading** merge that chained 3+ profiles (§5.3 — most likely to mask a
  bad link).

**Leading indicators** (dashboarded, reviewed weekly during rollout, then at a
cadence that matches drift):

| Metric | What it tells us | Acts as gate for |
|---|---|---|
| Reversal rate | False-positive merges making it past the resolver | Stage 1 & 2 gates |
| Merge volume vs. shadow baseline | Normalisation/extraction regressions | Stage 1 |
| Unmatched-signal rate | Customers we *should* be linking but aren't (false negatives) | Stage 3 quality |
| Ingest error rate | Payload drift in Shopify/Mindbody | All stages |
| Review-queue depth & age | Whether evaluation is keeping pace with volume | Operational health |

**Resolver versioning closes the loop.** When a rule changes, bump
`RESOLVER_VERSION`. Because every `Merge` row records the version that made it,
a rule change can be evaluated by re-running the new resolver in *shadow* against
events already resolved under the old version (Stage 0's mechanism, reused) and
diffing the proposed merges before enforcing. This makes every future change a
mini-rollout, not a leap.

---

## 5. The kanban board

Work flows continuously, pulled not pushed, because the failure classes here —
a malformed webhook, a reported bad merge, a payload-shape change from Shopify —
arrive on their own schedule and the team should be able to act on them the same
day. Fixed sprints would queue an urgent bad-merge report behind a planning
boundary.

**Columns**

```
Backlog → Ready → In Progress → In Review → Eval (shadow/canary) → Done
```

- **Backlog** — everything identified but not yet committed to.
- **Ready** — specced enough to pull: acceptance criteria written, including the
  *evaluation* criteria (what metric must move / hold).
- **In Progress** — actively built. WIP-limited (see below).
- **In Review** — code review. For anything touching the resolver, review
  includes "does this change merge behaviour, and if so is it behind a flag?"
- **Eval** — the column that makes this a *continual-evaluation* board, not a
  generic one. A resolver-affecting change does not go straight to Done; it runs
  in shadow or canary (§2's mechanism at task scale) until its evaluation
  criterion is met. This is where the new code earns its place.
- **Done** — merged, flag state recorded, dashboard reflects expected change.

**WIP limits.** Cap *In Progress* (suggest 1–2 per engineer) and *Eval* (cap on
how many unproven resolver changes ride in shadow at once — too many and you
can't attribute a metric move to a cause). The Eval cap is the important one: it
enforces that changes are evaluated *in isolation*.

**Two swimlanes:**

- **Expedite** — incidents: bad-merge reports, ingest outages, payload-drift
  breakage. Bypasses WIP limits, pulls to the front. A bad merge in production
  goes here and gets reversed first, root-caused second.
- **Standard** — planned feature work flowing through the stages.

**Definition of Done** for any resolver-touching card: behind a flag, covered by
a test in the existing `*.test.ts` convention (resolver, signals), evaluated in
shadow/canary against its stated metric, and `resolver_version` bumped if rules
changed.

---

## 6. Sequenced backlog (first epics)

Roughly the order cards leave *Ready*, mapped to the stages they unlock:

1. **Observability before enforcement** — structured logging on the ingest path,
   the shadow `Merge` flag, and the leading-indicator dashboard (§4). *Unlocks
   Stage 0.* Nothing else should ship before we can see what the resolver is
   doing.
2. **Merge-review tooling** — the `/merges` view + reverse action (§4). *Gates
   Stage 1* — you can't enforce merges you can't review.
3. **Flag scaffolding** — the four flags in §3, wired into the resolver and
   logged onto `Merge` rows.
4. **Stage 1 hardening** — alerting on merge-volume anomalies, reversal-rate SLO.
5. **Probabilistic corroboration tests** — the studio-iPad / shared-household
   table-driven cases, run in shadow. *Gates Stage 2.*
6. **Activation readiness** — "We Missed You" preview/run behind
   `ACTIVATION_ENABLED` (MISSED_YOU_PLAN.md). *Stage 3.*
7. **Backfill & replay as first-class** — the dedicated backfill worker
   NOTES.md flags as deferred; safe to run any time post-Stage-1 because replay
   is idempotent and re-resolution is version-stamped.

---

## 7. What I'd explicitly defer

- **Automated merge approval** (ML-scored confidence gating reversals) — needs
  the labelled reversal data that the Stage 1–2 review queue *produces*. Build
  the human loop first; it generates the training set for the automated one.
- **Real-time activation** — Stage 3 reads the graph in batch, consistent with
  the composable-CDP latency profile in ARCHITECTURE.md §2. Real-time is a
  Phase 2 concern.
- **Cross-region / multi-tenant rollout** — single-environment until the
  single-region accuracy gates hold.
```
