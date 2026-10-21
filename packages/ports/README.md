# @shopper/ports

Portable contracts for PostgreSQL (`Db`), Blobs, Sequencer, Queue, Workflow,
Scheduler and Realtime. Use the existing portable libraries before adding a port.

Messages carry UUIDv7 identity, tenant, event version and decimal bigint sequence.
`messageBody()` validates with Valibot and caps the complete UTF-8 JSON envelope
at 96 KiB. Consumers tolerate at-least-once delivery and out-of-order batches;
`Delivery.ack()` is explicit. Retry policies specify total `maxAttempts`, delay
and backoff; exhaustion requires a dead-letter path. `Scheduler` permits a UTC
watchdog; business schedules use workflow sleeps and waits with named steps and
explicit timeouts.

`Cache.request()` creates one request scope. A scope rejects any read following
a write, including a write that is still in flight. A later request can read the
value. Cache entries use a shared Drizzle SQLite schema, tenant/key identity and
logical expiration. Never use the cache as the business record.

`Sequencer.next()` returns a strictly increasing bigint per org/store, permits
gaps, and accepts an archive floor. PostgreSQL's audited `store.last_seq` is the
authoritative cursor. Engine coordination does not introduce a second stored
cursor that could disagree with the transaction.

`Sequencer.assignSale(orgId, storeId, deviceId, localId)` assigns an accepted sale exactly once.
The shared command updates `store.last_seq`, `sale.store_sequence` and its audit atomically.
Replays return the persisted bigint without allocating another sequence or audit. Both shells
call this command and retain no private cursor.

Blob keys are validated and tenant-prefixed. Binary payloads go through
unstorage. `blobUrlAccess()` issues HMAC URLs and validates their signature and
expiry before retrieving bytes. Configure a stable secret of at least 32 bytes
and a Shopper endpoint; adapters expose `readSigned` for the host to serve at
that endpoint. The URLs are Shopper capabilities, not R2 public URLs. Host route
wiring and persisted asset metadata follow with asset features.

`WorkflowLauncher` has `start(instanceId, params)` and
`send(instanceId, type, payload)`. Launch acknowledges the instance without
waiting for the business process; launching an existing id does nothing.
Both operations validate the portable instance-id format. Instance ids equal
their business keys. Events sent before a named wait are buffered, and completed
steps replay their checkpointed result without repeating delivery.

Registration and invitation launchers run the shared authentication flow on real
Cloudflare Workflows and the box's `memoryWorkflow()` engine. The flow persists
delivery outcomes, named steps, audit rows and terminal status in PostgreSQL;
registration uses its separate pre-shop storage. The `auth-action` event carries
`{ action: "retry" | "completed" }`. Provider failure remains visible and waiting
for a retry, and persisted expiry is authoritative when a flow is relaunched.
Both adapter suites cover early events, duplicate launches, replay and expiry;
the Workers suite also forces the native event timeout.

The box engine buffers events, raises `WorkflowTimeoutError`, and retries named
steps, but its waiting timers do not survive a process restart. Recreating a
launcher honours the stored expiry; automatic recovery of waiting box flows is
scheduled for Rivet Workflows on day 36.

Queue is `{ policy, send }` plus a `QueueHandler`: Cloudflare pushes batches to the
Worker, so there is no pull-style `consume`. `send` rejects an invalid envelope or one
over 96 KB. Delivery carries `attempts`; a handler that throws or returns without
`ack()` is redelivered. The box queue is in memory (lost on restart) until Rivet queues
on day 36.

Scheduler and Realtime remain contracts until their feature days.
