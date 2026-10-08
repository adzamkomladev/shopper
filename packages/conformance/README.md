# @shopper/conformance

`portConformance()` registers the same integration cases with Vite+ or the
Cloudflare-supported Vitest runner. Both adapters must pass Cache, Blobs and
Sequencer cases: tenant isolation, TTL, request discipline, binary persistence,
signed URL tampering/expiry, concurrent sequences and archive continuity above
JavaScript's safe integer range.

Root `vp test --run` runs the Node/SQLite/fs/PG suite and the workerd/D1/R2/DO/PG
suite. The PostgreSQL cursor and its audit row are written atomically. Reopening
adapter objects proves independence from client memory; no DO-local cursor is
used. Production Rivet and Workflow engine conformance remain pending.
