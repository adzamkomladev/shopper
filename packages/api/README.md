# @shopper/api

Shared Hono API for the cloud Worker and box host. Store and branch CRUD uses
`store.read`, `store.write`, `branch.read`, and `branch.write` from the tenant's
role-permission rows. Changes and their audit snapshots commit together. Deleting
a record referenced by branches, devices, or audit history returns 409.

Runtime authentication requires `SHOPPER_AUTH_SECRET` and `SHOPPER_AUTH_URL`.
Send `X-Shopper-Org` with the UUIDv7 of an existing, CLI-provisioned organization
on authenticated and device requests. This selects the tenant's session scope;
it does not authenticate the caller. The box can set `SHOPPER_ORG_ID` to fix its
tenant, rejecting a different request selector.

Owner setup: provision the tenant through the existing database CLI, configure a
secret `SHOPPER_BOOTSTRAP_TOKEN`, then call `/api/auth/sign-up/email` with
`X-Shopper-Org` and `X-Shopper-Bootstrap-Token`. Registration is allowed only for
the first user of that tenant. Without the configured bootstrap token, signup is
disabled. Sign in through `/api/auth/sign-in/email`; sessions use cookies.

Device endpoints:

- `POST /devices/enrollment`: authenticated enrollment challenge (`branchId`).
- `POST /devices/enroll`: exchange `orgId`, six-digit `code`, and `name` for a device credential.
- `POST /cashiers/pin`: authenticated PIN assignment (`userId`, `pin`).
- `POST /cashiers/login`: exchange `deviceId`, `deviceToken`, `userId`, and `pin` for a cashier session.
- `POST /devices/revoke`: authenticated revocation (`deviceId`).

Cashier requests send `Authorization: Bearer <session token>` together with
`X-Shopper-Device-Token`. Permissions are checked against PostgreSQL on each
request. The device service uses the runtime cache for attempt counters and
PostgreSQL as the authoritative lockout and revocation record.

Cloud onboarding is mounted before tenant selection, after origin and trusted-peer checks:
`POST /onboarding/start`, `/onboarding/verify`, `/onboarding/complete`, and
`/onboarding/:id/resend`. `GET /onboarding/:id?token=...` previews verification state;
`?resendToken=...` lets the requester inspect delivery without verifying email.
Public onboarding requires an explicit runtime opt-in supplied only by the edge. Every box
disables it and retains controlled bootstrap setup, even without a fixed `SHOPPER_ORG_ID`.
Public mutations share a bounded per-isolate IP budget; distributed limiting remains the
RateLimiter platform slice.

Staff management uses `GET/POST /invitations` and `POST /invitations/:id/reissue|cancel`.
`GET /invitations/:id/preview?token=...` never consumes; `POST /invitations/:id/accept`
consumes once. The runtime derives the tenant from the validated invitation rather than a
caller selector. Browser contracts are exported through `@shopper/auth/schemas`.

Sync routes are exported as `@shopper/api/sync` and composed by both runtimes before browser
session tenant resolution. `POST /sync/handshake` accepts `{requestId, appVersion, protocol}`
and returns the server build version/protocol. `POST /sync/push` accepts
`{requestId, protocol, events, proofs: [{sessionId, proof}]}` with at most 200 events and 1 MiB.
Uploads require `Authorization: Bearer <enrolled device token>` and `X-Shopper-Device`.
Optional org/store/branch headers must match the enrolled device; browser sessions cannot upload.
The host keeps cashier proofs separately from sale events. Login captures issuance, expiry,
role name and till-allowed grants from `role_permission`; upload verifies the original session
window and grant even after expiry, while revoked sessions/devices are rejected.

Acceptance persists immutable sale/line snapshots and a canonical content hash, then assigns
one persistent store sequence in a separate audited transaction. Identical retries emit no
new acceptance or assignment audit. Changed content returns a per-event `CONFLICT`.
Responses contain `{requestId, accepted: [{localId, sequence}], rejected: [{localId, code, message}]}`;
sequences are positive decimal strings. Sequencing failure returns 503 without acknowledgements;
the accepted pending sale survives for retry. Malformed envelopes return 400, oversized bodies
413, invalid device credentials 401, and incompatible protocols 409. Day 11 accepts only protocol 3; older registers must update and re-bootstrap.
Event version dispatch is independent: unsupported
versions with recoverable local IDs produce per-event `UNSUPPORTED_EVENT_VERSION`.

MoMo uses cashier/device authenticated `POST /payments/momo`, `POST /payments/momo/:reference/otp`
and `GET /payments/momo/:reference`. `GET /payments/momo` returns unconsumed intents for that
cashier/register, including late confirmations. The public `/webhooks/paystack` route verifies the
raw-body HMAC before changing a payment. The shared workflow waits for OTP/webhook events and
verifies once on timeout; both runtimes retain payment/audit/workflow rows in PostgreSQL.
