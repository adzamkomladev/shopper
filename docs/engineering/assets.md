# Asset ownership and direct uploads

`@shopper/assets` owns asset policy and tracking. The asset table records tenant, UUIDv7 identity, purpose, logical bucket, visibility, storage key, filename, content type, registered size/digest, creator and expiry. The producing command writes its asset/audit records together. Import records link their source asset; generated snapshots are tracked with their source scope.

Only implemented uses are provisioned:

| Purpose           | Policy                                                                          | Provider storage                                  |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| Catalogue imports | Private client uploads, short-lived PUT capability, bounded verified processing | Dedicated private imports bucket in R2/RustFS     |
| Sync snapshots    | Private server-generated outputs, authenticated device reads                    | Existing R2 binding or box generated-object store |

There are no product-image, export, backup, receipt or invoice buckets until an implemented use requires its own access/retention policy. Current assets are private; do not infer public access from a filename or content type. Public product assets will need an explicit policy and serving contract.

The browser requests a grant with metadata and digest, PUTs directly to its URL without API credentials, then sends the asset UUID as JSON for preview and final import. The API rechecks current permissions, tenant and purpose, resolves its own stored key, and fetches bounded bytes immediately before processing. Size and SHA-256 must match the registered values. The checked bytes are the bytes parsed; object metadata alone is not integrity proof. Replayed PUT URLs cannot substitute another file silently. Final import retries use the same asset identity.

Cloud internal puts, reads and deletes use native R2 bindings: `IMPORTS` for canonical slash-prefixed import keys and `BLOBS` for historical colon-normalized snapshot keys. S3 is used only to sign browser upload grants on the cloud; the box uses RustFS S3 for its internal import operations too. R2 presigning needs S3 endpoint/access credentials independently of its Worker binding. URLs use the provider S3 hostname, and bucket CORS must allow only trusted portal origins and the required headers/methods. RustFS uses its S3 endpoint with the same signed PUT contract. A presigned PUT is not a portable upload-size quota: processing bounds are enforced before parsing, while storage quota/rate/lifecycle policies address unused uploads. Never claim a browser-declared size prevents storage abuse.

Filesystem fallback remains for server-generated objects. Without an S3 imports store, grant issuance fails visibly; there is no API byte-upload fallback. Generated snapshot keys retain the established unstorage R2 normalization for compatibility.

Local cloud development uses a remote dev `IMPORTS` binding and matching R2 signing credentials in `apps/edge/.dev.vars`; browser PUT and internal reads must address the same real bucket. Workers tests explicitly disable remote bindings, exercise native R2 storage locally and verify the signed HTTP contract with RustFS.

Box development uses `vp run services:up` and `vp run storage:setup` to provision the local RustFS imports bucket/CORS. Development credentials are loopback fixtures, never production credentials. Production configuration and migration requirements are in [deployment.md](deployment.md). Real workerd/RustFS tests prove adapter behavior locally; live external R2 verification must be recorded separately.

Browser hashing uses Web Crypto: local portals need HTTPS (or a trusted loopback origin). An insecure LAN URL does not expose this API; the file check explains how to use a secure connection. Configure the browser-reachable RustFS endpoint with matching TLS/CORS before deploying the local web portal.
