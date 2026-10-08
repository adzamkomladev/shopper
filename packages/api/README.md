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
