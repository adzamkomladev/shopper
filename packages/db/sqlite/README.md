# @shopper/db-sqlite

One Drizzle SQLite cache schema and query implementation, used by D1 and the
Bun box adapter. Entries have tenant/key identity, JSON values and an
expiration instant in milliseconds. Request scopes reject read-after-write.

D1's forward migration is under migrations/; local SQLite initialization uses the
same table shape. Till schemas and production Rivet integration follow later.

`src/schemas/cache.ts` owns the cache table and its initialization SQL.
`src/cache.ts` owns the shared cache queries. `src/index.ts` only re-exports them,
so existing package imports keep working.
