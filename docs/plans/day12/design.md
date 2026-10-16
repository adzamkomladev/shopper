# Day 12 design — contracts

The contracts every slice builds against. The plan is in [plan.md](plan.md).

## Units

- Paper widths: `80` mm → 576 dots, printable 72 mm, 48 columns. `58` mm → 384 dots, printable 48 mm, 32 columns (font A, 12 dots wide).
- Raster resolution is 203 dpi (8 dots/mm). Rendered PNGs use one pixel per dot.
- Amounts are 4-dp integers; they print through `@shopper/money` with the `GHS` prefix.

## `@shopper/hardware`

| Export      | Contents                                                         | Imported by                |
| ----------- | ---------------------------------------------------------------- | -------------------------- |
| `.`         | types, profiles, `escpos()` encoder, `encodeReceipt`, `qrMatrix` | host, tests                |
| `./network` | `networkPrinter`, `printerDrawer` (`node:net`)                   | host only                  |
| `./receipt` | `ReceiptView` React component (Satori-safe)                      | till-ui, renderers         |
| `./render`  | `receiptHtml`, `pngPdf`, fonts                                   | box/cf renderers, Electron |
| `./schemas` | Electron render IPC (`renderRequest`, `renderReply`)             | Electron, host             |

Profiles:

| Model      | Native QR            | Cut                          | Raster   | Drawer pulse     |
| ---------- | -------------------- | ---------------------------- | -------- | ---------------- |
| `epson`    | `GS ( k`             | `GS V 66 0` (feed + partial) | `GS v 0` | `ESC p 0 25 250` |
| `xprinter` | no → `GS v 0` bitmap | `GS V 66 0`                  | `GS v 0` | `ESC p 0 25 250` |
| `bixolon`  | `GS ( k`             | `ESC i`                      | `GS v 0` | `ESC p 0 25 250` |

Driver errors: `PrinterOffline { cause }` on refused, reset or timed-out connections. A print is complete when the socket closes after `end`.

## Renderer port (`@shopper/ports`)

```ts
type RenderFormat = "pdf" | "png";
interface Renderer {
  receipt(
    receipt: Json,
    options: { paperMm: 58 | 80; reprint: boolean },
    format: RenderFormat,
  ): Promise<Uint8Array>;
}
```

- The PNG is `dots` wide with auto height.
- The PDF has one page, `mm` wide, with height matching the PNG ratio.
- Adapters reject invalid receipts by parsing them with `receiptDocument`.

The adapters:

| Adapter  | Pipeline                                                         |
| -------- | ---------------------------------------------------------------- |
| box      | satori → resvg-wasm → pdf-lib                                    |
| cf       | `BROWSER.quickAction("screenshot")` over `receiptHtml` → pdf-lib |
| Electron | hidden window over `receiptHtml` → `printToPDF` / `capturePage`  |

## Register settings (till SQLite `till_setting`, one row per device)

```ts
registerSettings = {
  storeName: string; registerName: string;           // display overrides; receipt branch line
  printAutomatically: boolean; paperMm: 80 | 58;
  clearCartAfterSale: boolean; requirePinForReturns: boolean; // PIN enforced Day 14
  printer: null | { model: "epson" | "xprinter" | "bixolon"; connection: { kind: "network"; host: string; port: number } };
}
```

- `revision` is an integer. A save with a stale `expectedRevision` → `CONFLICT`.
- A save needs `register.settings`.
- Audit `till.settings.save` stores `{before, after}`.

## Receipt output (till SQLite `receipt_output`, one row per local sale)

- Columns: `printed_at`, `print_error`, `reprints`, `pdf`, `pdf_sha256`, `pdf_size`, `asset_id`, `uploaded_at`, `upload_attempts`, `next_upload_at`.
- Audits: `receipt.print`, `receipt.reprint`, `receipt.pdf.store`, `receipt.pdf.upload`.
- The drawer kicks only for a sale with a cash tender, and only on the first print; it never kicks on a reprint.

## Bridge (browser ↔ host)

Requests:

- `settings.save {settings, expectedRevision}`
- `printer.test`
- `drawer.test`
- `receipt.print {saleId}`

`hostStatus` gains:

- `settings {revision, value, canEdit}`
- `printer {state: "unconfigured" | "ready" | "offline", lastJob: {saleId|null, outcome, message} | null}`
- `registerCode`

`purchaseDetails` gains `delivery {printedAt, reprints, pdf: "pending" | "uploaded" | null}`.

## Upload (PG `0018_receipts.sql`, API)

Schema:

- `asset.purpose` gains `sale_receipt`; `asset.bucket` gains `receipts`.
- Policy: `sale_receipt ⇒ bucket receipts, expires_at null`.
- `sale.receipt_asset_id uuid`, with an FK from `(org_id, receipt_asset_id)` to asset.

Device-authenticated endpoints:

- `POST /sync/receipts {saleId, size, sha256}`
  - Rejections: 404 when the sale isn't this device's; 413 when the size exceeds 1 MiB.
  - Success: `{assetId, url, headers}`. Idempotent per sale.
- `POST /sync/receipts/:assetId/confirm`
  - The server does a bounded read and checks size and sha256. A mismatch → 409.
  - It links `sale.receipt_asset_id`. Audited.

Object key: `{orgId}/receipts/{saleId}.pdf` in the receipts bucket. Storage per adapter:

- cloud: R2 `RECEIPTS` binding, plus an S3 signer;
- box: RustFS.

The upload runs after the sale is acknowledged. It is triggered on start, on acknowledgement and on Sync now, with push backoff between attempts.
