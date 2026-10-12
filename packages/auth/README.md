# @shopper/auth

`createAuth` binds Better Auth to one already-provisioned organization. Keep that
`orgId` in trusted runtime configuration; request headers never choose the auth
tenant.

```ts
const auth = createAuth({
  database,
  orgId: env.SHOPPER_ORG_ID,
  secret: env.BETTER_AUTH_SECRET, // at least 32 characters
  bootstrapToken: env.SHOPPER_BOOTSTRAP_TOKEN,
  baseURL: env.AUTH_BASE_URL,
});

app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
```

The bootstrap token is required for `POST /api/auth/sign-up/email`. Signup is
available only while the tenant has no Better Auth users, so it creates the
first `superadmin` owner and closes itself afterward. Do not expose the token
through client configuration. `seedAuthRoles` can also be run during audited
tenant provisioning.

Add staff through the audited commands `registerOrganizationUser(database,
context, { name, email, password, roleId })` and `assignMemberRole(database,
context, { userId, roleId })`. Registration requires the actor's `user.write`
and `role.write` permissions; reassignment requires `role.write`. Both reject a
target role whose live `role_permission` grants exceed the actor's permissions.
The commands hash passwords through Better Auth and keep credentials out of
audit payloads.

The seeded matrix is data in `permission` and `role_permission`: `superadmin`
has all permissions; `admin` has all except store, branch, and `tax.write`;
`accountant` has shift read, stock read, tax read, reports, and audit; `inventory`
has stock read/write and product proposals; `cashier` has sale creation, refund
requests, and shift read/write. Device enrollment, revocation, and cashier PIN
assignment are granted to superadmin and admin. Device principals additionally
need the permission's `tillAllowed` flag, which is seeded only for sale, refund,
and shift permissions.

Session and organization GET routes use a read-only adapter and disable/defer
session refresh. Expired sessions therefore remain in PostgreSQL after a read;
the GET path never deletes them. If cleanup is added, it must use a bounded,
audited command rather than auth read traffic.

Source layout: browser sessions live in `src/session/`; device enrollment and PIN sessions live in
`src/devices/`. Public package imports remain `@shopper/auth` and `@shopper/auth/devices`.
