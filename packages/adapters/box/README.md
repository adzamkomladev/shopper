# @shopper/adapters-box

Day 3 development adapters use real local SQLite, filesystem blobs via unstorage,
and audited PostgreSQL sequencing. They implement the same Cache/Blobs/Sequencer
contracts as the Cloudflare adapters and run the same conformance cases.

Workflows take a `Launch` engine: `memoryLaunch` (in process, `memoryWorkflow`) or `rivetHost(...).launch`
(Rivet Workflows, `src/rivet/`). `launchQueue` is the Queue on either engine. `boxWorkflow()` stays the portable
runtime for conformance. `tests/integration/ports/rivet.test.ts` runs against a real engine, including a
SIGKILLed runner whose workflow finishes in the next one.

`boxCache()` currently uses Node 24's built-in SQLite driver through Drizzle's
SQLite proxy. It is a Node development fallback, not the sealed Bun/Rivet host.
Lane, StockHold, RateLimiter and StoreHub stay in process (see platforms.md, "The box on Rivet").
Bun-native SQLite in the sealed binary is Day 38.
