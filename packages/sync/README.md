# @shopper/sync

`createPushWorker` delivers the durable SQLite outbox using an enrolled-device credential.
The host calls `start` once and `trigger` after local commits or reconnects; concurrent triggers
share one delivery loop. `stop` cancels requests and retry timers. `getStatus` and `subscribe`
expose connection state without credentials.

Uploads contain at most 200 events and 1 MiB, including private cashier-session proofs in a
separate envelope. Every acknowledgment is validated before an audited transaction updates
sequences and removes accepted outbox rows. Sale snapshots remain local. Omitted records retry;
permanent rejections remain blocked while other eligible sales continue.

Network failures use capped exponential backoff with jitter and honor `Retry-After`. Outbox
retry deadlines survive restart. Empty-host connection retries use in-memory backoff. Requests
have a 120-second timeout for a bounded batch; integration fixtures can inject clock, randomness and timeout values.

Protocol 1 supports only protocol 1. Subsequent protocols support their immediate predecessor;
producer-owned event decoders advance one version at a time independently of transport versions.
`@shopper/sync/bridge` exports browser-safe host messages. Pull/bootstrap/realtime remain Day 9.
