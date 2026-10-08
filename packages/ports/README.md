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

Blob keys are validated and tenant-prefixed. Binary payloads go through
unstorage. `blobUrlAccess()` issues HMAC URLs and validates their signature and
expiry before retrieving bytes. Configure a stable secret of at least 32 bytes
and a Shopper endpoint; adapters expose `readSigned` for the host to serve at
that endpoint. The URLs are Shopper capabilities, not R2 public URLs. Host route
wiring and persisted asset metadata follow with asset features.

`memoryWorkflow()` provides the portable Workflow contract runtime used by both
development adapters and conformance. It buffers messages sent before a wait,
raises a typed timeout, retries named steps, and replays completed steps without
running them again. Durable Cloudflare/Rivet execution can replace it behind the
same port when those engines are introduced.

Queue, Scheduler and Realtime remain contracts until their feature days.
