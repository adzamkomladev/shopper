# Day 21 handoff (26 Oct)

How to pick up Day 21 on another machine. The approved plan is in [plan.md](plan.md); this file
records where the work stands against it and what is left.

## Where it stands

Branch `day21-access`, based on `origin/main` at `cf453d2` and pushed to origin. No PR yet.

| Commit    | Slice                                                                         | State                                     |
| --------- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| `acbeecc` | 1. Role delete (archives the role) and the access schema, migration `0029`    | Done, tested, Codex reviewed              |
| `8468ca2` | 2. Deactivate and reactivate members (server and till login)                  | Done, tested, Codex reviewed              |
| `02f5081` | 3. Branch-scoped members (`member_branch`, till login, approvers, `forgetStaff`) | Done, tested, Codex reviewed           |
| `ed3f5d6` | 4. Branch scope across the portal API                                         | Done, tested, Codex reviewed              |
| `3a5ac47` | 5. Portal UI (WIP)                                                            | Written. `vp check` and guard are clean. **No e2e run, ui-verify or review yet** |

Slice 0 (the `tsrs` dev dependency) was dropped: it was already upstream.

## Standing rules from the user

- **No subagents.** Do the work in the main session. Write meaningful tests first, then the
  implementation, then run the tests and fix what fails.
- **One commit per slice.** Push at the end. The branch is already pushed, so later pushes are
  normal fast-forwards.
- **No AI attribution** in commits or PRs. Never stage `.claude/settings.json`.
- **Data in PG, DOs, KV and the till DBs is disposable.** Reset freely.
- **Codex review before each commit:**
  `codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`.
  For the whole branch, use `--base main` instead of `--uncommitted`.
- **Figma** file `4MtEIWv8yBUBYgkrk4ubPk`, nodes 12-66, 27-2031, 45-852, 173-3087 and 227-4900.
  None of them has user, role or permission frames. Use the 45:852 status-tabs pattern, and note
  the missing frames in the remarks.
- **Product decisions:**
  - Branch scope applies on the till and in the portal.
  - A role can be deleted only while unused, and deleting archives it.
  - An offline till prunes deactivated or out-of-scope staff at its next approvers refresh.

## Environment

- Install: `vp exec pnpm install --frozen-lockfile`.
- Services: `vp run services:up`, then `vp run storage:setup` (RustFS buckets; without them the
  sync receipt tests return 503), then `vp run db:migrate` and `vp run db:seed`.
- Postgres was on host port **5433** on the last machine. Export the variables before any DB or
  test command. Use the credentials from `.env.example` and match the port your compose maps:
  `DATABASE_URL` and `TEST_DATABASE_URL` point at `/shopper`; `E2E_DATABASE_URL` points at
  `/shopper_e2e`.
- Run long test runs in the background and in groups. A single wide `vp test --run` hung once for
  more than 40 minutes.
- Two failures are known to be environmental and Windows-only: the Bun live test (`/C:/` path)
  and the Electron package test (electron-builder). They should pass on Linux; if they don't, look
  into it.

## What slice 5 contains (`packages/backoffice/src`)

- **Users:**
  - `screens/users/screen.tsx`: Active / Deactivated tabs, with the tab in `?status=deactivated`
    (`usersSearch` in `schemas/users.ts`, validated on `usersRoute`).
  - `components/users/status/{tabs,dialog}.tsx`.
  - `components/users/access/form.tsx` replaces `change/role/form.tsx`, which is deleted. It holds
    the role select, the "All branches" switch (disabled for the owner) and the branch checkboxes.
    Unticking every branch shows "Choose at least one branch". The save button is "Save access".
  - `components/users/members/table.tsx` gains:
    - a Branches column; names come from `GET /users/branches` and are only known with
      `role.write`, otherwise it shows "N branches";
    - a "Deactivated {date}" badge;
    - Edit access, Deactivate and Reactivate buttons. You can't deactivate yourself, and only an
      owner can deactivate an owner.
- **Queries:**
  - `queries/users.ts`: `accessBranchesQuery`, `useSaveAccess`, which PATCHes the role and PUTs
    the branches, each only if it changed, and toasts "Access updated", and `useMemberStatus`.
  - `queries/roles.ts`: `useDeleteRole`. The DELETE returns 204, so its schema is `deletedRole`
    (`v.null()`).
