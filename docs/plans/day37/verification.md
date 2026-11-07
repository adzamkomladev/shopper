# Day 37 verification

## Licence (`lic/1`)

- `tests/integration/licence/licence.test.ts` (3): the ladder (valid to day 29, warning from 30, locked at
  60), a confirmation resets it, a past `maintenanceUntil` changes nothing; missing, unreadable, forged,
  other-issuer and other-machine licences lock with their reason; a confirmation for another licence or
  from another key does not count. Signed requests: accepted; changed body, other key, stale time and
  missing headers refused. Break-checked: dropping the machine check fails it.
- `tests/integration/licence/readonly.test.ts` (3): **expired licence → the owner's change is 402 naming
  the licence, reads work, a golden till sale pushed through the same API is accepted**; Check in now sends
  a licence-signed request to a real cloud API, keeps the confirmation and the next change is 201. An
  unlicensed box shows a stable request code; the cloud refuses a forged check-in (401), an unsigned one
  (401), and a host without the key has no route. Break-checked: removing the licence line from
  `readOnlyGuard` fails it.
- `tests/integration/tooling/licence/issue.test.ts`: a licence issued from the box's request code is valid
  on that box.
- `tests/integration/security/ratelimit.test.ts`: check-ins reach the runtime without a shop and spend the
  public budget per IP. The tenant sweep lists `/licence/confirmations` as public on purpose.

## Backup

`tests/integration/box/backup.test.ts` (2), with real `pg_dump`/`pg_restore` 18, `age` and `rclone`: the
dump restores into a scratch database with identical counts for every table (41 public tables + the
migrations journal), only `shopper-<stamp>.dump.age` reaches the remote, it decrypts with the identity to a
dump `pg_restore` lists, and no plaintext or scratch database is left. A failed dump uploads nothing.
Break-checked: skipping `pg_restore` makes the count comparison refuse the upload.

## Egress, TLS, mDNS

- `tests/integration/box/egress.test.ts` (2): unknown hosts refused before any request; providers,
  configured hosts, `SHOPPER_EGRESS_ALLOW`, loopback, private LAN and `.local` pass; lookalikes
  (`api.paystack.co.evil.example`, `172.32.0.1`) refused. Break-checked.
- `tests/integration/till/electron/trust.test.ts` (2): with an openssl CA and leaf, a Node host is refused
  before the pin and reaches the box after `pinBoxCa` + `NODE_EXTRA_CA_CERTS`; a leaf is not pinned; a
  cloud upstream pins nothing.
- **Real Caddy** (`caddy:2`, the repo's `deploy/Caddyfile`, `shopper.local` on a Docker network): Node 24
  fetching `https://shopper.local` failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`; `pinBoxCa` downloaded
  `/ca.crt` and the same fetch returned 200. This caught that Caddy's Docker image keeps its PKI under
  `/data/caddy`, so the Caddyfile takes `SHOPPER_CADDY_PKI` (Debian default otherwise). `caddy validate`
  passes.
- mDNS is configuration (`deploy/avahi/shopper.service` plus host name `shopper`); **not exercised** here —
  no Avahi daemon on this server. It belongs to the Day 39 installer drill.

## Conformance on the box

`vp test --run tests/integration/ports`: 9 files, 63 tests, against the local Rivet engine
(`rivetdev/engine:3.0.0-preview.3`) and RustFS — cache, sequencer, sale sequencer and workflow cases on the
box adapters; blobs on RustFS; queue on memory and Rivet; the Workflow contract and a SIGKILL restart on
Rivet.

## UI

`tests/e2e/portal/billing/licence.spec.ts` (4) against the portal served by the bundled box on Bun (egress
guard on): expired (banner on every page, link to the licence, terms, `C` checks in and confirms), the
30-day warning, an unlicensed box's request code (no Check in now), a valid licence (no banner).
Screenshots at 1920×1080, 1440×900, 1366×768, 768×1024 and 390×844, reviewed: no overflow, the request
code wraps on mobile, the card follows the existing billing card. The existing billing specs still pass.
Figma frames were not compared: the Figma MCP seat hit its rate limit, so the screens reuse the portal's
billing card, badge and alert patterns.

The box bundle inlines every module, so an `import.meta.main` block in `backup.ts` ran on box start (found
by the e2e web server); the CLI now lives in `apps/box/src/cli/backup.ts`, which the box never imports.
