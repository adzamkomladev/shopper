# Day 13 Windows handoff

Everything below needs a Windows till PC or real devices. The Linux part of Day 13 is on branch
`day13-desktop-peripherals` (see [progress.md](progress.md)). Work through the steps in order, tick the
results table at the end and commit it to the branch you work on.

## 0. Prerequisites

- Windows 10/11 x64, Git, Node 24.21 (`vp env`), pnpm 12.9.1 (Vite+ installs it), Docker Desktop.
- No Visual Studio build tools are needed: `better-sqlite3-multiple-ciphers` and `serialport` load
  N-API prebuilds for win32-x64.
- Devices: the pilot receipt printer (USB), cash drawer (on the printer's RJ11), barcode scanner, and
  if available a serial pole display and a second HDMI screen.

## 1. Clone, install, services

```powershell
git clone <repo> shopper; cd shopper
git checkout day13-desktop-peripherals   # or main once merged
vp install --frozen-lockfile
vp run services:up
vp run db:reset; vp run db:seed
```

Check both native modules load under Node and under Electron-as-Node (the test spawns both):

```powershell
vp test --run tests/integration/till/storage/native.test.ts
```

## 2. Till host and hardware suites on Windows

```powershell
vp test --run tests/integration/till tests/integration/hardware
```

The Electron harness launches directly on win32 (no Xvfb). Expected Windows-only differences:

- `tests/integration/till/electron/secrets.test.ts` checks a POSIX file mode; it is skipped on win32.
- Serial tests use a python pty pair and do not run on Windows; step 7 replaces them.
- The spooler test's fake shell needs a shebang; on Windows use step 5 instead.

Record failures in the results table with the error text.

## 3. Provision a register

1. In the portal, Devices → issue an enrollment code for the pilot branch.
2. `vp run till:provision -- --upstream <api url> --org <orgId> --code <6 digits> --store <storeId> --shop "<shop name>" --name "Register 01"`
   It writes `%APPDATA%\Shopper\register.json`.

## 4. Sealed secrets (DPAPI)

1. Start the app (`vp run till:package -- --win nsis` and install it, or run the built Electron main).
2. After the first start: `%APPDATA%\Shopper\register.secret` exists, and `register.json` has no
   `deviceToken`.
3. Open `till.sqlite` with any SQLite tool: it must fail ("file is not a database").
4. Log in as another Windows user and copy `register.secret`: the app must refuse to start.

## 5. USB printer through the Windows spooler (RAW)

1. Dry run without hardware: add a printer "ShopperRaw" with the _Generic / Text Only_ driver on a
   `FILE:` port (or a local port writing to `C:\shopper-raw.bin`).
2. Settings → Register → printer Connection _USB_, choose `ShopperRaw`, Save, Test print. Compare the
   output file with the golden receipt bytes (`tests/integration/hardware` golden fixture).
3. Real printer: install the vendor driver, choose it, Test print and Open drawer.
4. Measure the time from "Charge" to paper. Over 1 s means a resident PowerShell process is worth
   adding (follow-up).

## 6. Profile tuning on the real devices

For each model you have (Epson, Xprinter, Bixolon) at 80 mm and, if available, 58 mm, check: cut
command, native QR vs bitmap fallback, drawer pin and pulse (`ESC p 0 25 250`), columns, code page.
Change `packages/hardware/src/profiles.ts` only with a written reason, and add a photo of the printed
receipt to `docs/plans/day13/screenshots/`.

## 7. Serial devices (COM ports)

- Serial printer, pole display (Epson DM-D: `ESC @`, `0C`, `US $ x y`) and serial scanner: choose
  them in Settings with the right COM port and baud. Two devices on one port are refused on save.
- Unplug the scanner and plug it back: scans resume within about 2 s.
- Unplug the pole display: the basket keeps working; the display catches up with the latest frame.

## 8. Windows fonts

Re-run `vp test --run tests/integration/hardware/render/equivalence.test.ts`. If more than 2% of
pixels differ, record the numbers and recalibrate the constants with a written reason.

## 9. Customer display on a second screen

Not testable on Linux (Xvfb cannot show Chromium two monitors). With a second HDMI screen:

1. Start the app: a frameless fullscreen display opens on the second screen.
2. Scan items: lines, highlighted latest line and total update. Pay cash: "Thank you" and change.
3. Unplug the screen: the window closes. Plug it back or swap monitors: it reopens on the new one.
4. Change the second screen's resolution: the window resizes.

## 10. Installer

```powershell
vp run till:package -- --win nsis
```

Install from `apps/till/electron/release/`, start, then uninstall and confirm `%APPDATA%\Shopper` is
kept. The installer is unsigned, so expect a SmartScreen warning (signing is the 31 Oct milestone).

## 11. Milestone run

1. Sign in online once as a cashier (email + password), so the register caches the verifier.
2. Pull the network cable. Sign out and sign in again: it works offline.
3. Scan real products (USB keyboard scanner and, if present, the serial one).
4. Take cash: the receipt prints and the drawer opens.
5. Sign in as an inventory user and queue a stock count (Inventory tab).
6. Plug the cable back: the sale is acknowledged, the receipt PDF uploads and the count is accepted
   (Inventory queue shows _Sent_).

## Results

| Step                  | Result | Notes |
| --------------------- | ------ | ----- |
| 1 Install and natives |        |       |
| 2 Suites on Windows   |        |       |
| 3 Provision           |        |       |
| 4 DPAPI               |        |       |
| 5 Spooler RAW         |        |       |
| 6 Profiles            |        |       |
| 7 Serial              |        |       |
| 8 Fonts               |        |       |
| 9 Second screen       |        |       |
| 10 Installer          |        |       |
| 11 Milestone          |        |       |
