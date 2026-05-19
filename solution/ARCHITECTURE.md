# Architecture

## 1. Problem Statement

Every business has different seasons, and KIC is currently transitioning from growth to expansion. In ecommerce, this is the season where a fragmented customer view stops being a backlog item and starts being a revenue ceiling.

KIC drives revenue through three distinct channels — E-Commerce (Shopify), In-Studio (Mindbody), and Marketing (Braze) — and each system holds its own version of the customer. A member who buys a resistance band on Shopify, books a Reformer class in Mindbody, and clicks a Braze re-engagement email is, today, three different people to KIC. Email is unreliable as a canonical key: customers check out as guests, register under personal vs work addresses, and the same household frequently shares a device.

The commercial consequence is concrete: CLTV is undercounted because purchase and booking behaviour can't be combined, attribution leaks because the path from ad click to studio booking is broken, and re-engagement campaigns mis-target because "lapsed" is defined per-system rather than per-person. Industry benchmarks put the uplift from a working single customer view at **1.5–3× YoY on targeted CLTV cohorts** and a **~1.5× reduction in marketing spend waste** ([cdp.com](https://cdp.com/basics/cdp-use-cases/)).

The scope of this document is an **early-stage Single Customer View** for KIC, anchored on identity resolution and activation. Everything else (predictive segments, ML-driven LTV, real-time personalisation) is downstream of getting identity right.

---

## 2. Architecture Options

At KIC's stage, the platform choice that matters most is the one that's **cheap to reverse** — locking in the wrong CDP at expansion scale is more expensive than building the wrong thing in-house.

**In-house build**
- **What:** Bespoke identity service — Next.js/Node, Postgres, a queue, reverse-ETL workers to Braze/Shopify/Mindbody — owning the `Customer` + `IdentitySignal` + `Event` model end-to-end.
- **Strength:** Full control over identity logic, which is the highest-risk part of any CDP and the part most likely to get KIC's shared-iPad and multi-email cases wrong if outsourced.
- **Weakness:** Every connector and every schema drift is an in-house incident; 6–12 months in, the team is effectively running a small CDP company on the side.
- **Cost shape:** Linear in headcount — predictable, but the FTE who owns it isn't building the next thing.

**Packaged CDP (Segment, RudderStack, mParticle)**
- **What:** Buy the stack — SDKs, server-side ingestion, identity graph, audience builder, destinations — and configure rather than build.
- **Strength:** Weeks-not-quarters to first activation, mature connector library, vendor carries the operational burden.
- **Weakness:** Identity logic is a black box, so the edge cases that matter most to KIC still need bolt-on logic or accepted false merges.
- **Cost shape:** Per-MTU pricing scales super-linearly with growth — costs spike with growth. 

**Composable CDP (Snowflake/BigQuery + Hightouch/Census/Fivetran)**
- **What:** Warehouse-native — Fivetran lands raw events, dbt models the identity graph in SQL, reverse-ETL activates downstream.
- **Strength:** Single source of truth for analytics, ML, and activation; identity logic is versioned, auditable SQL; portable to whichever activation tool wins next.
- **Weakness:** Requires a warehouse and a SQL-fluent team; activation latency is minutes-to-hours rather than real-time.
- **Cost shape:** Sub-linear — scales with warehouse efficiency rather than event volume.

---

## 3. Total Cost of Ownership

These figures are example estimates. Figures are AUD, KIC-stage assumptions: low-single-digit-million MTUs, ~5 destinations, one senior engineer. 

| | In-house build | Packaged CDP | Composable CDP |
|---|---|---|---|
| **Time to value** | 4–6 months | 4–8 weeks | 2–4 months |
| **Year 1 TCO** | ~$200k | ~$180k | ~$200k |
| **Steady-state / yr** | ~$250k | ~$250k ↗ (rises with MTUs) | ~$220k |
| **Cost scaling** | Linear (FTE) | Super-linear (MTU) | Sub-linear (warehouse) |
| **Switching cost later** | Low | High | Lowest |
| **Operational burden** | High | Low | Medium |

The Year 1 numbers are deliberately close — within ~10% of each other — because the real TCO story is the **shape of the curve, not the starting point**. By Year 3 the packaged option is materially the most expensive (MTU growth compounds), in-house plateaus at the FTE line, and composable benefits from warehouse efficiencies the other two can't access. Switching cost is the under-discussed lever: a packaged CDP locks in event schemas and audience definitions, so the cost of being wrong shows up as a re-platform, not a line item.

### Recommendation — Stage it: Build → Composable

KIC has two needs on different timelines: solve identity resolution now to feel things, and converge on a warehouse-native customer model over the next 12–18 months as the system finds it fit. 

Phase 1 is an in-house identity service — this repo, productionised — owning `Customer`, `IdentitySignal`, `Event`, and merge provenance, with deterministic-first resolution and `device_id` flagged as probabilistic. 

Phase 2 pipes those outputs into a data lake (such as BigQuery or Clickhouse, or another OLAP Database) as the canonical `customer_profile`, with Hightouch/Census handling activation; the in-house service either retires or shrinks to a real-time ingestion shim. The packaged path is rejected at both stages because its MTU pricing curve punishes the growth KIC is targeting, and its black-box identity graph handles the shared-iPad and multi-email edge cases worst. The portability lever that makes this staged path work is that Phase 1's schema is designed from day one to land cleanly in a warehouse — Phase 2 becomes a pipeline change, not a re-platform.

**Staged-path TCO:** ~$200k Year 1, trending to ~$220–250k/yr steady state — the same envelope as any single-option choice, but with the option value of deferring the platform decision until KIC's data team and warehouse roadmap make it.

---

## 5. Data Model

*(To be detailed — canonical `Customer`, typed `IdentitySignal` edges with confidence + provenance, append-only `Event` records that reference the customer rather than the signal, and a `Merge` log capturing which signal triggered each unification and when.)*

---

## 6. Trade-offs

- **Historical data handling is implicit, not designed-out.** Backfill reuses the live webhook path (relies on `(source, external_id)` idempotency already required by [CONTRACTS.md](CONTRACTS.md) §4), and replay leans on the `Event` table being append-only with `Customer`/`IdentitySignal`/`Merge` as derived state. Both work, but they're properties of the design rather than first-class features — production use would need explicit tooling (backfill worker, replay harness, `resolver_version` on `Merge` rows).
- **Backfill fidelity is capped by source-system data quality.** Signals not historically captured (e.g. `device_id` pre-SDK rollout) won't resolve as well as live events — historical profiles will be weaker than current ones.
- **Replay is batch, not real-time.** Re-resolving 12 months of events is measured in hours, not seconds. Fine for algorithm fixes; not for live operator workflows.
