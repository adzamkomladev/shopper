# Day 7: onboarding and administration

Approved implementation plan. Source: https://app.notion.com/p/3eba2c999ce981c3bba0e162ae8360fa.

## Goal

An owner verifies email, creates a shop, store and branch, adds a product, invites a cashier,
and the cashier accepts and signs in. Include custom roles, editable matrices and devices.
Claude owns all UI implementation; Codex owns reviews. Preserve existing work.

## Behaviours as tests

Tests come first: integration with PG18, workerd and both adapters; browser tests through real APIs.

- Registration: no customer org before verification; atomic provisioning and rollback; one shop
  under concurrent completion; duplicate code allows correction.
- Audit: both chains verify; historical hashes unchanged; scope cannot be selected by HTTP;
  secrets absent from audit/checkpoints.
- Roles: immutable owner; last owner cannot be demoted; editable seeded/custom matrices; grant
  ceilings; reseeding preserves edits; current sessions reflect changes.
- Invitations: requested role; expired/cancelled/replaced/consumed links fail; single concurrent
  consume; existing credentials unchanged; inviter demotion cannot escalate old invitations.
- Administration: tenant/permission isolation; existing management/device API compatibility.
- Workflows: launch/event/expiry/replay parity; recoverable delivery failure; expiry after restart.
- Portal: full milestone, custom-role editing, LAN acceptance without WAN, keyboard, axe,
  screenshots and loading/empty/error/offline/no-permission states.

## Changes

- Separate registration request/audit/workflow storage. Server UUIDv7 reserves future org_id;
  registration storage references the request, customer tables retain org foreign keys.
- Trusted definition-level registration scope on defineCommand; default tenant scope; shared
  transactions/locking/redaction/hashing; no scope selected by HTTP.
- Move provisioning from tooling to shipped code; preserve tax defaults, metadata, constants.
- Collect owner name/email and shop name/code; verify email; collect password at completion.
  Reserve code only at completion. Atomically create customer/owner/credentials/roles and both
  audit chains, consume registration; safe replay; use existing sign-in for session.
- Public signup on cloud only. Fixed-org box retains controlled initial-owner setup.
- Users/roles/permission queries, custom-role creation, matrix edits and member role assignments.
  Stored protected-owner marker backfills superadmin. Owner name/matrix immutable; only owner
  grants it; preserve last owner. Existing seeded and custom roles otherwise share matrix editor.
- Transactional role.write, target-grantability and requested-permission ceiling checks. Till
  permissions remain data-defined. Seed ordinary defaults only for newly created roles.
- Add user.read/role.read/device.read to owner/admin through explicit migrations; preserve edits.
- Invitations: role FK, digest, channel, consumption; issue/list/reissue/cancel/preview/accept.
  Registration TTL 24h; invitation TTL 7d. Reissue invalidates old link. GET previews, POST consumes.
- Purpose-separated HMAC links with dedicated secret; store digests; never log/checkpoint secrets.
  Acceptance rechecks role and inviter; dedicated staff command avoids owner signup hook.
  Existing accounts authenticate and retain password; LAN possession does not verify email.
- Shared registration/invitation workflows, thin shells, launcher event delivery, both conformance
  suites. Shared fetch Maileroo transport, persisted delivery outcome and retry actions.
- Public onboarding before tenant selection but after origin/IP checks. Authenticated admin APIs,
  session permissions, reuse management/enrolment/revocation/PIN mutations, browser-safe Valibot
  schemas. Update exports/callers/fixtures/runtime/config and engineering contracts.
- Forward-only idempotent migrations and backfills; preserve published migration filenames/hashes.

## UI

Claude implements screens/browser tests in backoffice using shopper/ui: signup/check-email/verify/
complete, stores/branches CRUD, users/invitations/role assignment/LAN copy link, role matrix (owner
read-only), devices/branch/enrol code/revoke/cashier PIN. Reuse forms/queries/focus/shortcuts.

Figma: 4MtEIWv8yBUBYgkrk4ubPk, login 9-61 and shell/table 45-852. Read before building.
Every state, keyboard action, focus recovery, axe and actual screenshots. LAN reachable without
WAN remains usable. Claude provides evidence, Codex reviews code/evidence.

## Rules at risk

Document pre-shop exception without weakening customer tenancy. Serialize role/last-owner changes.
Keep email failures visible/recoverable; no passwords in workflow state. Shared functions/two thin
shells and both conformance suites; no new DO/polling/business cron. PG state/expiry survives box
restart; automatic recovery of waiting box flows remains Day 36.

## Slices and models

| Slice | Deliverable                                   | Model                                      |
| ----- | --------------------------------------------- | ------------------------------------------ |
| 0     | Inventory/catch-up/baseline                   | Luna explorer; Claude Opus coordination    |
| 1     | Registration storage/audit scope/architecture | Claude Sonnet                              |
| 2     | Owner/roles/policies/sensitive tests          | gpt-6.1-sol medium                         |
| 3     | Onboarding/provisioning/email/workflows       | gpt-6.1-sol high                           |
| 4     | Invitations/acceptance/conformance            | gpt-6.1-sol high                           |
| 5     | Device-list API/schemas/bounded tests         | gpt-6-luna high                            |
| 6     | All UI/browser tests/visual evidence          | Claude Sonnet; Opus difficult UI decisions |
| 7     | Checks/docs/integration/review                | Luna checks; Sol review                    |

No Astra. Implementer writes failing backend tests; Claude writes all UI tests. Explicit ownership;
workers preserve others' edits. Parallel UI only after stable contracts. Each slice: red tests,
implementation, green checks, Codex review/fixes, commit. Sol low for routine reviews, medium for
auth/permissions/audit/migrations/workflows and final review. Never attribute commits to assistants.

