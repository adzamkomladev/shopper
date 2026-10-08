# @shopper/adapters-box

Day 3 development adapters use real local SQLite, filesystem blobs via unstorage,
and audited PostgreSQL sequencing. They implement the same Cache/Blobs/Sequencer
contracts as the Cloudflare adapters and run the same conformance cases.

`boxCache()` currently uses Node 24's built-in SQLite driver through Drizzle's
SQLite proxy. It is a Node development fallback, not the sealed Bun/Rivet host.
The production Rivet actors, workflow engine, RustFS driver and Bun-native SQLite
integration are scheduled for the on-prem phase starting on day 36. These tests
do not claim production Rivet conformance.
