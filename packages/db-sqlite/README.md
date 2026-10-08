# @shopper/db-sqlite

One Drizzle SQLite cache schema and query implementation, used by D1 and the
Node development adapter. Entries have tenant/key identity, JSON values and an
expiration instant in milliseconds. Request scopes reject read-after-write.

D1's forward migration is under migrations/; local SQLite initialization uses the
same table shape. Till schemas and production Rivet integration follow later.
