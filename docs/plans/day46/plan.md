# Day 46: v1.5 · 1 · Relay org mode

Notion row "v1.5 · 1 · Relay org mode". Done when a box can authenticate to its relay org and nothing else can write
to it.

## Goal

An on-prem shop gets a cloud **relay org** (`org.mode = 'relay'`) that only its own box can write to, over
licence-signed outbound requests. The cloud back office cannot edit it, and the catalogue tables refuse every writer
but the box's Publisher.

## Decisions (inside the approved v1.5 proposal, recorded here)

- **The relay org's id is the licence's `org`.** The box's licence already names its org; the relay org reuses that
  id, so a relay request's tenant is `licence.org`, never anything in the request.
- **Enrolment, the Online Orders flag and revocation live in the cloud** in a `relay_box` row per licence, written by
  platform staff (`platform.tenant.update`, no new permission code). `lic/1` stays unchanged: the issuer is the
  cloud, so its registry is the authority, and existing licences keep verifying.
- **Active maintenance** = the licence's `maintenanceUntil` is today or later (Accra day = UTC).
- **Replay protection**: a request's signature is single-use. `relay_nonce` holds each accepted signature's SHA-256
  for the 5-minute freshness window (older rows are pruned on insert); a repeat is refused. A per-licence
  "last signed-at" was rejected: the Publisher and Order-inbox actors send concurrently, so order is not monotonic.
- **Write-lock in the database**: a trigger on the catalogue tables refuses writes to a relay org's rows unless the
  transaction set `shopper.relay` (SET LOCAL) to that org's id. Only the relay publish command sets it. Same shape as
  `shopper.replace` (migration 0046). The API also refuses every member write to a relay org (423), so the cloud
  back office reads only.

Refusals: no/forged/stale/replayed signature → 401; not enrolled, revoked, or Online Orders off → 403; maintenance
lapsed → 402.

## Behaviours as tests (written first)

`tests/integration/relay/auth.test.ts` (cloud API with the issuer key, golden-free PG world):

1. An enrolled box with Online Orders and maintenance gets `GET /relay/status` (org, mode, flags) and its heartbeat
   updates `last_seen_at`.
2. Unsigned, forged (stranger issuer), stale (6 minutes old) and body-tampered requests are refused 401.
3. The same signed request sent twice: first 200, replay 401.
4. A revoked licence, a licence never enrolled, and an enrolled licence with Online Orders off are refused 403;
   lapsed maintenance is refused 402.
5. A licence for org A cannot reach org B: the relay acts on `licence.org` only (a body naming another org changes
   nothing).

`tests/integration/relay/lock.test.ts`:

6. Cloud portal cannot edit a relay org's catalogue: its owner's `POST /products`, `PATCH /products/:id`,
   `POST /categories` get 423; reads still 200; `/billing/status` reports `relay: true`.
7. A direct `INSERT/UPDATE/DELETE` on `product`, `category`, `price`, `tax_class`, `product_barcode` for a relay org
   raises (the trigger), while a full org's write passes and `SET LOCAL shopper.relay = <org>` lets exactly that org
   through.
8. `POST /relay/publish` from the box writes tax classes, categories and products into the relay org (audited), and
   a second identical batch changes nothing.

`tests/integration/relay/enrol.test.ts`:

9. Platform staff enrol a licence (creates the relay org with `mode = 'relay'`), toggle Online Orders and revoke;
   a shop owner is refused 403; each change is an audit row in the platform org's chain.

Plus: the tenant sweep's `PUBLIC` list gains `relay/` (signature is the credential); table-count tests updated.

## Changes

- **`@shopper/db-pg`**: `schemas/relay.ts` (`relayBox`, `relayNonce`), exported from the schema barrel. Migration
  `0047_relay.sql` (generated tables + hand-written `shopper_relay_lock()` trigger on the catalogue tables).
- **`@shopper/core/relay`** (new subpath): `commands.ts` (`enrolRelay`, `setRelayOnlineOrders`, `revokeRelay`,
  `heartbeat`, `publish`), `access.ts` (`relayAccess`: verify signature → enrolment/revocation/flag/maintenance →
  nonce). Reuses `verifySignedRequest`, `defineCommand`, `sha256`.
- **`@shopper/api`**: `routes/relay.ts` (`/relay/status`, `/relay/heartbeat`, `/relay/publish`, `/relay/orders` —
  the inbox read over `online_order.inbox_cursor`), mounted where `licenceSigningKey` is set (the cloud). Platform
  enrol/flag/revoke routes in `routes/platform.ts`. `middleware/relay.ts` refuses member writes to a relay org.
  `/billing/status` gains `relay`.
- **`@shopper/backoffice`**: `billingStatus` schema + `ReadOnlyBanner` relay message.
- **Box shell**: none today. The box already signs with `signedRequest`; the Publisher/Order-inbox actors that call
  these endpoints are Days 47 and 50.
- **Docs**: `docs/engineering/platforms.md` relay section; `security.md` relay identity line.

## UI

One state: the shell banner for a relay org ("This shop's catalogue is managed on its own box, so this cloud copy
only reads."), the existing `Alert` pattern the Figma Dashboard frames use for notices. Verified with `ui-verify`
at desktop/laptop/tablet/mobile. No new screen: enrolment is staff API until Day 53 (licence flag and billing).

## Rules at risk

- Tenancy: org from the licence only; sweep covers the new routes.
- Audit: every relay write is a `defineCommand`; nonce rows are protocol state (like sessions), not business data.
- Size: new files under 250 lines; `app.ts` grows by a few lines.

## Slices

- **S1 Schema + lock**: tables, migration, trigger; tests 7 (and table counts). Commit.
- **S2 Relay identity**: `relayAccess`, status/heartbeat/inbox routes, enrol/flag/revoke commands + platform routes;
  tests 1–5, 9, sweep. Commit.
- **S3 Publish + back-office lock**: publish command, member-write guard, `/billing/status.relay`, banner; tests 6, 8;
  ui-verify. Commit.
- **S4 Docs, checks, review**: docs, `vp check`, `vp run guard`, full integration, Codex review, verification.md.
  Commit, push, PR, CI green, merge, Notion.

## Not doing (and when)

Projection filter, snapshot/deltas, cursor (Day 47); images (48); availability, "ordering paused" (49); inbox
ack/accept/reject and order status push (50); admin UI for enrolment and billing of the add-on (53).
