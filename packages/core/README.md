# @shopper/core

Portable business commands. `defineCommand` is re-exported from @shopper/audit,
which owns business/audit transactions and optional workflow checkpoints.
`nextStoreSequence` advances a store's authoritative PostgreSQL cursor and writes
its audit row atomically. It enforces tenant scope and supports archive floors.

Catalogue product commands and queries live in `src/catalogue/products/`; price commands and
workflows live in `src/catalogue/prices/`. Catalogue input and view schemas live in
`src/schemas/catalogue/`. Public package imports remain unchanged.
