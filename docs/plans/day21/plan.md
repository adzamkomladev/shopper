# Day 21 · Catch-up + permissions editor — plan

## Context

**Notion row:** 21 · Catch-up + permissions editor (Portal, Security), Sun 25 Oct, Catch-up. Card:
finish anything from days 15–20 · permission editor (role_permission as data), custom roles, user
deactivation, branch-scoped users · weekly review: if more than two days behind, decide the release date.

**Repo state (rechecked 26 Oct):**

- Local `main` is at `63d125f` (Day 15), with the `tsrs` edit uncommitted.
- `origin/main` is at **`cf453d2`**: Day 20 (`625b42d`) plus PR #34. PR #34 runs integration files
  in parallel in three groups (`integration` ×4, `heavy` ×2, `solo` ×1 in `vite.config.ts`), adds a
  prebuild global setup, and collapses `sessionAuthority` into one join that now includes `member`.
- PR #34 touches no auth, backoffice, API or dependency files. There are no open PRs and no Day 21
  branch.
- Consequence: new test files must own their DB and temp dirs (parallel), and nothing goes in
  `heavy`/`solo` without a reason.

**Catch-up finding:** Days 15–20 are all Done. Day 14's row still says "Not started" although PR #25
merged (`c7809ac`), so only its status needs flipping. The Day 13 device steps wait for the hardware.

**Date check:** today is 26 Oct, the day Day 22 was scheduled, so we are **one day behind**. That is
within the two-day threshold, so the release date holds (18 Nov). Day 22 moves to 27 Oct and the
following days absorb it, as the Sunday buffers allow.

**What exists (Day 7):** custom roles already work. `auth.role.create` and `auth.role.update` enforce
the grant ceiling, and the owner role is locked. The portal has a Roles screen with a switch matrix
(`components/roles/{form,matrix,table}.tsx`), and Users has a members table with Change role. The
missing pieces:

- roles cannot be deleted;
- members cannot be deactivated;
- nothing is scoped to a branch. Only tills are pinned to their own branch, through
  `onlyBranch`/`forceBranch` in `api/src/routes/stock/context.ts`.

**Figma (`4MtEIWv8yBUBYgkrk4ubPk`):** none of the supplied pages (New Login, Web Flow, Componets,
Login, Dashboard, Barcode Scanner) has user, role or permission frames. The screens extend the
existing Day 7 Users/Roles UI. They use the 45:852 status-tabs pattern (Active / Deactivated), the
12:66 inputs, and the Dashboard "Settings · Register" switch rows. Figma stays read-only, and the
missing frames go in the remarks.

### Your decisions (25 Oct)

- **Branch scope:** till and portal. A member with assigned branches can sign in and approve only on
  registers at those branches. Every branch-keyed portal read and write is limited to those branches:
  stock, shifts, registers/devices, audit log, tax reports and fiscal, and the branch/store lists.
  Catalogue, customers, tax rules, roles and users stay org-wide behind their permissions. No
  assigned branches means all branches. The owner is always org-wide.
- **Role delete:** only when unused, meaning no members, no pending invitations and no open KYC case
  requesting it. Otherwise 409, and the editor says what still uses it. The owner role can never be
  deleted. _Review change:_ delete **archives** the row (`role.archived_at`), because cashier sessions,
  KYC cases and invitations keep foreign keys to it as history. An archived role is hidden, can never
  be granted (`assertCanGrantRole` and KYC open return 404), and frees its name (a partial unique index).
- **Offline tills:** the server refuses a deactivated member at once. A register drops its cached
  sign-in and approver entry at its next approvers refresh. Sales a member made before deactivation
  still upload.
- **Local edits:** keep `tsrs`. Upstream already added it (`chore/toolchain-upgrade`), so it needed no commit of its own.
- **Standing rules:** data is disposable, so reset PG, DOs, D1 and till DBs freely. **No subagents**:
  everything runs in this session. Tests come first, then the implementation, then the test runs and
  fixes. Codex reviews run inline before each commit:
  `codex review -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`. One commit per slice,
  one push at the very end, then the PR and the Notion remarks. Never stage `.claude/settings.json`.
  No AI attribution.

