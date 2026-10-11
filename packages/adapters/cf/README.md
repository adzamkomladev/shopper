# @shopper/adapters-cf

Cloudflare binding access stays here. Implemented Day 3 adapters:

- Cache: D1 through the shared Drizzle SQLite schema and queries.
- Blobs: R2 through unstorage, with tenant keys and signed Shopper access.
- Sequencer: one StoreSequencer Durable Object address per store. The RPC
  performs an audited PostgreSQL increment through Hyperdrive; PostgreSQL
  holds the cursor and the DO holds no competing persistent counter.
- Workflow: the portable in-process runtime for contract conformance; durable
  Cloudflare Workflows wiring follows the engine integration feature.

Apply the cache migration for local development with
`vp exec wrangler d1 migrations apply CACHE_DB --local --config apps/edge/wrangler.jsonc`.
Cloud D1 migration application remains a deployment step. Binding types come
from the pinned Wrangler target; regenerate with `vp -C packages/adapters/cf run types`.

The same conformance cases run in workerd and against the box development
adapters. The Worker suite uses a fresh PG18 database provisioned by the root
integration runner. Queue and realtime adapters follow their feature days.
