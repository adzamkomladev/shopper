# Till host

The Node development host owns the on-disk SQLite database, enrolled-device token and private
cashier-session proof. Build with `vp -C apps/till/host run build`, then run:

```sh
node apps/till/host/dist/server.js /absolute/path/to/private-host-config.json
```

Keep this configuration outside version control with owner-only file permissions. Its validated
fields are `sqlitePath`, `identity` (`orgId`, `deviceId`, `storeId`, `branchId`, `shopName`,
`registerName`), `upstream` (API base URL), `deviceToken`, `session` (authorized cashier session or
null), `references` (optional provisioned products/prices/dated tax rules), `origins` (exact allowed
browser origins), and `port` (loopback listener; zero chooses an available port).

The register database holds sales and staff PIN hashes, so the host refuses to start without
`databaseKey` (64 lowercase hex; Electron generates it and seals it with the OS keystore). For
development and tests only, `"plaintext": true` opts out by name and keeps a plain SQLite file.

Save `receiptCodes` from the enrollment response (`branchCode` and `deviceCode`) in this private
configuration. An enrolled till can then issue overflow receipts offline before its first
handshake. Once a handshake has saved the codes in SQLite, restarts may omit this field. A fresh
till without either source refuses to record an unnumbered sale.

## Enrolling a fresh install (Day 25)

An installer writes only `sqlitePath`, `upstream`, `origins` and `port`. With no `identity` the host
starts in enrolment mode: its bridge answers `hello` and `status` with `kind: "unenrolled"` and accepts
one request, `device.enrol { shopCode, code, name }`. The host looks the shop up with `GET /orgs/:code`
and enrols with `POST /devices/enroll`. Refusals are `SHOP_NOT_FOUND`, `ENROL_REFUSED` (the server does
not tell a wrong code from an expired or used one), `ENROL_LOCKED` and `OFFLINE`. Nothing is written
on a refusal.

On success the bridge replies `kind: "enrolled"` with the identity, closes, and the host starts as an
enrolled till on the same port and capability, so the page reconnects without a new link. Run from a
file, the host writes `identity`, `deviceToken` and `receiptCodes` into it in one rename. Under a
parent (Electron) it sends `{ type: "enrolled", registration }` instead and waits for a new `start`;
Electron stores the file, seals the token and scrubs it as on any first start. A crash after the server
accepted the code but before the file is written leaves the till unenrolled, and it needs a new code.

Enrollment and session issuance use the existing API. The host automatically bootstraps references
from a snapshot, pulls the tail and listens for authenticated store-change nudges. If realtime is
unavailable, it falls back to capped polling. Restart with the same SQLite path to replay the retained outbox;
backlog upload works with `session: null` because each recorded sale retains its private proof.
A live authorized session is required for recording through the private process IPC channel.

The parent process starts the production executable with Node IPC and sends `{type:"start",
config}`. The host sends a ready message containing its loopback port and per-start bridge
capability. Browser development proxies `/bridge` to this host and receives the capability through
the launch URL fragment; it stays in memory. Restarting the host rotates the capability, so reopen
the UI with the new launch capability. Browser WebSockets permit status and retry actions only.
Device tokens and cashier proofs must never be put in the browser URL or storage. The public status
includes pull cursor/head, transport mode and receipt availability. **Sync now** (`Y`) retries both
uploads and downloads; receipt blocks are delivered only by POST handshake/push replies.

Under Electron the start message also carries `renderer:"parent"`. The host then builds a
`parentRenderer` and exposes it as `host.renderer`. It sends `{type:"render", id, receipt, paperMm,
reprint, format}` to its parent and resolves on `{type:"rendered", id, data}` (base64) or rejects on
`{type:"render-failed", id, message}`, or after 15 s. Both replies are routed to the renderer before
bridge dispatch. No bridge operation requests a render yet.

Development SQLite is durable but unencrypted. Native encrypted storage and Electron launch
wiring remain later milestones.

The sealed host configuration may include `receiptReference` with `orgName`, `tin`, `branchName`,
`address`, `deviceName`, `cashierName` and `footer`. These values are captured in the stored receipt
when the sale completes; immediate completion and Purchases return that same document. Omitted
org/register names use `identity.shopName` and `identity.registerName`; TIN/address remain null
unless configured. For example:

```json
{
  "receiptReference": {
    "orgName": "Adom Mart",
    "tin": "C0000000000",
    "branchName": "Osu",
    "address": "Oxford Street, Accra",
    "deviceName": "Till 1",
    "cashierName": "Ama Mensah",
    "footer": "Thank you for shopping with us"
  }
}
```

The cashier name belongs to the configured signed-in session and must be refreshed when the host
is started with a different cashier. Credentials and these private configuration values never go
to browser requests.

### Offline selling and the clock (Day 24)

An offline sign-in past the server session's expiry starts an offline session derived from the last server
session: eight hours, no manager permissions, adopted by the server with the first upload or live request
that uses it. The host keeps a monotonic clock anchor from each handshake and corrects a wall clock set back
by more than a minute; the status reports `clockSkewMs` and the sale screen shows "Register clock is N h
ahead/behind" above five minutes. Integration tests shift the host's wall clock with the
`tests/support/till/host/clock.mjs` preload (`startTillHost(config, { clockOffsetMs })`, then `setClock`).
