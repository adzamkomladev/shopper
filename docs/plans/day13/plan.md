# Day 13: desktop register, back office and real peripherals (Linux part)

## Context

Notion Day 13, "WINDOWS: Electron + real hardware", makes the till a packaged Electron app that drives real peripherals. It also adds a back-office mode to the desktop app, and it picks up the Day 12 carry-overs: packaging satori and resvg, USB and serial connection kinds, and scanner, display and scale drivers.

We are on the Ubuntu server, with no Windows machine, no wine and no devices. **User decision:** build and prove everything that can be proven on Linux, then write `docs/plans/day13/windows-handoff.md` so the user can finish the Windows-only work on their Windows machine.

The user also chose:

- **Back office:** the full spec. Online back office, plus offline reports and offline stock count and receiving.
- **Customer display:** included.
- **Data:** all data is disposable, so resets are fine.
- **Review:** Codex is unavailable, so the `reviewer` and `ui-reviewer` agents review.
- **Commits:** one commit per slice, and a single push at the end.

**Defaults I took (change them at approval if you want):**

- Work in a **separate git worktree** on branch `day13-desktop-peripherals`, cut from `origin/main`. Your dirty `fix/portal-prerender-shell` checkout stays untouched.
- `tillPermissions` gains only `report.read`, `stock.read` and `stock.write`. User, role and device admin stay in the portal.
- At the end: push, open the PR, merge once CI is green (as on Day 12), then update Notion.

## Decisions

1. **Keep the forked host and its secured WebSocket bridge**, rather than the spec's in-process host with IPC. Native SQLite and serial I/O stay out of Electron's main process and crash domain. The host also gains:
   - static serving of the built till UI, so the packaged app loads `http://127.0.0.1:<port>/`;
   - a `/desktop/*` and `/api/*` surface.

   There is no preload script.

2. **Native modules are N-API.** `better-sqlite3-multiple-ciphers@13.0.3` and `serialport@13` both ship N-API prebuilds for win32-x64 and linux-x64, so one binary serves both Node and Electron.
   - **No `@electron/rebuild`.** electron-builder runs with `npmRebuild:false`.
   - A Linux `electron-builder --dir` smoke test runs under Xvfb. It proves the asar layout, `asarUnpack` for `.node` and `.wasm` files, satori and resvg loading, and the host forking from inside the asar.
3. **Encryption:**
   - The till SQLite is encrypted with SQLCipher via SQLite3MC.
   - Electron's `safeStorage` (DPAPI on Windows) seals a random 32-byte DB key and the device token into `userData/register.secret`.
   - The token is removed from `register.json`.
   - The sealed secrets reach the host only in the `start` message.
   - The app refuses to start if encryption is unavailable.
4. **Sign-in follows Figma "New Login" (173:3104 empty, 217:4811 filled; input 12:66): username and password.**
   - The host calls the device login with the device token. `POST /cashiers/login` gains an `{email, password}` form, verified against the Better Auth credential account. The PIN form stays for later manager approvals.
   - The API already accepts this device principal and limits it to `tillAllowed` permissions.
   - **Offline:** an scrypt password verifier is cached in the encrypted DB. It lasts 7 days and locks for 15 minutes after 5 failures; both limits are `ponytail:` knobs. Offline sign-in resumes the user's still-valid server session. Otherwise it grants only report and stock permissions.
5. **The desktop shell follows the Figma "New Login" page (339:9672 dashboard, 339:9712 and 339:9756 checkout) and its responsive variants (227:4900).**
   - **Window:** a frameless window using Electron's `titleBarStyle:'hidden'` and `titleBarOverlay`. The OS draws the minimize, maximize and close buttons, so no preload is needed. The title bar shows "Shopper App".
   - **Register status bar:** Menu, then "<user> · <register>", then a Connected/Offline indicator.
   - **Tabs, shown by permission (never by role name):**
     - Dashboard: `report.read`
     - Checkout: `sale.create`
     - Inventory: `stock.read`
     - Sales Reports: `report.read`
   - **Menu drawer:**
     - Previous purchases
     - Settings
     - Back office: the full `@shopper/backoffice`, online only
     - Sign out
   - **Checkout** gets the Figma layout: search and scan, action tiles, a cart panel with qty controls, Clear cart, Total and a Checkout button. Checkout then hands off to the existing tender/payment flow. Only tiles with a working feature today are shown (Scan product, Add custom item and Add discount, if the sale engine supports them). Add customer, Create invoice and Arrange delivery appear when those modules land.
   - **Dashboard:** the Figma tiles backed by till data (Total sales, Total returns, Products, Discounted sales), a date range, Download (CSV) and Quick actions. The Customers and Returning customers tiles wait for the customer module.
