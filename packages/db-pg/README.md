# @shopper/db-pg

Shared Drizzle PostgreSQL 18 schema and transaction types. Domain rows use UUIDv7
keys, organization identity and timestamps. Composite foreign keys prevent
cross-tenant associations. Integer money uses @shopper/money conversions.

Day 3's forward migration adds audit context/hash fields, store.last_seq and
workflow_run/workflow_step. Applied Day 2 migrations remain unchanged. Existing
audit rows remain immutable and explicitly unhashed; inserts after upgrade must
carry a chain. Apply migrations with `vp run db:migrate`.