Run vp check, vp run guard, vp test --run, relevant e2e/typecheck/build. Update Notion only on proven
milestone completion, with evidence and box-recovery limitation.

## Decisions and defaults

Confirmed: verified self-service, separate pre-shop storage, protected owner, editable other roles,
LAN links, Day36 workflow recovery. Codes lowercase letters/digits/hyphens. No billing/KYB, role
deletion or staff deletion. Verify Maileroo configuration; preserve dirty checkout.

## Implementation evidence

The user's continuation authorizes GPT models to finish implementation, including UI. Sol owns
security-sensitive implementation and Codex reviews; Luna owns administration UI and visual review.
This supersedes the original Claude-only UI assignment. No Astra was used.

The Figma plugin returned samples for `12:66`, `27:2031` and `45:852` in file
`4MtEIWv8yBUBYgkrk4ubPk`, plus detailed navigation, dashboard and table child contexts. These are
shared shell/component references, not matching designs for every new screen. The implementation
reuses `@shopper/ui` tokens and components. The plugin's browser could not launch Chrome in this
root environment; repository Playwright provides the real screenshots, keyboard and axe evidence.

Days 1–6 are marked Done in the schedule. Stale checkboxes and PR text did not identify additional
functional carry-over beyond this administration milestone. Existing seeded grants remain intact;
owners can edit ordinary role matrices explicitly. Later-day Electron and reporting work remains
outside this milestone.

### Implementation and regressions

- Pre-shop registration storage and trusted audit scope preserve customer tenancy and existing
  hashes. Atomic provisioning creates the customer organisation only after verification.
- Protected-owner backfill, permission ceilings, last-owner protection, editable matrices and live
  session permissions passed focused PostgreSQL 18 tests and Codex review.
- Both workflow adapters support launch, events, expiry and replay. Review fixes keep provider
  delivery outside audit locks, preserve recoverable post-commit delivery state and close public
  signup on fixed-organisation boxes. Exact Workers RPC timeout normalization passed the real
  Workers expiry regression.
- Invitation delivery-state regression exposed stripped correlated SQL qualifiers. The minimal
  nested SQL fix passes seven real PostgreSQL/box-workflow/Maileroo invitation tests, including
  pending, failed, retried and tenant-isolated outcomes.
- UI regressions cover permission gating, branch access without unrelated store grants, grantable
  role choices, permission-editor labels, fresh link previews, secret-safe diagnostics, settled
  credential cleanup and contained mobile navigation. Failing browser regressions preceded fixes.
- Store/branch permission and loading checks pass. Both reflected PIN cases and neutral invitation
  renewal feedback pass against real APIs. Finite entrance animations settle before accessibility
  captures; continuous skeleton animation does not prevent checking loading states.
- Browser review reproduced an unfocusable read-only role matrix, plain shortcuts intercepting
  custom-select typing, and clipped mobile store actions. Minimal shared fixes make the matrix
  focusable, protect ARIA text-selection controls and reveal focused actions inside scrolling tables.
- Final Codex review found stale delivery eligibility after a replayed preparation checkpoint and
  terminal expired invitations showing unavailable actions. Three failing PostgreSQL/Maileroo
  regressions preceded a shared live eligibility read; a failing browser regression preceded the
  explicit closed expired state. Already-saved delivery outcomes still replay without sending.
- The complete standard browser run passed 129 of 130 cases. Its remaining LAN acceptance
  assertion did not scroll to the virtualized member row; the corrected keyboard scroll and new
  expired-state case pass in a focused follow-up (four tests including setup).

### Verification

The public browser suite passes **28 tests**, including the full owner-to-cashier milestone:
verified signup, sign-in, store, branch, product, custom-role creation and editing, captured-email
cashier invitation, acceptance and sign-in. LAN acceptance also passes with WAN blocked without
marking email ownership verified. Its **66 screenshots cover 22 states** at 1366×768, 1440×900 and
390×844, with axe checks. Evidence is preserved in `/tmp/shopper-day7/public-full-final-evidence`.

`vp check` passes all 576 formatted files and 412 lint/type-checked files; `vp run guard` passes.
Production builds and project-reference type checks have passed. The final complete backend
suite passes **46 files and 181 tests**, including real Workers integration, both adapter
conformance suites and the delivery-state/replayed-eligibility regressions
(`/tmp/shopper-day7/eligibility-full-backend.log`).

The final workflow regression/conformance run passes six files and eleven tests, including the
real Workers wrapper and both launchers. The complete invitation browser folder passes **12 tests**
including setup, the corrected LAN keyboard path and the new terminal expired state. Its final
evidence is preserved in `/tmp/shopper-day7/admin-invitations-final-evidence`. The standard
portal/till run passed 129 of 130 cases before that corrected case was rerun; these are separate
runs, not a claimed aggregate full-suite pass.

Codex `gpt-6.1-sol` at medium effort reviewed the whole change and then reviewed the fixes; the
final review found no actionable defects. The consolidated UI review found no confirmed visual
defect against the supplied Figma references in the captured states. Reports are preserved in
`/tmp/shopper-day7/codex-review-fixes-final.log` and `/tmp/shopper-day7/ui-final-review.md`.
All required checks and the end-to-end milestone pass. The implementation is ready to commit
and record as complete in Day 7; the weekly schedule-review checkboxes remain unperformed.

### Boundaries

Live Maileroo sender configuration is unverified; delivery contracts use the local Maileroo server.
Automatic recovery of waiting box workflows remains deferred to Day 36. PostgreSQL preserves
workflow state and enforces expiry after restart. Role deletion and staff-account deletion remain
deferred as approved. No deployment is included in this milestone.
