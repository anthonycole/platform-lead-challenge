# Implementation Plan — "We Missed You" Re-engagement Campaign

## 1. Goal & scope

Detect customers who were once active but have gone quiet, and trigger a
re-engagement outreach — without double-contacting people, without spamming the
recently-active, and with a clear audit trail of who we contacted and why.

The repo already gives us everything needed to *define* "lapsed": an append-only
`Event` log with `occurredAt`, a unified `Customer` identity behind merge chains,
and a `lastActivityAt` computation in `src/lib/metrics.ts` (lines 31–33). What's
missing is (a) an efficient way to *query* lapsed customers in bulk, and (b) any
notion of an outreach having happened. This plan adds exactly those two things
and nothing more.

## 2. Definition of "lapsed"

A customer is lapsed at time `now` if **all** hold:

- `status = "active"` (never target a `merged` shell — the canonical record is
  what we contact)
- has at least one event (`lastActivityAt` is not null — a customer with no
  activity was never "with us" to miss)
- `lastActivityAt < now − INACTIVITY_WINDOW` (default **60 days** — see §6 and
  the tradeoff note below)
- `lastActivityAt ≥ now − STALENESS_FLOOR` (default **365 days**) — we don't
  chase customers who lapsed so long ago the campaign is meaningless; this also
  bounds the candidate set
- has a contactable signal: an `email` or `phone` IdentitySignal exists

These thresholds are config, not magic numbers — see §6.

**Tradeoff on the 60-day window:** 60 days catches people earlier than a
quarter-based threshold, but will pull in customers who are merely *between*
normal visits (e.g. someone who books a class roughly monthly but skipped one).
This makes the preview / dry-run step in §7 more important — eyeball the
candidate set before the first real run, and tighten the window if it's noisy.

## 3. Key design decision: derive `lastActivityAt` at query time

The metrics layer derives `lastActivityAt` by scanning a customer's events in
memory. That's fine for one profile view but won't scale to "find all lapsed
customers" — we'd load every event for every customer.

**Chosen approach — query-time aggregation.** Compute lapsed candidates with a
grouped query over `Event` (`groupBy customerId, max(occurredAt)`), then filter.
The `@@index([customerId, occurredAt])` on `Event` already supports this. No
schema change for activity tracking, no cache to invalidate, consistent with the
repo's "append-only log is the source of truth" philosophy. Cost: the
aggregation scans the event index on each run — acceptable for a batch job that
runs daily, not per-request.

**Deferred alternative — denormalised `Customer.lastActivityAt`.** A cached
column updated in the resolver's ingest path would give faster reads, but
introduces a write-path coupling and a value that can drift from the log —
exactly the kind of "cache without an invalidation story" the NOTES.md warns
against. If campaign runs become slow at scale, this is a clean follow-up (and
pairs naturally with the "warehouse portability" Phase 2 bet — `lastActivityAt`
becomes a materialised view).

## 4. Schema additions

One new model, tracking that an outreach happened. This is the campaign analogue
of how `Merge` records *why* an identity decision happened — an auditable,
append-only record.

```prisma
model CampaignSend {
  id           String   @id @default(cuid())
  customerId   String
  customer     Customer @relation(fields: [customerId], references: [id])
  campaign     String   // e.g. "missed_you_v1" — campaign + version, like resolverVersion
  channel      String   // "email" | "sms"
  sentToType   String   // signal type used: "email" | "phone"
  sentToValue  String   // the actual address/number contacted (audit)
  lastActivityAtSnapshot DateTime  // why they qualified — the lapsed timestamp at send time
  status       String   @default("queued") // queued | sent | failed | suppressed
  createdAt    DateTime @default(now())
  sentAt       DateTime?

  @@index([customerId, campaign])
  @@unique([customerId, campaign])  // one send per customer per campaign — dedup guard
}
```

Add the back-relation `campaignSends CampaignSend[]` to `Customer`.

The `@@unique([customerId, campaign])` is the **idempotency / no-double-contact
guarantee**, mirroring the `@@unique([source, externalId])` pattern on `Event`.
Re-running the campaign skips anyone already sent. Migration via the mandated
`npx prisma migrate dev --name add_campaign_send`.

Note: `customerId` here is the *canonical* (post-merge) id. If two customers
merge after a send, the loser's CampaignSend rows point at a now-merged
customer — a re-run resolves through the merge chain and treats them as one,
which is the correct behaviour (don't re-contact someone we already reached under
their old identity).

