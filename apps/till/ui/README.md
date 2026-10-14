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
not settle payments or enroll devices.
