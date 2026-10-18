# @shopper/hardware

Printer and peripheral layer shared by the till host and the renderers.

- `.`: `escpos()` byte builder, `encodeReceipt()`, `paper` and `printerProfiles` (epson, xprinter,
  bixolon), `qrMatrix()` and the `ReceiptPrinter`, `CashDrawer`, `Scanner`, `CustomerDisplay`,
  `Scale` types.
- `./network`: `networkPrinter()` (raw TCP 9100), `PrinterOffline`, `printerDrawer()`. Uses
  `node:net`, so host code only.
- `./serial`: `serialPrinter()`, `serialScanner()` (one barcode per CR/LF line), `serialDisplay()`
  (Epson DM-D, 2x20) and `listSerialPorts()`, over `serialport`. Host code only; never import it from browser code.
- `./spooler`: `spoolerPrinter()` sends raw bytes to a Windows printer by name through PowerShell
  and winspool (`USB printers need Windows` elsewhere).
- `./receipt`: `ReceiptView`, the Satori-safe receipt tree (browser-safe, no node imports).
- `./render`: `receiptHtml()` (full HTML with embedded Geist), `pngPdf()` (pdf-lib, one page at paper
  width) and `receiptFonts` for Satori. Fonts come from `tooling/fonts/receipt.ts`
  (`vp run fonts:receipt`) into `fonts.gen.ts`.
