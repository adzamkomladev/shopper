# @shopper/edge

The Worker opens a request-scoped PostgreSQL connection through `HYPERDRIVE`
and supplies the `CACHE_DB` D1 cache to the shared API. Configure
`SHOPPER_AUTH_SECRET`, `SHOPPER_AUTH_URL`, and optional owner setup secret
`SHOPPER_BOOTSTRAP_TOKEN` as Worker secrets. Requests select their provisioned
tenant using `X-Shopper-Org`; see `packages/api/README.md` for signup and device
flows. `/health`, `/about`, and `/` remain available without authentication setup.

`src/worker.ts` owns the Worker request handler; `src/types.ts` owns local environment types.
`src/index.ts` re-exports the handler and the platform classes the Worker runtime requires.

Configure `SHOPPER_LINK_SECRET` (a dedicated secret of at least 32 characters),
`MAILEROO_API_KEY` and `MAILEROO_FROM` for verified registration and invitations.
`AUTH_FLOWS` runs the shared `AuthWorkflow`. `MAILEROO_ENDPOINT` is an optional trusted
configuration override for network integration testing; production uses Maileroo's v2 API.