- **Roles:**
  - `components/roles/delete/dialog.tsx`: Delete role in the role sheet, with a confirmation. It
    is disabled with "N member(s) holds it" while in use and hidden for locked roles and the
    owner role. The shortcut is **Mod+Shift+Backspace**, because Mod+Backspace is word-delete in
    the focused Name field.
  - `components/roles/matrix.tsx`: an "Every {Group} permission" checkbox per group (it goes
    mixed when partly on, and acts on the grantable codes shown) and a "Filter permissions"
    search with the `/` shortcut.
  - `components/roles/table.tsx`: a Members column.
- **Shared:**
  - `packages/ui/src/components/checkbox.tsx`: indeterminate styling and a minus icon.
  - `components/fields/switch.tsx`: a `disabled` prop.
- **E2E:**
  - New: `tests/e2e/portal/roles/delete.spec.ts` and `tests/e2e/portal/users/access.spec.ts`.
  - Renamed "Change role" → "Edit access" and "Role updated" → "Access updated" in
    `users/{members,capabilities}.spec.ts` and `users/grantable/roles.spec.ts`.

## What is left

1. **Run the slice 5 e2e specs and fix what fails:**
   `vp exec playwright test --project=setup --project=portal tests/e2e/portal/roles tests/e2e/portal/users`.
   Things to watch:
   - In `roles/matrix.spec.ts`, the switch count (37) should be unchanged, but the new checkboxes
     and the filter sit inside the dialog.
   - The members spec "the last owner can't be demoted" expects the server's "last owner" alert in
     the access sheet.
   - The users screen is about 235 lines, under the 300 limit.
2. **`/ui-verify` with playwright-cli** at 1920, 1440, 1366, 768 and 390, covering every state:
   - loading;
   - an empty Deactivated tab;
   - offline;
   - read-only;
   - errors and 409s;
   - the keyboard path.

   Put the screenshots in `docs/plans/day21/screenshots/`. Then run `/skeleton-audit` on Users
   and Roles.
3. **Codex review** of the slice. Fix what it finds, then amend or follow up on the WIP commit
   with a clean slice message.
4. **Slice 6:**
   - docs: `packages/auth/README.md` (deactivation, why sessions are cut rather than revoked,
     branch scope, role delete), a branch-scope line in `docs/engineering/architecture.md`, and
     `docs/plans/day21/verification.md` (the test record plus the break-it evidence below);
   - full `vp check`, guard, tests and e2e;
   - a whole-branch Codex review;
   - push, then `gh pr create` with no attribution, then read CI.
5. **Notion:**
   - mark Day 21 Done, with remarks covering decisions, what shipped, tests, the review, upgrade
     notes and known limits;
   - add the weekly review: one day behind, within the threshold, so 18 Nov holds;
   - flip Day 14's status to Done; its PR #25 merged.

## Evidence so far (for verification.md)

- **Break-it checks went red**, then green after restoring:
  - the `grantedCodes` active-member filter;
  - the time-aware `hasGrant` rule;
  - the till branch-login check;
  - the approvers staff scope;
  - the `listShifts` scope.
- **Codex findings fixed:**
  - Slice 2: a deactivated manager could still approve. `listApprovers` now returns active members
    only, and `hasGrant(..., at)` is historical.
  - Slice 3:
    - out-of-scope sessions are now cut;
    - role assignment now respects the scope ceiling;
    - `staff` is optional for older clients.
  - Slice 4:
    - an uppercase device id could bypass the revoke check, so ids are lowercased and an unknown
      device is refused;
    - portal audit rows had a null branch, so `commandContext` now takes the write's branch.

## Known limits (for the remarks)

- The tax summary's line filter by scope isn't tested against data: `goldenWorld` resets the tax
  rules, so only the refusal and the scope are tested.
- Scoped members don't see audit entries that have no branch.
- An offline till admits a deactivated or out-of-scope member until its next approvers refresh.
- An old till rejects the new approvers response, so the till and server ship together.
- Roles are org-wide.
- Day 22 sales and refund reports must use `branchScope`.

## Upgrade notes

- Migration `0029_access`.
- The approvers response gains `staff`.
- No new secrets, DOs, workflows or crons.
