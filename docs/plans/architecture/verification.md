# Architecture cleanup verification

Verified on 14 October 2026. The approved management architecture is documentation only; this change does not implement new Electron, local portal, billing or backup hosts.

## Local checks

| Check                              | Result                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `vp install --frozen-lockfile`     | Passed; workspace lockfile resolves without changes                                              |
| `vp check`                         | No warnings, lint errors or type errors; 649 source files checked                                |
| `vp run guard`                     | All repository rules pass                                                                        |
| `vp test --run --reporter=verbose` | 100 files, 346 integration tests passed                                                          |
| `vp run -r --no-cache build`       | All 27 project builds passed                                                                     |
| `vp run typecheck`                 | Passed                                                                                           |
| Standard browser suite             | 154 cases passed; the remaining receipt fixture case passed after its correction                 |
| Final import browser suite         | 16 passed, including setup, direct PUT, secure-origin errors and both MIME regressions           |
| Final receipt browser case         | Passed: 99 remaining, overflow after 100 further sales, six screenshots and accessibility checks |
| Public browser suite               | All 28 cases passed                                                                              |

The integration suite includes the 5,000-sale bounded replay test, one-hour offline convergence, both Blobs adapters, real workerd/RustFS HTTP PUTs, bounded reads, tenant isolation, expiry and tampering. Native R2 binding behavior is tested locally; this is not a live external R2 check.

PostgreSQL 18 migration checks execute the new asset migration repeatedly and compare source constraints, indexes and metadata against the actual database. Drizzle generation reports no schema drift. Published receipt SQL is unchanged; the new snapshot includes its existing columns and the assets table.

## Review and regression fixes

The prescribed `gpt-6.1-sol` review and scoped re-reviews completed with no outstanding findings. Two confirmed findings were fixed: genuine legacy XLS uploads are accepted, and lost snapshot objects are restored under their existing tracked asset with an audited repair.

Additional verification preserved CSV uploads with nonstandard browser MIME types, fixed shutdown requests that could resume after transport cancellation, and registered IPC handlers before adapter loading. Deterministic integration tests cover the shutdown race; timeout and retry limits were not increased.

The receipt browser fixture now records through host IPC and its serialized connection. Its obsolete final retry was removed after diagnostics proved that request caused the timeout. The resulting low-receipt and overflow flow passes against the real host.

A suspected receipt timestamp mismatch was rejected: the devices schema uses its own tenant helper without timestamp columns, matching the published table and migration metadata.

## UI evidence

The actual import flow was reviewed at 1366×768, 1440×900 and 390×844, including loading, preview, invalid rows, offline and completion. Keyboard checks and serious/critical accessibility checks pass. Local screenshots are retained under the ignored `.shopper/verification/` directory.

The supplied Figma file `4MtEIWv8yBUBYgkrk4ubPk` (nodes `12:66`, `27:2031`, `45:852`) contains no import frame. Its portal styling is the available comparison; an exact import-frame match is not claimed.

## Shipping requirements and limits

Apply migration `0013_assets.sql` before deploying the API and browser together: import submission now uses JSON asset references instead of multipart bodies. Provision the private imports bucket, S3 credentials, browser-reachable HTTPS endpoint and exact-origin CORS. Web Crypto needs HTTPS or a trusted loopback origin. No development database reset is required.

No deployment, real hardware or live external R2 verification was performed. Storage quotas and abandoned-upload retention remain provider deployment policy. Record exact-head push and pull-request CI results, the final commit and merge evidence in the pull request and Notion completion record before marking the cleanup complete.
