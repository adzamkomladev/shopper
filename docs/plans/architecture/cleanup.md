# Architecture cleanup · 14 October 2026

## Goal

Preserve current screens, public URLs, audit hashes and sync compatibility while making authored paths and responsibility folders consistent. Replace catalogue multipart uploads with authorized direct object-storage uploads.

## Decisions

The user approved shared backoffice components in the cloud portal, local box SPA and Electron; the box is authoritative for on-prem operational data and optional cloud sync is separate. This cleanup documents that architecture only. Subscription/payment/setup/storage/backup management remains a cloud control plane; no new billing, backup or Electron product is being built.

The user approved `@shopper/utils` and `aws4fetch`, and requested `@shopper/assets` to own asset access policy, purpose, bucket selection, audited database tracking and presigned grant issuance. Provider credentials and transport stay behind Blobs in the adapters. Only existing use cases receive storage infrastructure: private imports and generated sync snapshots.

## Behaviours as tests

- Guard integration fixtures reject hyphenated source paths, misplaced schemas/reusable exported types, repeated SHA-256, API multipart upload proxies and workflow implementation/re-export mixtures; generated/published/framework contracts pass.
- Existing auth/audit/sync/catalogue integration suites preserve hash formats, canonicalization, versioned upcasting and all exported callers.
- Asset issuance requires current product-write permission, validates metadata and atomically records the tenant-scoped asset and audit. Processing rejects foreign, expired, missing, oversized, replaced or hash-mismatched assets before catalogue writes.
- Preview and final import resolve the same uploaded asset; final import is idempotent and links the import to its source asset.
- Blobs conformance verifies actual direct PUT, bounded reads, tenant isolation, tampering and expiry across adapters. Live external R2 checks require provider access; local workerd is not a live R2 service.
- Portal e2e sends bytes to object storage and JSON references to the API; existing keyboard, offline, error and uncertain-completion behaviour remains usable.

## Slices

1. Inventory and reversible path/backoffice/workflow moves, updating all imports, exports, builds and framework configuration. Mapping: [layout.md](layout.md).
2. Extract schemas and reusable types; centralize byte-level SHA-256 without changing HMAC, canonical JSON, password/PIN derivation or sync versions.
3. Add assets schema/migration/domain package; implement direct upload grants and bounded processing through R2/RustFS adapter contracts.
4. Update browser import callers and meaningful integration/e2e cases; verify real app screenshots and accessibility.
5. Update rules, engineering documentation, local skills and Notion decisions. Run checks, guard, integration/e2e, typecheck and builds; prescribed review; commit/PR; verify both CI triggers on the exact head; merge and fast-forward clean main.

## Compatibility and limits

Keep stable package names/subpaths, published URLs, persisted workflow/event identifiers, generated files and published migrations. Framework-required names and tool-consumed skill/role/config identifiers are explicit exceptions. New authored code uses nested paths without hyphens.

Presigned PUT is a bearer capability. Actual bounded bytes, size and registered digest must be verified immediately before processing. A browser-declared size or object metadata alone cannot prove integrity. No API upload-byte fallback is allowed when object storage is unavailable.