6. **Back office on the desktop:**
   - The host proxies `/api/*` upstream as the device principal, so `@shopper/backoffice` runs unchanged on the same origin.
   - The proxy is guarded by an HttpOnly, SameSite=Strict capability cookie, plus loopback-Host and Origin checks.
   - Upstream `Set-Cookie` headers are stripped, and the proxy never forwards `/auth`, `/sync` or `/cashiers`.
   - **Offline:**
     - the read-only **register day report** (from till SQLite, using `@shopper/money`);
     - **stock count and receiving.** These go in their own till queue (`stock_document`) to `POST /sync/stock`, not the sale outbox, which has a foreign key to `local_sale`. The queue reuses the Day 12 receipt-upload worker pattern and uploads only after the sale backlog has drained.
   - **Server side:**
     - acceptance is a `defineCommand` and is audited;
     - a count's delta is computed as of `countedAt`;
     - the proof and `stock.write` are re-checked.
   - The Dashboard, Inventory (count and receiving) and Sales Reports screens live in `@shopper/backoffice`, behind `createBackofficeRoutes(root, { register: true })`. The till UI mounts them inside the desktop shell.
7. **Peripherals:**
   - `@shopper/hardware/serial` adds a serial printer, scanner and pole display (Epson DM-D) using `serialport`, tested over a python pty pair.
   - `@shopper/hardware/spooler` adds a Windows RAW spooler driver: PowerShell `Add-Type` P/Invoke `WritePrinter`, with the bytes passed in base64 on stdin. Here it is tested with a fake shell; the real proof goes to the handoff.
   - **Scale is deferred** until the pilot's scale model is known. The `Scale` type stays.
8. **Customer display:**
   - Electron's `screen.getAllDisplays()` finds a second monitor, and a borderless fullscreen window opens there at `/?display`. It handles hot-plug.
   - With only one monitor, no window opens.
   - The host broadcasts the basket draft on every change; the HDMI page and the pole display both consume it.

## Slices

**The loop for every slice:**

1. The `test-author` agent writes failing tests.
2. `/tdd-slice`, with the `implementer` or `ui-builder` agent.
3. The `checker` agent (`vp check`, `vp run guard`, tests).
4. The `reviewer` agent, plus `ui-reviewer` for `.tsx`.
5. Commit, and update `docs/plans/day13/progress.md`.

**Skills used:**

- `cloud-box-parity` for the API and sync routes;
- `/ui-screen`, `/ui-verify` and `/playwright-cli` for UI, at desktop, laptop, tablet, mobile, till and display sizes;
- `figma-use` for the new frames.