## 5. Business logic — `src/lib/campaigns/missedYou.ts`

Per CLAUDE.md rule 4, all logic lives in `src/lib/`; routes stay thin. Three
functions:

```ts
// 1. Find candidates. Read-only.
export async function findLapsedCustomers(opts: {
  now?: Date;
  inactivityDays?: number;   // default 60
  stalenessDays?: number;    // default 365
  limit?: number;
}): Promise<LapsedCandidate[]>
```
Implementation: `prisma.event.groupBy({ by: ['customerId'], _max: { occurredAt } })`,
filter the window in SQL where possible, then for each candidate confirm
`status === "active"` and load the most-recent `email`/`phone` signal (reusing
the `lastSeenAt desc` ordering already used in `buildCustomerSummary` in
`src/lib/timeline.ts`). Returns customerId, the chosen contact signal, and
`lastActivityAt`.

```ts
// 2. Enqueue sends. Writes CampaignSend rows; idempotent via the unique constraint.
export async function enqueueMissedYou(opts: {
  candidates: LapsedCandidate[];
  campaign: string;          // e.g. "missed_you_v1"
  dryRun?: boolean;
}): Promise<{ queued: number; skipped: number }>
```
Uses `createMany` with skip-on-conflict semantics so re-runs are safe. `dryRun`
returns the counts without writing — essential for an internal tool where you
want to preview the blast radius first.

```ts
// 3. Mark sent / failed. Called by whatever actually dispatches the message.
export async function recordSendResult(sendId, result): Promise<void>
```

Dispatch itself (SMTP / SMS provider) is **out of scope for this layer** —
`CampaignSend` is the contract a future dispatcher reads from. This keeps the
change focused and provider-agnostic, consistent with the webhook handlers that
ingest without retrying.

## 6. Configuration

Thresholds live in one place — `src/lib/campaigns/config.ts` exporting
`MISSED_YOU_DEFAULTS` (`inactivityDays: 60`, `stalenessDays: 365`). Not env vars
(these are product decisions an operator tunes, not deploy config), but
overridable per API call so the internal tool can experiment.

## 7. API surface

Thin route handlers delegating to §5:

- `GET /api/campaigns/missed-you/preview?inactivityDays=60&limit=50` → calls
  `findLapsedCustomers`, returns candidate summaries + a total count. Read-only,
  safe to hit repeatedly. This is the "who would we contact?" view — and the
  guard against the 60-day window being too aggressive (§2).
- `POST /api/campaigns/missed-you/run` → body `{ campaign, dryRun }` → finds
  candidates then `enqueueMissedYou`. Returns `{ queued, skipped }`.

Both follow the existing webhook route shape (Zod-validated body,
`runtime = "nodejs"`, request-id logging, meaningful status codes per CLAUDE.md
rule 8).

## 8. Frontend (optional, fits existing internal tool)

A `/campaigns` page mirroring the existing search/detail layout: a preview table
of lapsed customers (email, last activity as `formatRelativeTime`, lifetime spend
via `formatCurrencyAUD`) with a "Queue campaign" action behind a dry-run
confirmation. Reuses `PageShell`, the metrics formatters, and the summary-card
pattern. Scope this only if frontend is in-scope for the assessment.

## 9. Testing

Following the existing `*.test.ts` convention (resolver, signals):

- `missedYou.test.ts` — table-driven on `findLapsedCustomers`: just inside / just
  outside the 60-day window; null `lastActivityAt` excluded; merged customers
  excluded; no-contact-signal excluded; staleness floor excluded.
- Idempotency: enqueue twice → second run skips all (unique constraint).
- Merge-after-send: loser's send doesn't cause a re-contact of the winner.
- `dryRun` writes nothing.

## 10. What I'd explicitly defer

- **Actual message dispatch** and provider integration — the `CampaignSend` table
  is the seam.
- **Engagement feedback loop** (opens/clicks re-activating a customer) — would
  arrive as a new event source through the *existing* webhook + resolver path,
  which is the elegant part: a re-engaged customer's reply naturally updates
  their `lastActivityAt` and excludes them from the next run, no special-casing.
- **Caching `lastActivityAt`** (the §3 deferred alternative) until query-time
  aggregation proves too slow.

## 11. Build order

1. Migration + `CampaignSend` model (§4)
2. `config.ts` + `findLapsedCustomers` + tests (§5, §6, §9)
3. `enqueueMissedYou` + idempotency tests
4. Preview + run routes (§7)
5. (Optional) frontend page (§8)
