# @shopper/hardware

Printer and peripheral layer shared by the till host and the renderers.

- `.`: `escpos()` byte builder, `encodeReceipt()`, `paper` and `printerProfiles` (epson, xprinter,
  bixolon), `qrMatrix()` and the `ReceiptPrinter`, `CashDrawer`, `Scanner`, `CustomerDisplay`,
  `Scale` types.
- `./network`: `networkPrinter()` (raw TCP 9100), `PrinterOffline`, `printerDrawer()`. Uses
  `node:net`, so host code only.
