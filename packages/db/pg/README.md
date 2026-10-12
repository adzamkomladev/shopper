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