| #   | Slice                                                                       | Key tests (written first)                                                                                                                                                                                                                                                                     | Main files                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Setup and plan docs                                                         | none                                                                                                                                                                                                                                                                                          | Worktree; delete the stray `apps/till-{electron,host,ui}` tsbuildinfo dirs; check release age of the new deps and `allowBuilds`; `services:up`, `db:reset`, `db:seed`; `docs/plans/day13/{plan,design,progress}.md`                                                                                                                                                              |
| S1  | Encrypted till SQLite                                                       | `tests/integration/till/storage/{encryption,native}.test.ts`: no plaintext header, wrong key refused, WAL/FTS5/migrations work encrypted, same build loads under Node and Electron-as-Node                                                                                                    | `packages/adapters/box/src/till/database.ts` (swap `node:sqlite` for SQLite3MC, keep the sqlite-proxy), config `databaseKey`, `tooling/build/server.mjs` externals                                                                                                                                                                                                               |
| S2  | Sealed secrets; host serves the UI                                          | `till/electron/secrets.test.ts` (Xvfb, `--password-store=basic`), `till/host/static.test.ts` (UI served, SPA fallback, non-loopback Host refused)                                                                                                                                             | `apps/till/electron/src/{secrets,main}.ts`, host `till/host/http/{guard,static}.ts`, Electron test harness                                                                                                                                                                                                                                                                       |
| S3  | Username/password sign-in, online and offline                               | `auth/devices/login.test.ts` (password form, revoked device 401, lockout), `auth/roles/till.test.ts`, `till/host/session/{signin,offline}.test.ts`                                                                                                                                            | `packages/auth/src/devices/login.ts` password form, `tillPermissions`, till migration `till_staff` (verifier, attempts, locked_until, verified_at), bridge `session.ts` ops, host `till/host/session.ts`, receipt cashier name from the session                                                                                                                                  |
| S4  | Back-office proxy on the host                                               | `till/host/backoffice/proxy.test.ts` (device principal upstream, 401 without the cookie, cross-origin refused, denied routes, offline local session/permissions, Set-Cookie stripped)                                                                                                         | `till/host/http/{proxy,local}.ts`, `/desktop/unlock`                                                                                                                                                                                                                                                                                                                             |
| S5  | Register day report                                                         | `till/reports/today.test.ts` (golden day by tender, hour and top products exact to 1/10000; voids and holds excluded; empty day; UTC/Accra day)                                                                                                                                               | `packages/core/src/till/reports.ts`, `schemas/till/report.ts`, `GET /api/register/report`                                                                                                                                                                                                                                                                                        |
| S6  | Stock count and receiving                                                   | `core/stock/{count,receiving}.test.ts`, `sync/stock/upload.test.ts`, edge worker `stock.test.ts` (delta at countedAt, idempotent/CONFLICT, FORBIDDEN, audit, uploads only after the sale backlog, blocked with reason, backoff)                                                               | PG `0019_stock_documents.sql` (reasons `count`/`receipt`, `stock_document`, `stock_movement.document_id`), `core/stock/accept.ts`, `api/sync/stock.ts`, till `stock_document` step, `core/till/stock.ts`, `sync/uploads/stock.ts`, host `/api/register/{stock,products}`                                                                                                         |
| S7  | Drivers                                                                     | `hardware/serial/{printer,scanner,display}.test.ts` over a pty pair (`tests/support/hardware/serial.ts`), `hardware/printing/spooler.test.ts` (fake shell)                                                                                                                                    | `packages/hardware/src/serial/{port,printer,scanner,display}.ts`, `src/spooler.ts`, exports `./serial` and `./spooler`                                                                                                                                                                                                                                                           |
| S8  | Device kinds in settings and host wiring                                    | `hardware/printing/connections.test.ts` (serial golden receipt and a single drawer kick; USB off Windows fails the print, not the sale), `hardware/serial/host.test.ts` (scan broadcast, pole display, port swap, `printers.list`)                                                            | `core/schemas/till/register.ts` (union of network, usb and serial; `scanner`, `display`), `receipts.ts` `printerFor`, host `peripherals.ts`, bridge schemas, UI settings schema/draft                                                                                                                                                                                            |
| S9  | Customer display window                                                     | `till/host/bridge/display.test.ts`, `till/electron/display.test.ts` (Xvfb with two monitors via xrandr `--setmonitor`)                                                                                                                                                                        | `apps/till/electron/src/display.ts`, basket broadcast                                                                                                                                                                                                                                                                                                                            |
| F   | Missing states as new frames on the "New Login" page, in the existing style | none                                                                                                                                                                                                                                                                                          | **Login:** signing in, wrong password (attempts left), locked, offline with a cached user, never signed in here. **Shell:** offline status, menu drawer. **Inventory:** count and receiving with the queue (Queued / Sent / Rejected). **Sales Reports.** **Settings:** printer editor with Network/USB/Serial and device rows. **Customer display:** idle, basket, paid, closed |
| U1  | Login and desktop shell                                                     | e2e `till/ui/signin/{screen,live}.spec.ts` (every state, keyboard, axe; "cashier lands on Checkout", "admin lands on Dashboard and opens Back office from the Menu", "sign-out returns to login"), `shell/offline.spec.ts` (tabs narrow and Back office is disabled when upstream is stopped) | `apps/till/ui/src/screens/signin`, `components/shell/{titlebar,status,tabs,menu}.tsx`, `session/store.ts`, `backoffice/index.html` and `src/backoffice/main.tsx` (multi-page Vite), Electron `titleBarOverlay`                                                                                                                                                                   |
| U1b | Checkout layout from 339:9712, 339:9756 and 227:4900                        | e2e `till/ui/checkout/screen.spec.ts` (empty, items, qty, clear cart, Checkout opens tender; at 1366, 1024 and 768) and the existing sale specs kept green                                                                                                                                    | `apps/till/ui/src/screens/sale/*`, `components/sale/{actions,cart}.tsx`, reusing the current basket and tender components                                                                                                                                                                                                                                                        |
| U2  | Dashboard, Sales Reports and Inventory                                      | e2e `backoffice/{dashboard,report,stock}.spec.ts` (tiles, date range, CSV download, quick actions; count and receiving, queued then sent, rejected with reason, no permission)                                                                                                                | `packages/backoffice/src/routes/register.tsx`, `screens/register/{dashboard,report}`, `screens/stock/{count,receiving}`, `components/stock/document/*`, `queries/{register,stock}`                                                                                                                                                                                               |
| U3  | Settings device editors and serial scan                                     | e2e `settings/{devices,serial}.spec.ts`, scanner spec                                                                                                                                                                                                                                         | `components/settings/printer/{network,usb,serial}.tsx`, `devices.tsx`, sale store `scan`                                                                                                                                                                                                                                                                                         |
| U4  | Customer display screen                                                     | e2e `display/{screen,live}.spec.ts` at 1920, 1366, 1024 and 800                                                                                                                                                                                                                               | `screens/display/screen.tsx`, `components/display/*`, `display/store.ts`                                                                                                                                                                                                                                                                                                         |
| P   | Packaging and provisioning                                                  | `till/electron/package.test.ts` (unpacked Linux app starts the host from the asar, serves the UI, opens the encrypted DB, renders a receipt; every `.node`/`.wasm` is unpacked), `tooling/till/provision.test.ts`                                                                             | `apps/till/electron/electron-builder.yml`, `tooling/build/package.ts` (`vp run till:package -- --linux dir`, `--win nsis`), `tooling/till/provision.ts`                                                                                                                                                                                                                          |
| D   | Docs and handoff                                                            | none                                                                                                                                                                                                                                                                                          | `testing.md`, `architecture.md`, `platforms.md`, `layout.md`, `frontend.md`, `deployment.md`, the hardware and till READMEs, `docs/plans/day13/{verification,windows-handoff}.md`                                                                                                                                                                                                |

