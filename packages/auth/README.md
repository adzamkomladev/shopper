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

Administration uses `createRole(database, context, { name, permissionCodes })` and
`updateRole(database, context, { id, data: { name?, permissionCodes? } })`.
Both recheck `role.write` and the actor's live grant ceiling in the serialized
command; editing also checks the target's existing grants. The protected owner
marker makes its name and matrix immutable. Only a protected owner can grant
that role, and concurrent role assignments cannot demote the last owner.
Ordinary seeded roles receive defaults only when first created; reseeding
preserves matrix edits. Migration 0008 adds user, role and device read grants to
existing owners/admins without restoring other removed grants.

`listUsers`, `listRoles` and `listPermissions` take a trusted tenant ID. HTTP
routes require `user.read` or `role.read`; `/session/permissions` returns the
current authenticated session's permission code array. Browser-safe Valibot
contracts are exported through `@shopper/auth/schemas`.

Public registration uses `createOnboarding({ database, linkSecret, baseURL, launcher })`.
The request reserves a UUIDv7 without creating customer rows. A purpose-separated HMAC
verification link expires after 24 hours; only verification plus completion creates the
organization, tax defaults, metadata, protected owner, credentials and both audit chains in
one transaction. Completion accepts a corrected shop code after a uniqueness conflict.
Passwords are collected at completion and never enter audit or workflow checkpoints.
`resendToken` is a separate requester capability; it permits retrying delivery only to the
saved recipient and cannot verify an email.

`createInvitations` uses the same runtime options. Authenticated management issues email or
LAN setup links for a requested role. Links expire after seven days and are invalidated by
replacement, cancellation or acceptance. Acceptance rechecks the inviter's live grants.
Existing accounts must authenticate and keep their credentials; new LAN accounts remain
email-unverified. Membership changes reuse the last-owner-safe role command.

`runAuthFlow` is shared by `AuthWorkflow` and `boxAuthFlows`. Launchers receive only IDs and
purpose; delivery reconstructs the link using `SHOPPER_LINK_SECRET`. Checkpoints store delivery
outcomes, never the link. Failed email delivery remains visible and an explicit retry event can
recover it. PostgreSQL deadlines reject expired links after any restart. Box timers are currently
in memory; automatic recovery of waiting workflows is scheduled for day 36.

`createMaileroo({ apiKey, from, endpoint? })` uses the Maileroo v2 email API, sends plain text with
tracking disabled, and supports a local network fake through `endpoint` in integration tests.

Delivery preparation and outcome are audited checkpoints; the provider fetch holds no database
transaction or tenant mutation lock. A crash after provider acceptance can resend the same link
on replay (at-least-once delivery). Transport failures after a completed business mutation record
`notified: false` in the completion checkpoint and preserve its successful HTTP result. Workflow
expiry rechecks the business row before marking an invitation expired.
