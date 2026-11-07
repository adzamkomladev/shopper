# @shopper/box

Set `DATABASE_URL`, `SHOPPER_AUTH_SECRET`, and `SHOPPER_AUTH_URL` before starting
the Hono host on Bun. Optional `SHOPPER_ORG_ID` fixes the box's tenant; otherwise
requests select a provisioned tenant through `X-Shopper-Org`. Optional
`SHOPPER_BOOTSTRAP_TOKEN` enables guarded first-owner registration. Set
`SHOPPER_CACHE_PATH` for a persistent SQLite cache (defaults to `.shopper/cache.sqlite`;
PostgreSQL also enforces lockouts). `PORT` defaults to 3001.

See `packages/api/README.md` for session and device endpoints. Connections open
only when a protected request arrives; importing the host and requesting health
does not require a running database.

`src/app.ts` wires the shared runtime; `src/server.ts` exports Bun’s server configuration.
Bun supplies the peer address for rate limiting; caller IP headers are ignored.
The server keeps the previous 30-second idle timeout so spreadsheet imports are not cut off by Bun’s 10-second default.
`src/index.ts` only re-exports the host and entry configuration.

Set `SHOPPER_LINK_SECRET` to enable invitation links, including LAN setup links without email.
Email delivery additionally needs `MAILEROO_API_KEY` and `MAILEROO_FROM`; `MAILEROO_ENDPOINT`
can point to the local integration fake. The box never exposes self-service onboarding, including when no fixed org is configured.
Set `ARKESEL_API_KEY` (and `ARKESEL_SENDER`, default `Shopper`; `ARKESEL_BASE_URL` for a fake) to text
low-stock alerts to branch alert phones.

Set `RIVET_ENDPOINT` (and `RIVET_TOKEN`; `RIVET_NAMESPACE`, default `default`; `RIVET_POOL`, default
`shopper-box`) to run every workflow and the notification queue on the Rivet engine (`src/engine.ts`), so
waits, sleeps and pending messages survive a restart. Without it they run in process and are lost on restart;
PostgreSQL still enforces deadlines and link consumption, and the boot relaunches restart what it can.

Set `SHOPPER_PORTAL_DIR` (the portal build's static assets, `apps/portal/.cloudflare/output/v0/workers/default/assets`) to serve the back office on the box's origin
(`src/portal.ts`): `/api/*` is the API, a built file is served as is, and a browser navigation gets the SPA
shell with the portal's `_headers`. API routes at the root keep answering tills and other JSON clients.
`SHOPPER_S3_*` puts imports and receipts in RustFS buckets (`src/storage.ts`).

Licence (`src/licence.ts`, `lic/1`): a build with `SHOPPER_LICENCE_ISSUER` (the issuer's public key, a build define,
never box configuration) enforces it. `SHOPPER_LICENCE_DIR` (default `.shopper/licence`) holds `licence.json`,
`confirmation.json` from the last check-in and `box.key`, the box's Ed25519 key made on first use. The machine is the
SHA-256 of `SHOPPER_MACHINE_ID_FILE` (default `/etc/machine-id`). Each night the watchdog checks in with
`SHOPPER_LICENCE_URL` (the cloud API); 30 days without a confirmation warns, 60 turns the back office read-only.
Tills never lock. Settings → Licence shows the request code a licence is issued from (`tooling/licence/issue.ts`).
