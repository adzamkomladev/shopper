# Day 10 — Offline till sale screen

Approved 14 October 2026. Source: Notion Day 10 (https://app.notion.com/3eba2c999ce981aa8eefc2b03e8d3b88).
Figma `4MtEIWv8yBUBYgkrk4ubPk`: input 13:1347, sale frame 99:1973 (1366×768), cart detail 48:1465.

## Goal

A fast cashier workspace that works without internet: scan or search products, edit a persistent unpaid
basket, see exact Ghana tax totals, and monitor synchronization. Thirty keyboard-only items in under a minute.

## Approved decisions

- Scanner bursts: consecutive key gaps below 60 ms, including the terminating Enter.
- Embedded EAN-13 layouts are configured per prefix 20–29 in the portal and synchronized to tills.
- Price-embedded labels preserve their exact encoded gross amount.
- Active baskets persist in till SQLite, isolated by organization, device, branch and cashier.
- Cashiers may remove unpaid draft lines without manager approval (exception to the void rule).
- Figma basket layout; the payment panel becomes a Ghana tax summary plus a payment-availability notice.
- Application data is disposable; resets are authorized.
- Commit each reviewed slice locally; push once at the end.

Tenders, completed sales, held sales, printing and payment providers stay in Day 11. Basket edits never write
sale rows, receipt allocations or outbox events.

## Grounding resolutions

Recorded after checking the plan against the code on 14 October 2026.

- Reference payloads were unversioned. All feed rows and snapshots move to `v: 2` with explicit v1 upcasters
  built on `createEventDecoder`. v1 products upcast with `barcodes: []`, which loses data, so tills persist
  `till_state.reference_version` and force a full snapshot (cursor `0`, not bootstrapped) once per worker
  run while it is below the known version. Stored rows decode with that version, so an upgraded offline till
  keeps working.
- Till SQLite migrations become an ordered list driven by `PRAGMA user_version`; step 0 is the existing
  idempotent schema. Shipped steps are never edited.
- `store_change.entity` CHECK widens to include `barcode-mapping` (expand only).
- Mapping routes live at `/catalogue/barcodes/mappings` (hyphen-free; not under `/barcodes`, which collides with
  `GET /barcodes/:code`).
- Embedded product codes resolve through `product_barcode` records. An exact barcode match always wins over a
  mapping. Archived products are excluded from lookup projections.
- Weight mappings declare a unit (`g`/`kg`) and decimals; price mappings declare decimals 0–4. Labels with an
  internal price check digit are unsupported in Day 10.
- The browser socket gains search/draft/scan/quantity/remove after the capability handshake; `recordSale` and
  `shutdown` stay trusted-only. Recoverable domain errors no longer close the socket on either side.
- Price-label drafts keep encoded gross; the completed-sale contract (ingest validation requires
  `unitPrice === price.amount`) must change in Day 11 before such drafts can be paid.
- Known, out of scope: tax-rule edits are not yet fed to tills (snapshot only).

## Slices

| Slice | Deliverable                                                                        | Commit                                               |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1     | PG mapping table, audited commands, `/catalogue/barcodes/mappings`                 | `feat: manage embedded barcode layouts`              |
| 2     | Barcodes and mappings in reference projections, all feed producers, v2 + upcasters | `feat: sync complete barcode references to tills`    |
| 3     | Till migrations, readiness, lookup projections and FTS5 search                     | `feat: add indexed offline catalogue search`         |
| 4     | Shared quotation, `snapshotAmount` in `@shopper/tax`, scan resolution              | `refactor: share authoritative till quotation`       |
| 5     | Durable audited drafts and extracted session validation                            | `feat: persist audited unpaid baskets`               |
| 6     | Bridge contracts, dispatch, recoverable errors, UI connection requests             | `feat: expose basket operations through till bridge` |
| 7     | Till sale screen and backoffice mapping screen                                     | `feat: build keyboard first till sale screen`        |
| 8     | Final gates, branch review, verification record                                    | `docs: record day 10 verification`                   |

Each slice: failing tests first, implement, regressions, `/pre-merge-review`, fix, commit.

## Keyboard

F2 scan/search · Up/Down results · Enter add · F3 basket · Up/Down lines · F4 quantity · Delete remove line ·
F8 sync now · Escape close and return to scan.

## Rules at risk

Integer money and tax, `defineCommand()` with audit/feed in one transaction, tenancy on mappings, references,
indexes and drafts, versioned references with upcasters, adapter boundaries, permission data, guard sizes.

## Review exception

Codex was over its usage limit until 21 October 2026. Approved: each slice gets a manual `reviewer` pass against
the rules before its commit, and Codex reviews the complete branch before the final push.
