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

Day 11 accepts only sync protocol 3 and tender-bearing sale event v3. Older registers must update
and re-bootstrap; legacy sale upcasters are removed under the approved disposable-data reset.
Event decoding remains independent of transport negotiation. Receipt blocks, corrected clock time
and occurrence acknowledgments remain part of the current transport.
`@shopper/sync/bridge` exports browser-safe host messages, including transport mode, pull cursor,
head, last pull time and receipt availability. Device credentials stay in the host.

`createPullWorker` bootstraps from a versioned gzip snapshot, then applies ordered change pages
and their cursor in one audited SQLite transaction. Unknown versions halt the worker for an
upgrade. A persisted initialization flag distinguishes an empty bootstrapped store from receipt
state created before the first snapshot. Empty caught-up pulls write no audit row.

`createLiveWorker` authenticates WebSockets with headers, pulls on connection and every store
nudge, and reconnects with a 30-second to five-minute transport fallback. A healthy idle socket
also catches up every five minutes so a lost nudge cannot leave references stale indefinitely. The host pulls
after push acknowledgments and on **Sync now** (`Y`). Store sequences include sales, so cursor
distance is not a count of pending changes.

Handshake and push replies resend outstanding receipt blocks. Local sales consume these inside
the sale transaction; exhausted tills use the separate `X` overflow series. Sale event v2 keeps
the receipt number and measured clock offset; the server upcasts v1 before hashing, preserves raw
device time and returns corrected occurrence time with its acknowledgment.

Enrollment codes in the private host configuration allow overflow receipts before the initial
handshake. Persisted codes remain fixed; the till refuses a new sale if its codes are missing or
conflict with its saved identity. Recreating a till database requires a fresh enrollment, because
its retained receipt counters and unsent sales cannot be recovered from an empty file.

Payment updates use versioned `payment.updated` realtime envelopes. The host validates each payload,
updates its audited SQLite payment intent/tender and broadcasts a draft view. On reconnect it reads
unconsumed payments once through the authenticated API. Unmatched late confirmations stay visible
in Purchases. Starting a charge reserves its UUID reference locally before HTTP; retries keep the
same reference so a lost response cannot create another charge.