**If the day overruns, cut in this order:**

1. the pole display;
2. the `printers.list` dropdown;
3. display hot-plug.

The HDMI customer display itself stays.

**New dependencies, pinned exact:**

- `better-sqlite3-multiple-ciphers@13.0.3` in `@shopper/adapters-box`;
- `serialport@13.0.0` in `@shopper/hardware`;
- `electron-builder@26.15.3` in `@shopper/till-electron` (dev).

## The Windows handoff (`docs/plans/day13/windows-handoff.md`)

1. **Prerequisites:** Node 24.21, pnpm, Docker Desktop.
2. **Install:** `vp install`, then check both native modules load under Node and under Electron-as-Node.
3. **Till-host suite:** run `tests/integration/till` and `tests/integration/hardware` on Windows.
4. **Provision:** run `vp run till:provision` with an enrollment code from the portal.
5. **DPAPI checks:**
   - `register.secret` exists and the token is gone from `register.json`;
   - another Windows user cannot open the DB.
6. **Spooler RAW:**
   - first on a Generic/Text Only printer on a FILE port, diffed against the golden bytes;
   - then on the real USB printer, with a test print, a drawer test and latency measured.
7. **Profile tuning on the real devices (Epson, Xprinter, Bixolon):** cut, QR, drawer pulse, 58 and 80 mm.
8. **Serial devices on COM ports:** printer, pole display and scanner.
9. **Windows fonts:** re-run the image-equivalence test.
10. **Second HDMI screen:** placement and hot-plug.
11. **Installer:** build the NSIS installer with `vp run till:package -- --win nsis`, install it, then uninstall it and confirm the data is kept.
12. **Milestone run:**
    1. Pull the network cable.
    2. Sign in with your username and password while offline.
    3. Scan real products.
    4. Take cash.
    5. Confirm the receipt prints and the drawer opens.
    6. Queue a stock count.
    7. Reconnect.
    8. Check everything syncs.
13. **Results:** fill in the results table and commit it.

## Verification

```sh
vp check && vp run guard
vp test --run tests/integration/till tests/integration/hardware tests/integration/core/stock tests/integration/sync/stock tests/integration/auth
vp test --run
vp run build && vp run typecheck && vp run e2e
vp run till:package -- --linux dir
```

Then:

- Run the `/ui-verify` loop with `playwright-cli` on every new screen and state, plus keyboard, console and overflow checks, and compare against the new Figma frames.
- Run a final `reviewer` and `ui-reviewer` pass.
- Push once, open the PR, wait for green CI, and merge.

## Notion

Update the Day 13 page:

- tick the tasks proven on Linux;
- set Status to "In progress";
- add a **Remarks (17 Oct)** section covering what shipped, test counts, the PR and merge, deviations, and a link to the Windows handoff:
  - **deviations:** the forked host and WebSocket bridge kept, no `@electron/rebuild`, a separate stock lane, the scale deferred;
  - **what remains for Windows.**

## Risks

- **Customer display test:** Chromium may ignore xrandr `--setmonitor` monitors. If it does, the Electron customer-display test moves to the handoff, with the reason recorded.
- **safeStorage:** on Linux it uses the basic backend, so DPAPI is proven only on Windows.
- **Late sales skew counts:** offline sales from other registers that are dated before a count can shift its delta. This is a `ponytail:` ceiling, to be fixed with a count-aware on-hand projection when stock reports land.
- **Imports from the desktop:** the presigned PUT would need bucket CORS for the desktop origin, so desktop imports are out of scope.
- **Left out for later:** in-app enrollment, cost prices on receiving, code signing, the scale.
