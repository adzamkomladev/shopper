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
Waiting auth flows currently use the shared memory engine; PostgreSQL still enforces deadlines
and link consumption after restart, while automatic timer recovery is scheduled for day 36.
