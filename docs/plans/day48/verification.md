# Day 48 verification — v1.5 · 3 · Images, store details, slots

## What shipped

- **Photos, content-addressed.** The box offers each photo digest on `POST /relay/images` (`offerRelayImage`,
  `@shopper/assets`). The relay holds one `asset` per digest (`receipts/products/sha256/<digest>`); when it already
  holds the bytes it answers without a grant, otherwise it registers the photo once and grants a direct upload. The box
  PUTs the bytes from its own Blobs straight to storage. `relay.publish` links `image_asset_id` only after checking
  the stored bytes against the digest (once, `asset.verified_sha256`); otherwise 409 and the Publisher retries.
- **Fulfilment on the wire.** Each branch's `branch_fulfilment` (pickup, delivery, fee, hours, slot length, capacity,
  lead time) is a new projection kind, after branches. The relay's checkout therefore offers exactly the box's slots
  and is closed where the box is closed.
- **Lock.** Migration `0049_relay_fulfilment.sql` adds the `relay_lock` trigger to `branch_fulfilment`.
- **Wake.** `wakePublisher` middleware: catalogue, store, branch and fulfilment writes on the box wake the Publisher
  (Day 47 woke on catalogue writes only, so a new branch or new hours waited for the next catalogue change).
- **No storefront change.** The relay store reads `catalogue_public`, `asset` and `branch_fulfilment` as a cloud shop
  does.

## Tests

- `relay/storefront.test.ts` (new, 3 tests, real RustFS buckets on both sides):
  - two products sharing one photo plus a third: two grants, two relay assets, two stored objects, both products on
    the same asset; the store's image route redirects to the box's exact bytes; renaming a product uploads nothing;
  - fulfilment hours 10:00–12:00: the relay's `/shop/:slug/fulfilment` slots equal the box's `listSlots`, all inside
    the hours; a branch switched off on the box is closed online; new hours follow after the next publish;
  - the relay org's fulfilment refuses a cloud-side write (lock).
- `relay/publish.test.ts`: an unheld digest is refused 409; `/relay/images` without storage is 503; a fulfilment row
  with an extra field or closing before opening is refused 400; a valid one is accepted.
- `relay/publisher.test.ts`: the allowlist now includes `image` and the `fulfilment` kind.
- `catalogue/online.test.ts`: store, branch and fulfilment writes each wake the Publisher.
- Break-checks: always granting an upload failed the "renamed product uploads nothing" assertion; removing the wake
  from the fulfilment route failed the wake count; before the lock migration the lock test resolved instead of
  rejecting.

## Checks

- `vp check`: 0 errors. `vp run guard`: clean.
- Local integration run over relay, shop, orders, db, export, migration, catalogue, security and tax/schema: 87 files,
  358 tests green (one file re-run after it was edited mid-run). The full suite runs in CI.
- Codex review (`gpt-6.1-sol`, medium, `--base main`): no findings.
- No UI changed, so no ui-verify pass: the storefront renders relay data unchanged, and the box's branch screen already
  edits fulfilment. The Figma frames supplied have no relay or online-store frame that this work touches.

## Remarks

- Delivery zones are not built: the product has none (one flat fee per branch, cloud and box alike).
- Store trading hours are not published: only the store-day workflow reads them, and the relay runs none.
- Relay photos no product uses any more are not deleted (small, bounded by the catalogue).
- A photo deleted from the box's storage after it was linked stops the Publisher (it retries with "missing from the
  box's storage") until the photo is replaced or removed; `setProductImage` verifies bytes, so this needs manual damage.
