# @shopper/hardware

Printer and peripheral layer shared by the till host and the renderers.

- `.`: `escpos()` byte builder, `encodeReceipt()`, `paper` and `printerProfiles` (epson, xprinter,
  bixolon), `qrMatrix()` and the `ReceiptPrinter`, `CashDrawer`, `Scanner`, `CustomerDisplay`,
  `Scale` types.
- `./network`: `networkPrinter()` (raw TCP 9100), `PrinterOffline`, `printerDrawer()`. Uses
  `node:net`, so host code only.
- `./receipt`: `ReceiptView`, the Satori-safe receipt tree (browser-safe, no node imports).
- `./render`: `receiptHtml()` (full HTML with embedded Geist), `pngPdf()` (pdf-lib, one page at paper
  width) and `receiptFonts` for Satori. Fonts come from `tooling/fonts/receipt.ts`
  (`vp run fonts:receipt`) into `fonts.gen.ts`.
