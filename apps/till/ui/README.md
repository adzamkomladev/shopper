# @shopper/till-ui

The register connection screen shows the configured shop and register, local host connectivity,
server connectivity, queued and blocked uploads, and the latest actionable error. Host and server
status are separate: a register can remain connected to its local host while the server is offline.

## Development

Start the till host using the private configuration described in
[the host README](../host/README.md). Its per-start `ready` message includes a bridge capability.
For the command below, configure the host to listen on port `5186`; if you choose another port,
change `SHOPPER_TILL_HOST_URL` to match. Run the UI with the host's loopback HTTP origin as the Vite
proxy target:

```sh
SHOPPER_TILL_HOST_URL=http://127.0.0.1:5186 vp run -F @shopper/till-ui dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://localhost:5174/#<capability-from-this-host-start>` with that start's capability in the
URL fragment. The exact origin (scheme,
hostname, and port) must be present in the host's allowed `origins` list. For example, opening the
page at `http://localhost:5174` requires that exact origin; `http://127.0.0.1:5174` is a different
origin. Keep the capability private, use it only for the local register, and reopen the page with a
new capability after restarting the host. Do not put a real capability in source control, a ticket,
or a shared URL.

The UI connects to the same-origin `/bridge` WebSocket, which Vite proxies to
`SHOPPER_TILL_HOST_URL` (default `http://127.0.0.1:5186`). The fragment is removed from the address
bar during startup and the capability remains in page memory. Device credentials and cashier
session proofs stay with the host and are never sent to browser storage.

## Screen states and actions

The screen covers disconnected, connecting, live, polling, offline, syncing, low and exhausted
receipt blocks, blocked uploads, revoked devices, and a required register upgrade. It distinguishes
local host availability from server status and shows pending and blocked sales with recovery guidance.

- **Connect / Reconnect** opens or restores the local host connection (`C`).
- **Sync now** asks the host to upload eligible sales and pull server changes (`Y`).
- **About** shows the register application details (`A`).

Sales remain on the register after upload. This screen reports connection and sync status; it does
not settle payments or enroll devices (the enrol screen below does).

## Enrolment (Day 25)

A host with no identity answers `kind: "unenrolled"`, and the UI shows "Set up this till" before
anything else: the shop code, the one-time code and a till name, sent as `device.enrol`. A scanner
reading the portal's QR (`shopper:enrol?shop=…&code=…`) types into whichever field has focus; the
form recognises the payload, fills both codes and its Enter submits. Each refusal has its own message.
After `kind: "enrolled"` the host restarts on the same bridge, and the UI reconnects (up to 20 s) and
moves on to sign-in.

## Sign-in and the desktop shell (Day 13)

When the host reports no signed-in user (`status.user` is `null`), the UI shows the sign-in screen
(Figma "New Login") before anything else: email and password go to the host as `session.signIn`, and
the host's error codes (`INVALID_CREDENTIALS`, `SIGN_IN_LOCKED`, `OFFLINE_UNAVAILABLE`,
`DEVICE_REJECTED`, `SIGN_IN_UNAVAILABLE`) each get their own message. A register that already has a
session (`config.session`) skips it. After a sign-in the UI trades the bridge capability for the
back-office cookie with `POST /desktop/unlock`; that only works when the page is served by the host
(Electron), not through the Vite dev server.

The signed-in shell is a 40px title bar (the drag region in Electron, a plain bar in a browser), the
register status bar (Menu, `<user> · <register>`, Connected / Offline), and tabs shown by permission:
Dashboard and Sales Reports need `report.read`, Checkout needs `sale.create`, Inventory needs
`stock.read`. The landing tab is Checkout with `sale.create`, otherwise the first tab the user may
open. The Menu drawer holds Previous purchases, Settings, Back office (disabled with "Needs
connection" while the server is unreachable) and Sign out.

| Keys                  | Action                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| Ctrl+M                | Menu drawer (Alt+M is Settings' display-device toggle, so the shell does not use it) |
| Ctrl+Shift+L          | Sign out (Alt+L is Settings' reload, so the shell does not use it)                   |
| Ctrl+1 to Ctrl+4      | Dashboard, Checkout, Inventory, Sales Reports (Alt+1 to Alt+4 is the tender method)  |
| Alt+S / Alt+P / Alt+T | Checkout, Previous purchases, Settings                                               |

`<section data-slot="register-dashboard">`, `register-inventory` and `register-reports` are the
regions the back-office slice fills.

## Register sections and the back office (Day 13)

Dashboard, Inventory and Sales Reports are `@shopper/backoffice/register` components mounted in the shell's
`data-slot="register-*"` regions. The tab strip and the heading stay in the shell; the shell passes
`online` (server reachable) so the sections can say what offline changes. In `harness/index.html` they run
against the real components, and the specs in `tests/e2e/till/ui/backoffice/` stand in for the host's `/api`
with `page.route`.

The build has two pages: `index.html` (the register) and `backoffice/index.html`, the full back office the
host serves under `/backoffice/` (router `basepath: "/backoffice"`, `/login` leaves for the register's `/`).
In `vp dev` only `/backoffice/` itself resolves; deep links need the host's SPA fallback.
