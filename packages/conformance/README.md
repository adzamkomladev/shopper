# @shopper/conformance

`portConformance()` registers the same integration cases with Vite+ or the
Cloudflare-supported Vitest runner. Both adapters must pass Cache, Blobs and
Sequencer and Workflow cases: tenant isolation, TTL, request discipline, binary
persistence, signed URL tampering/expiry, concurrent sequences, archive
continuity above JavaScript's safe integer range, event buffering before a wait,
typed timeouts, and idempotent named-step retries.

Sale sequencing uses an accepted, unassigned sale fixture. Both adapters prove
that duplicate concurrent assignments retain one sequence and one assignment
audit across reopen, scope mismatches and missing sales do not assign, and a
failed assignment audit rolls back the sale and store cursor together.

Root `vp test --run` runs the Node/SQLite/fs/PG suite and the workerd/D1/R2/DO/PG
suite. The PostgreSQL cursor and its audit row are written atomically. Reopening
adapter objects proves independence from client memory; no DO-local cursor is
used. Durable Cloudflare/Rivet engine wiring remains a later adapter concern;
portable Workflow behavior is covered here against both adapters.

`workflowLauncherConformance()` runs against the actual authentication launchers
with PostgreSQL-backed registration fixtures. It proves invalid instance ids
fail, retry/completion events buffer before waits, duplicate launches preserve
delivery checkpoints, and expired registrations finish without another email.
The Workers runtime also forces the native event timeout. The box fixture uses
the memory engine; Rivet restart recovery is proven in `tests/integration/ports/rivet.test.ts`.

`blobsConformance()` runs the Blobs cases alone, so the box's RustFS receipts storage passes the same
cases as fs and R2. `queueConformance()` runs against `boxQueue` and `launchQueue` on both engines.

`src/register.ts` registers the shared cases; `src/cases/` holds each port suite.
`src/index.ts` only re-exports the public test registration API.