### Skills / MCPs / commands

`/feature-plan` (this plan, copied to `docs/plans/day21/plan.md`) · `/tdd-slice` per slice ·
`/cloud-box-parity` (the migration and auth paths run on both runtimes) · `/ui-screen` → `/ui-verify` with
`playwright-cli` at 1920, 1440, 1366, 768 and 390 (till size included) · `/skeleton-audit` for the
changed screens · `/pre-merge-review` with Codex inline · Figma MCP (read-only) · shadcn MCP for any
missing primitive (AlertDialog and Checkbox are probably already in `@shopper/ui`) · Notion MCP for the
remarks · `vp check --fix`, `vp run guard` and targeted `vp test --run <files>` after every step.

---

## Key design choices

- **Deactivation lives on `member`** (`deactivated_at`), the org membership, not on `user`. One
  central check means every permission path refuses at once. `grantedCodes` adds
  `isNull(member.deactivatedAt)`, which covers `hasPermission`, `assertHasPermission` and
  `/session/permissions`. `resolvePrincipal` returns null.
- **Cashier sessions are cut, not revoked.** `sessionAuthority` (`core/src/sales/authority.ts`, now
  one join after PR #34) refuses any session with `revokedAt`. Its new `member` join must **not** filter
  on `deactivated_at`, or history breaks. It still checks `expiresAt`, so revoking would throw away offline sales made _before_
  deactivation. Deactivation sets `expiresAt = least(expiresAt, now())` instead. Earlier sales keep
  their historical authority, and anything after the cut is refused. `hasGrant` stays historical, so
  past approvals still upload (the Day 14 rule).
- **Branch scope is data:** a new `member_branch` table. With no rows the member is org-wide.
  `AuthPrincipal` gains `branchIds: string[] | null`, resolved once in `resolvePrincipal` and `null`
  for org-wide members. The grant ceiling extends to branches: you cannot grant a branch outside your
  own scope, or manage a member whose scope is wider than yours.
- **One scope helper replaces `onlyBranch`/`forceBranch`.** It lives in
  `api/src/middleware/require/branches.ts`: `branchScope(principal)` returns `[principal.branchId]` for
  a till, `principal.branchIds` for a back-office member, or `undefined` for all branches.
  `assertBranch(principal, branchId)` returns 403. Core list functions take `scope?: string[]` and
  filter with `inArray`.
- **Till pruning adds no new endpoint.** `GET /sync/approvers` is already a full replace on the
  register. It gains `staff: string[]`: the active members allowed at that register's branch.
  `listApprovers` filters to active members in scope. `refreshApprovers` also deletes `till_staff`
  rows not in `staff`, so a deactivated or out-of-scope member's offline sign-in goes away at the
  next refresh.

---

## Slices

Each slice runs: tests first (watch them fail) → implement → `vp check --fix` · `vp run guard` ·
targeted tests → codex review → fix → commit.

### Slice 0 — Branch, deps, reset

- `git stash` → `git pull --ff-only` (to `cf453d2`) → `git switch -c day21-access` →
  `git stash pop`. Upstream did not touch package.json or the lockfile, so the pop should be clean.
  If it is not, take origin's lockfile and rerun `vp install` to re-add `tsrs`.
- Commit **"Add tsrs dev dependency"** (package.json + lockfile only).
- `vp run services:up` · `vp run db:reset && vp run db:migrate && vp run db:seed`.
- Copy this plan to `docs/plans/day21/plan.md`.

### Slice 1 — Schema and role delete

- **Migration `0029_access.sql`** (forward-only, idempotent), with Drizzle in `db/pg/src/schemas/auth.ts`:
  - `member.deactivated_at timestamptz null`;
  - `member_branch`: `tenant()` columns (id v7, org_id, timestamps), `member_id`, `branch_id`.
    Composite FKs go to `member(org_id,id)` and `branch(org_id,id)`, with `on delete cascade` from
    member. Unique `(org_id, member_id, branch_id)`.
  - Index `member(org_id, deactivated_at)`.
- Update the schema pins that list tables (`tests/integration/db/...`, the Day 20 lesson).
- **`auth.role.delete`** in `auth/src/roles/commands.ts`:
  - needs `role.write`;
  - 403 for the owner role, and `assertCanGrantRole` (the ceiling);
  - counts members and pending, unexpired invitations with that role, and 409s with
    "Used by N members and M invitations";
  - deletes the role_permission rows, then the role;
  - audits `{ before }` with `entity: "role"`.
- API: `DELETE /roles/:id`. Split `api/src/routes/administration.ts` into
  `routes/administration/{roles,users}.ts` if it nears 250 lines.
- `listRoles` gains `memberCount`, and `roleListItem` gains the field.
- **Tests first:** `tests/integration/auth/roles/delete.test.ts`:
  - an unused custom role deletes and writes one audit row with `before`;
  - a role with a member → 409, and the role is still there;
  - a role with a pending invitation → 409; an expired invitation does not block;
  - the owner role → 403;
  - an admin deleting a role that holds `store.write` (above the ceiling) → 403.

### Slice 2 — Deactivate and reactivate (server + till login)

- Schemas in `auth/src/schemas/users.ts`: `memberStatusInput`. `userListItem` gains
  `deactivatedAt: string | null` and `branchIds: string[]`, and `listUsers` returns them.
- Commands in `auth/src/users.ts` (or a new `auth/src/members/status.ts` to stay under 250 lines):
  - **`auth.member.deactivate`**:
    - needs `user.write`, plus `assertCanGrantRole` on the target's role and the branch ceiling;
    - refuses self (409) and the last active owner (409);
    - sets `deactivated_at`;
    - deletes the target's Better Auth `session` rows;
    - cuts `cashier_session.expires_at` to now for live sessions;
    - audits `{ userId, before, after }`.
  - **`auth.member.reactivate`**: the same checks, clears the field, audits.
- **Enforcement:**
  - `grantedCodes`: active members only.
  - `createAuth.resolvePrincipal`: active members only.
  - `session/request.ts` `mutating`: after a successful sign-in, a deactivated membership is rolled
    back with `AuthRollback(403, "This account is deactivated")`. The session insert rolls back with
    the transaction.
  - `devices/password.ts` and `login.ts` `pinIdentity`: after the credential verifies, a deactivated
    member gets 403 "Account deactivated". The failure counters are not touched.
- API: `POST /users/:id/deactivate` and `POST /users/:id/reactivate` (`user.write`).
- **Tests first:** `tests/integration/auth/members/deactivate.test.ts`:
  - after deactivation:
    - an existing portal session gets 401 on `/session/permissions`;
    - a fresh sign-in gets 403, and no session row is left;
    - till password login gets 403, and PIN login gets 403;
    - `hasPermission` is false.
  - A sale timestamped before deactivation, on the cut session, **still uploads** through
    `sessionAuthority`. One timestamped after the cut is refused (`INVALID_SESSION`).
  - Self → 409 and the last owner → 409. An admin deactivating an owner → 403 (ceiling).
  - Reactivate → sign-in works again.
  - Both commands write audit rows naming the actor and the target.
- Break-it check: remove the `grantedCodes` filter and watch the permission assertion go red.

### Slice 3 — Branch-scoped members (server, till, approvers)

- **`auth.member.branches.set`** (`role.write`, the input is `{ branchIds: uuid[] }`, where empty
  means all):
  - every branch must exist in the org (404);
  - the owner cannot be restricted (409);
  - ceiling: if the actor is scoped, the requested set must be a non-empty subset of the actor's
    scope, and the target's current scope must also be a subset;
  - replaces the `member_branch` rows and audits `{ before, after }`.
- `AuthPrincipal.branchIds` is resolved in `resolvePrincipal`, with one query joined onto membership.
- **Till login:** `loginCommand` refuses with 403 "Not allowed at this branch" when the member is
  scoped and the device's `c.branchId` is outside the scope. This happens after the credential
  verifies.
- **Approvers:** `listApprovers(db, orgId, branchId)` returns active, in-scope members only. The
  response gains `staff`, and `core/src/schemas/till/approvers.ts` is updated.
  `sync/src/pull/approvers.ts` passes it through. `refreshApprovers` deletes `till_staff` rows whose
  `userId` is not in `staff` (audited count).
- API: `PUT /users/:id/branches`.
- **Tests first:**
  - `tests/integration/auth/members/branches.test.ts`:
    - a cashier scoped to branch A logs in on an A register, and gets 403 on a B register (password
      and PIN);
    - a manager scoped to A is not in B's approvers;
    - the owner cannot be scoped;
    - an admin scoped to A cannot grant B, and cannot edit an org-wide member;
    - an unknown branch → 404;
    - audit rows hold before and after.
  - Extend `tests/integration/sync/approvers/refresh.test.ts`: after deactivation (and after scoping
    the member away from the branch), a refresh removes their cached `till_staff` row and approver
    row. The till's offline sign-in for that email then fails.

### Slice 4 — Branch scope across the portal API

- `api/src/middleware/require/branches.ts`: `branchScope`, `assertBranch` and `scopedBody` (which
  replaces `forceBranch`: a till writes its own branch, and a scoped member's body branch must be in
  scope). Delete `onlyBranch`/`forceBranch` and repoint stock.
- Thread `scope?: string[]` into the core reads that are branch-keyed today:
  - stock (`listStock`, `readDocument`, `stockBranches`, reorder, takes);
  - shifts (`listShifts`, `readShift`; a shift outside scope reads as 404);
  - devices (`list`; enroll and revoke check the device's branch);
  - audit (`listAudit`, `auditFacets`, `auditCsv` filter `branch_id in scope`; `auditStreams` and
    `verify` cover only the device streams in scope, and the org stream is for org-wide members only);
  - tax reports and fiscal (branch filter);
  - management (`GET /branches` and `/stores` are limited to scope; store/branch writes stay org-wide
    and owner-only by permission).
- **Tests first:** `tests/integration/api/branches/scope.test.ts`. It seeds two branches with data in
  each and gives a member a full-read role scoped to A:
  - every list above returns A's rows only;
  - reading B's shift, stock document or device → 404/403;
  - a stock adjustment with B's branchId → 403;
  - the audit export contains no B rows;
  - an org-wide member still sees both;
  - a till still sees only its own branch (the existing stock tests stay green).
- Break-it check: drop the scope from `listShifts` and watch it go red.

### Slice 5 — Portal: permissions editor, roles, users access

Backoffice changes (`packages/backoffice/src`), no effects, every state, keyboard-first:

- **Roles:**
  - the table gains a "Members" count column;
  - the role sheet gains **Delete role** (shortcut `Mod+Backspace`, AlertDialog confirm), disabled
    with a reason when the role is in use or is the owner role; the server's 409 message shows inline;
  - the matrix gains a per-group "All" switch (on, off or mixed, honouring the ceiling) and a filter
    box (`/`) that narrows permissions by label or code.
  - Files: `components/roles/{form,matrix,table}.tsx`, a new `components/roles/delete/dialog.tsx`,
    and `queries/roles.ts` (`useDeleteRole`).
- **Users:**
  - **Active / Deactivated** status tabs with counts (45:852 pattern), with the tab kept in the URL;
  - a "Branches" column ("All branches" or names);
  - **Change role** becomes **Edit access**, one sheet with the role select plus a branch
    checklist. Its "All branches" switch is locked on for the owner, and branches outside the
    actor's scope are disabled with a note;
  - **Deactivate / Reactivate** row actions (`D` / `R` on the focused row) with an AlertDialog that
    explains the effect: "signs them out everywhere; registers drop them at their next sync".
    Deactivated rows are muted, with a "Deactivated" badge and a date.
  - Files: `screens/users/screen.tsx`, `components/users/members/table.tsx`, new
    `components/users/access/form.tsx` (replacing `change/role/form.tsx`),
    `components/users/status/dialog.tsx`, `queries/users.ts`.
- **States:** loading skeleton (no layout shift), empty (no deactivated members), offline (writes
  disabled), permission-less (read-only), the server error inline, and 409 messages.
- **E2E first:**
  - `tests/e2e/portal/roles/delete.spec.ts`: delete an unused role; an in-use role shows the reason;
    group toggle; filter.
  - `tests/e2e/portal/users/access.spec.ts`:
    - edit access to branch A;
    - deactivate → the row moves to the Deactivated tab, and that member's browser context is
      bounced to sign-in;
    - reactivate;
    - the whole flow by keyboard only;
    - a scoped admin sees B disabled.
  - Update the existing `users/members.spec.ts` and `roles/matrix.spec.ts` for the renamed action.
- `/ui-verify` at 1920, 1440, 1366, 768 and 390, with axe and overflow checks and screenshots in
  `docs/plans/day21/screenshots/`. Then `/skeleton-audit` on Users and Roles.

### Slice 6 — Docs, full runs, review, push, PR, Notion

- Docs:
  - `packages/auth/README.md`: deactivation, branch scope, the role-delete rules and the
    cut-not-revoke reason;
  - `docs/engineering/architecture.md`: a branch-scope line next to the role_permission rule;
  - `docs/plans/day21/verification.md`: the test record and break-it evidence.
- Full `vp check`, `vp run guard` and `vp test --run`, then the full e2e run. Any memory-pressure
  timeouts are rerun alone and recorded, as on Day 20.
- `/pre-merge-review`: whole-branch Codex review (gpt-6.1-sol, medium). Fix every confirmed finding,
  each with a test that went red first.
- `git push -u origin day21-access` (the only push) → `gh pr create` with no attribution → bind it
  with `ccd_pr` and read CI.
- **Notion:**
  - Day 21 row: Status Done, tasks ticked, and **Remarks (25 Oct)** in the Day 20 shape: status,
    your decisions, shipped, tests, review, decisions to confirm, upgrade notes, known limits;
  - the weekly review line: one day behind (Day 21 finished 26 Oct), within the threshold, so the
    release date holds;
  - flip Day 14's status to Done.

---

## Upgrade notes (expected)

- Migration `0029_access`.
- The approvers response gains `staff`. The till and server ship together; tills can be reset.
- No new secrets, DOs, workflows or crons.

## Known limits (expected, for the remarks)

- An offline register still admits a deactivated or out-of-scope member until its next approvers
  refresh.
- Roles stay org-wide, so a branch-scoped member's role applies the same at each of their branches.
- Sales and refund history reports (Day 22) must use `branchScope` too. This is noted for that day.

## Verification

- Integration: the new files `roles/delete`, `members/deactivate`, `members/branches` and
  `api/branches/scope`, plus the extended `sync/approvers/refresh`. Each was red before its
  implementation, and each has a break-it check recorded.
- E2E: `roles/delete` and `users/access`, plus the updated users/roles specs, in a real portal against
  a reset DB.
- Manual through `playwright-cli`, step by step:
  1. Sign in as the seeded owner. Create a custom role "Branch lead", then delete an unused one.
  2. Scope a member to one branch and check that their stock, shifts and audit views show only that
     branch.
  3. Deactivate them, confirm their open portal tab gets a 401 and is sent back to sign-in, then
     reactivate.
- `vp check`, `vp run guard` and the full `vp test --run` are clean, and CI is green on the PR.
