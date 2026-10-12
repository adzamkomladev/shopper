# @shopper/conformance

`portConformance()` registers the same integration cases with Vite+ or the
Cloudflare-supported Vitest runner. Both adapters must pass Cache, Blobs and
Sequencer and Workflow cases: tenant isolation, TTL, request discipline, binary
persistence, signed URL tampering/expiry, concurrent sequences, archive
continuity above JavaScript's safe integer range, event buffering before a wait,
typed timeouts, and idempotent named-step retries.

Root `vp test --run` runs the Node/SQLite/fs/PG suite and the workerd/D1/R2/DO/PG
suite. The PostgreSQL cursor and its audit row are written atomically. Reopening
adapter objects proves independence from client memory; no DO-local cursor is
used. Durable Cloudflare/Rivet engine wiring remains a later adapter concern;
portable Workflow behavior is covered here against both adapters.

`src/register.ts` registers the shared cases; `src/cases/` holds each port suite.
`src/index.ts` only re-exports the public test registration API.
