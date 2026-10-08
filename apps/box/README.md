# @shopper/box

Set `DATABASE_URL`, `SHOPPER_AUTH_SECRET`, and `SHOPPER_AUTH_URL` before starting
the Elysia host. Optional `SHOPPER_ORG_ID` fixes the box's tenant; otherwise
requests select a provisioned tenant through `X-Shopper-Org`. Optional
`SHOPPER_BOOTSTRAP_TOKEN` enables guarded first-owner registration. Set
`SHOPPER_CACHE_PATH` for a persistent SQLite cache (defaults to `.shopper/cache.sqlite`;
PostgreSQL also enforces lockouts). `PORT` defaults to 3001.

See `packages/api/README.md` for session and device endpoints. Connections open
only when a protected request arrives; importing the host and requesting health
does not require a running database.
