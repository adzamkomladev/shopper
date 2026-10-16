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

Save `receiptCodes` from the enrollment response (`branchCode` and `deviceCode`) in this private
configuration. An enrolled till can then issue overflow receipts offline before its first
handshake. Once a handshake has saved the codes in SQLite, restarts may omit this field. A fresh
till without either source refuses to record an unnumbered sale.

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
