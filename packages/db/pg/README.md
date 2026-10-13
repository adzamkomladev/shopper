# @shopper/db-pg

Shared Drizzle PostgreSQL 18 schema and transaction types. Domain rows use UUIDv7
keys, organization identity and timestamps. Composite foreign keys prevent
cross-tenant associations. Integer money uses @shopper/money conversions.

Day 3's forward migration adds audit context/hash fields, store.last_seq and
workflow_run/workflow_step. Applied Day 2 migrations remain unchanged. Existing
audit rows remain immutable and explicitly unhashed; inserts after upgrade must
carry a chain. Apply migrations with `vp run db:migrate`.

Schema definitions live in `src/schemas/`: `base.ts` owns organizations, stores,
branches and installation metadata; `auth.ts` owns users, permissions and Better
Auth tables; `devices.ts` owns devices, enrollment and cashier credentials;
`catalogue.ts` owns products, prices and tax tables; `workflows.ts` owns workflow
state and its audit record. `src/types.ts` holds database and transaction types.
`src/index.ts` only re-exports the unchanged package API.

Drizzle reads `src/schemas/index.ts`. These source moves do not change the table
definitions or existing SQL migrations.

`sales.ts` owns accepted sales and lines. Forward migration `0010_till_sales.sql` adds immutable
JSON payloads, canonical content hashes, device/local identity uniqueness, positive unique store
sequences, and cashier-session issuance/grant snapshots. Sale payloads/lines cannot be updated
or deleted; the sale permits only its first null-to-positive sequence assignment. The migration
can be reapplied. Existing cashier sessions default to no historical sale grant and must log in
again to capture one. `accepted_at` is server time; `device_time` remains untrusted capture time.
