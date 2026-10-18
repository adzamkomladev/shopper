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
vp install --frozen-lockfile   # or: vp exec pnpm install --frozen-lockfile
vp run services:up             # SHOPPER_POSTGRES_PORT=5433 if a native PostgreSQL holds 5432
vp run db:reset; vp run storage:setup
```

See the Windows notes in [developer-experience.md](../../engineering/developer-experience.md#setup).

Check both native modules load under Node and under Electron-as-Node (the test spawns both):

```powershell
vp test --run tests/integration/till/storage/native.test.ts
```

## 2. Till host and hardware suites on Windows

```powershell
vp test --run tests/integration/till tests/integration/hardware
```

The Electron harness launches directly on win32 (no Xvfb) and stops the tree with `taskkill /T /F`.
Expected Windows-only differences:

- POSIX file-mode checks (secrets, provision) are skipped on win32.
- Serial tests use a python pty pair and are skipped on Windows; step 7 replaces them.
- The fake-shell spooler tests are skipped; a win32-only test runs the real PowerShell script instead.
- Windows-only tests: DPAPI wraps the key and a copied `register.secret` is refused; the packaged
  app is named `Shopper`.

Record failures in the results table with the error text.

## 3. Provision a register

1. In the portal, Devices → issue an enrollment code for the pilot branch.
2. `vp run till:provision -- --upstream <api url> --org <orgId> --code <6 digits> --store <storeId> --shop "<shop name>" --name "Register 01"`
   It writes `%APPDATA%\Shopper\register.json`. A box upstream needs `SHOPPER_S3_RECEIPTS_BUCKET`
   (`shopper-receipts-dev`, created by `vp run storage:setup`), or receipt PDFs stay on the register.

## 4. Sealed secrets (DPAPI)

1. Start the app (`vp run till:package -- --win nsis` and install it, or run the built Electron main).
2. After the first start: `%APPDATA%\Shopper\register.secret` exists, and `register.json` has no
   `deviceToken`.
3. Open `till.sqlite` with any SQLite tool: it must fail ("file is not a database").
4. Log in as another Windows user and copy `register.secret`: the app must refuse to start.

## 5. USB printer through the Windows spooler (RAW)

1. Dry run without hardware: add a printer "ShopperRaw" with the _Generic / Text Only_ driver on a
   `FILE:` port (or a local port writing to `C:\shopper-raw.bin`).
2. Run the opt-in byte check, which spools the golden receipt and compares the port file:
   `$env:SHOPPER_TEST_RAW_PRINTER='ShopperRaw'; $env:SHOPPER_TEST_RAW_FILE='C:\shopper-raw.bin'; vp test --run tests/integration/hardware/printing/spooler.test.ts`.
   Then Settings → Register → printer Connection _USB_, choose `ShopperRaw`, Save, Test print.
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

Run on 18 Oct 2026: Windows 11 Pro 26300, one screen, no printer, drawer, scanner or COM port.

| Step                  | Result  | Notes                                                                                                                                                                                                                       |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Install and natives | pass    | Fixed: CRLF checkout broke the lockfile (`.gitattributes`). Natives load under Node and Electron.                                                                                                                           |
| 2 Suites on Windows   | pass    | till + hardware + provision: 266 passed, 0 failed, 16 skipped. Fixed the harness (no Xvfb, `taskkill`, builds the host).                                                                                                    |
| 3 Provision           | pass    | Against a local box. Fixed: `--` broke argument parsing; no `X-Shopper-Org` header (400 on a multi-tenant API).                                                                                                             |
| 4 DPAPI               | pass    | Secret sealed, token scrubbed, database not SQLite, key `DPAPI`-wrapped, copied secret refused. Fixed a data-loss bug, see below. Second Windows user: not run.                                                             |
| 5 Spooler RAW         | partial | Real PowerShell script compiles and a missing queue is `PrinterOffline`. Adding `ShopperRaw` needs an admin; byte check is opt-in.                                                                                          |
| 6 Profiles            | open    | Needs the pilot printers.                                                                                                                                                                                                   |
| 7 Serial              | open    | No COM devices.                                                                                                                                                                                                             |
| 8 Fonts               | pass    | 0.76% of pixels differ (limit 1.75%), heights 1003/1003. No recalibration.                                                                                                                                                  |
| 9 Second screen       | open    | One monitor.                                                                                                                                                                                                                |
| 10 Installer          | pass    | Per-user NSIS installs, starts, uninstalls and keeps `%APPDATA%\Shopper`; reinstall reopens it. Fixed: userData was `%APPDATA%\shopper-register`.                                                                           |
| 11 Milestone          | pass*   | Installed app over CDP: online sign-in (cashier, inventory), box stopped, offline sign-in, keyboard-wedge scans, cash sale, count queued, box back: sale and count accepted, PDF uploaded on Sync now. *No paper or drawer. |

Fixes made on Windows (all with tests):

- **Lost key (data loss).** Chromium writes `Local State`, which holds the DPAPI-wrapped key, about
  10 s after first start. A crash or power cut in that window left `register.secret` unreadable for
  good. The first seal now waits until the key is on disk.
- **Provisioned register never started.** The host required at least one `origins` entry, but
  provisioning writes none. A host serving its own UI now allows that. The app also quit silently,
  because a GUI exe has no console. Follow-up: show the host's start error.
- Window controls are drawn in the OS theme colours (they were white on the dark title bar).
- PowerShell and `taskkill` run by absolute path. A service or kiosk `PATH` may lack System32.

Screenshots: [screenshots/windows](screenshots/windows).
