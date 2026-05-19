# Architecture

## 1. Problem Statement

Every business has different seasons, and KIC is currently transitioning from growth to expansion. In ecommerce, this is the season where a fragmented customer view stops being a backlog item and starts being a revenue ceiling.

KIC drives revenue through three distinct channels — E-Commerce (Shopify) and In-Studio (Mindbody) - and each system holds its own version of the customer. A member who buys an item online in Shopify, books a Reformer class in Mindbody, two different people to KIC. Email is unreliable as a canonical key: customers check out as guests, register under personal vs work addresses, and the same household frequently shares a device.

The commercial consequences of this is that 
- CLTV is undercounted because purchase and booking behaviour can't be combined
- Attribution leaks because the path from ad click to studio booking is broken, and re-engagement campaigns mis-target because "lapsed" is defined per-system rather than per-person. 

Industry benchmarks put the uplift from a working single customer view at **1.5–3× YoY on targeted CLTV cohorts** and a **~1.5× reduction in marketing spend waste** ([cdp.com](https://cdp.com/basics/cdp-use-cases/)).

The scope of this document is an **early-stage Single Customer View** for KIC, anchored on identity resolution and activation. Everything else (predictive segments, ML-driven LTV, real-time personalisation) is downstream of getting identity right.

---

## 2. Architecture Options

At KIC's stage, the platform choice that matters most is the one that's **cheap to reverse** — locking in the wrong CDP at expansion scale is more expensive than building the wrong thing in-house. 

**In-house build**
- **What:** Bespoke identity service — Next.js/Node, Postgres, a queue, reverse-ETL workers to Shopify/Mindbody — owning the `Customer` + `IdentitySignal` + `Event` model end-to-end.
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

### Total Cost of Ownership

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

## 4. Data Model

The model has four tables and one rule that holds the whole thing together: **events reference the customer, never the signal.** Signals are mutable evidence; the customer is the canonical anchor; the event timeline must survive every re-resolution and merge without rewriting history.

```mermaid
erDiagram
    Customer ||--o{ IdentitySignal : "has"
    Customer ||--o{ Event : "owns (current)"
    Customer ||--o{ Merge : "winner"
    Customer ||--o{ Merge : "loser"
    Customer }o--|| Customer : "merged_into"
    IdentitySignal ||--o{ Merge : "triggered_by"
    Event ||--o{ Merge : "triggered_by"

    Customer {
        uuid id PK
        timestamp created_at
        timestamp updated_at
        string status "active | merged"
        uuid merged_into_id FK "null unless merged"
    }

    IdentitySignal {
        uuid id PK
        uuid customer_id FK
        string type "email|phone|device_id|shopify_customer_id|mindbody_client_id|app_user_id|fbclid|gclid|browser_fingerprint"
        string value "normalised (E.164, lowercased, etc.)"
        string confidence "deterministic | probabilistic"
        timestamp first_seen_at
        timestamp last_seen_at
        timestamp expires_at "null = never; set for click IDs"
    }

    Event {
        uuid id PK
        uuid customer_id FK "current owner; rewritten on merge"
        string source "shopify | mindbody | kicapp"
        string external_id "unique with source for idempotency"
        string event_type
        timestamp occurred_at
        json payload "raw source payload"
        timestamp received_at
    }

    Merge {
        uuid id PK
        uuid winner_customer_id FK
        uuid loser_customer_id FK
        uuid triggered_by_signal FK
        uuid triggered_by_event FK
        string reason "enum"
        string resolver_version
        timestamp created_at
        timestamp reversed_at "null unless unwound"
    }
```

**`Customer`** — the canonical record. Carries no PII directly; PII lives on `IdentitySignal` rows so it can be added, expired, or merged without touching the anchor. `merged_into_id` lets a loser row redirect to its winner rather than being deleted, so historical foreign keys still resolve and merges remain reversible.

**`IdentitySignal`** — typed edges between a customer and an identifier. The signal type (`email`, `phone`, `device_id`, `shopify_customer_id`, `mindbody_client_id`, `app_user_id`, `fbclid`, `gclid`, `browser_fingerprint`) carries its own confidence (`deterministic` / `probabilistic`) per [CONTRACTS.md](../CONTRACTS.md#section-3--identity-signal-inventory), and the `expires_at` column distinguishes stable platform IDs (no expiry) from short-lived click IDs (90-day TTL) — the same column, different policy per type. Unique constraint on `(type, value)` is what makes lookup O(1) and enforces "one signal value → one customer" globally.

**`Event`** — append-only source-of-truth log. `(source, external_id)` is unique for idempotency; `customer_id` is the *current* resolved owner, rewritten in place when a merge happens so the timeline at `/api/customers?q=…` stays correct without replaying history. The raw `payload` is preserved so schema drift in source systems is recoverable and resolver upgrades can re-derive signals from old events.

**`Merge`** — provenance for every unification. Records which signal and which event triggered the merge, which version of the resolver made the call, and leaves `reversed_at` nullable so a bad merge (two real people sharing an iPad) can be unwound without losing the audit trail. This is the table that makes the system reviewable rather than a black box.

**Why?**
- Shared-iPad case: `device_id` lands as a probabilistic signal — the resolver can require corroboration before merging, and the `Merge` row records the decision either way.
- Multi-email case: a customer accretes multiple `email` signal rows under one `Customer` rather than competing for a single column.
- Guest checkout: a `device_id`-only event still gets a `Customer` row immediately; later events with `email` or `phone` cascade-merge into it via the `Merge` log.
- Warehouse portability ([§3 Recommendation](#recommendation--stage-it-build--composable)): all four tables are flat, append-friendly, and have no ORM-specific types — Phase 2 reverse-ETL to BigQuery/Clickhouse is a pipeline change, not a re-platform.