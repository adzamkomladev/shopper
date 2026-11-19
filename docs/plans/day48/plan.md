# Day 48 — v1.5 · 3 · Images, store details, slots

## Context

Notion row "v1.5 · 3 · Images, store details, slots" (Box, Shop, P0). Day 47 shipped the Publisher: the box sends its
relay org stores `{id, name}`, branches `{id, storeId, name}`, categories, products and prices, diffed by hash against
`relay_published`. A relay shop's storefront therefore lists products, but with no photos, and its checkout says
"closed" because no branch has a `branch_fulfilment` row in the cloud.

Tasks from the row:

- Product images uploaded to R2 content-addressed (hash): never re-sent if unchanged.
- Publish store and branch details, opening hours, delivery zones, pickup/delivery slots.
- Store pages render relay-org data through `catalogue_public` with no code changes.

Integration tests from the row: the same image published twice leaves one R2 object; the store's closed hours are
respected on the storefront. **Done when:** an on-prem shop's storefront looks identical to a cloud shop's.

Working rules (user, memory): no subagents; tests first; one commit per slice; push once at the end; PR, watch CI until
green (fix and push if red), merge; update Notion. Data is disposable.

## What the storefront actually reads (traced)

| Storefront need                     | Read from                                                   | Relay today                     |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| Shop name, branches, categories     | `org.name`, `branch`, `category` (`/shop/:code/store`)      | published (Day 47)              |
| Products and prices                 | `catalogue_public`, `price`                                 | published (Day 47)              |
| Product photo                       | `catalogue_public.image_asset_id` → `asset.key` → Blobs     | **missing**                     |
| Pickup, delivery, fee, hours, slots | `branch_fulfilment` (`/shop/:code/fulfilment`, cart, order) | **missing**: checkout is closed |

So the work is two new things on the wire, photos and `branch_fulfilment`, and no storefront change at all.

## Decisions

1. **Opening hours and slots = `branch_fulfilment`.** It is what the storefront's checkout reads: pickup, delivery,
   flat fee, `opens`/`closes`, slot length, capacity, lead time. Publishing it makes the relay store's slots, closed
   hours and "closed" state identical to the box's. The relay's slot counts are its own online orders (the orders
   live on the relay, Day 50).
2. **Delivery zones do not exist** in the product: a branch has one flat delivery fee, on the cloud as on the box.
   Nothing to publish; the storefront is identical without them. Not built.
3. **Store trading hours (`store.opens_at/closes_at`) are not published.** Only the store-day workflow reads them,
   and the relay org runs no store day. Store and branch names are already published.
4. **Photos are content-addressed on the relay.** One asset per relay org per digest, key
   `receipts/products/sha256/<digest>` (under `receipts/`, so both adapters route it to the durable private bucket,
   like cloud product photos). Same bytes → same key → one object and one `asset` row, however many products or
   publishes use them.
5. **Bytes go straight to R2 through a presigned grant, never through the API** (AGENTS.md asset rule; the box is the
   uploading client). The protocol:
   - `POST /relay/images {sha256, sizeBytes, contentType}` (licence-signed). The relay answers `{}` when it already
     holds those exact bytes (verified once, recorded in `asset.verified_sha256`), else registers the asset if new and
     answers `{upload: grant}`.
   - The box PUTs the bytes, read from its own Blobs, to the grant.
   - Products on the wire carry `image: <sha256> | null`. `publishRelay` links `image_asset_id` to the asset with that
     digest, verifying the stored bytes (bounded read, size and digest) immediately before first use. A product whose
     photo is missing or does not match fails the batch with 409, so the Publisher retries later (and asks again).
   - "Never re-sent if unchanged": the relay answers `{}` for a held digest, so a renamed product or a second product
     with the same photo uploads nothing.
6. **The relay lock grows to `branch_fulfilment`.** Like the catalogue, a relay org's fulfilment is written only by
   its box (`shopper.relay`). Migration `0049_relay_fulfilment.sql`: one trigger, no schema change.
7. **Projection additions** (`relayProjection`, both sides, still an allowlist):
   - products gain `image` (the photo's `asset.sha256`, or null);
   - new kind `fulfilment` `{id, branchId, pickup, delivery, deliveryFee, opens, closes, slotMinutes, slotCapacity,
     leadMinutes}`, ordered after branches. Times are `HH:MM` so the wire reuses `fulfilmentInput`'s rules.
8. **The Publisher needs the box's Blobs** to read photo bytes: `RelayPublisherDeps.blobs`; `apps/box/src/relay.ts`
   passes the box's blobs. The relay routes take the cloud's `blobs`.

## Tests (written first, each seen failing)

`tests/integration/relay/storefront.test.ts` (new; cloud `relayCloud()` with RustFS-backed Blobs, a box DB from
`emptyDatabase()` with its own RustFS Blobs, the Publisher under `memoryLaunch`):

1. **Same photo published twice → one object.** Two box products share one photo's bytes (two box assets, one
   digest); a third has another photo. Publish: the relay holds exactly two `product_image` assets, one upload grant
   per digest was used, and both products point at the same asset. Rename a product and republish: no grant is asked
   for again. The relay store's `GET /shop/:slug/images/:assetId` redirects to bytes equal to the box's photo.
   `relayProjection` equality covers `image` on both sides.
2. **A photo that never reached storage is not linked.** The PUT is skipped (fault switch); the batch is refused 409,
   the Publisher records the error, and the product is not marked published. The next run uploads and links it.
3. **The store's closed hours are respected.** A box branch opens 10:00–12:00 for pickup with hour slots; another
   branch takes no online orders. After publishing, the relay's `GET /shop/:slug/fulfilment?branch=` returns exactly
   the box's slots (all inside 10:00–12:00) and the other branch returns no pickup, no delivery, no slots (closed).
   Changing the hours on the box changes the relay's slots after the next publish.
4. **The relay's fulfilment is the box's alone.** `saveFulfilment` on the relay org from the cloud is refused by the
   lock.

`tests/integration/relay/publisher.test.ts`: the allowlist test gains `image` on products and the `fulfilment` kind,
and only `/relay/publish` bodies are treated as batches.

`tests/integration/relay/publish.test.ts`: a batch with an unknown digest is refused 409; a strict-object check that a
fulfilment row with an extra field is refused 400.

## Slices (commit after each)

**S1 Wire and relay side.** `schemas/relay.ts` (products `image`, `fulfilment` rows, `relayImageOffer`),
`relay/images.ts` (`offerRelayImage` command, `relayImageKey`), `relay/publish.ts` (upsert fulfilment, link photos),
`relay/projection.ts` (image, fulfilment), `routes/relay.ts` (`POST /relay/images`, blobs), `app.ts` passes blobs,
migration 0049 (lock). Tests 4 and the `publish.test.ts` cases.

**S2 Publisher.** `relay/publisher.ts` (fulfilment kind; before a batch, offer each new digest and PUT the bytes),
`RelayPublisherDeps.blobs`, `apps/box/src/relay.ts`. Tests 1–3 and the allowlist update.

**S3 Docs and verification.** `docs/guides` / platform notes where the relay protocol is described, the verification
record, Notion.

## Not in scope

- Delivery zones (do not exist anywhere), store trading hours on the relay (nothing reads them).
- Garbage-collecting relay photos no product uses any more (a photo is small and bounded by the catalogue).
- UI: no screen changes. The storefront renders relay data unchanged (that is the task's point) and the box already
  edits fulfilment on its branch screen. Figma frames were checked for any relay/online-store frame; none applies.
