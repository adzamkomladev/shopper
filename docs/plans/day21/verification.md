# Day 21 verification

What was run to prove the access work, and the checks that went red on purpose first. The plan is in
[plan.md](plan.md).

## Integration (Postgres 18 fixture)

Run: `vp test --run tests/integration/auth/members tests/integration/auth/roles tests/integration/api/branches tests/integration/sync/approvers`
→ 6 files, 22 tests passed (26 Oct).

| File                                        | What it proves                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/roles/delete.test.ts`                 | An unused role archives with a `before` audit row; a member or pending invitation blocks it (409); the owner role and roles above the ceiling are refused                                                                                                                        |
| `auth/members/deactivate.test.ts`           | A deactivated member is refused everywhere at once (portal session, sign-in, till password and PIN, `hasPermission`); a sale before the cut still uploads and one after it is refused; self, the last owner and above-ceiling targets are refused; reactivation restores sign-in |
| `auth/members/branches.test.ts`             | A scoped member signs in only at their branch's registers; the owner stays org-wide; unknown branches 404; a scoped admin grants only inside their own branches and never manages a wider member                                                                                 |
| `api/branches/scope.test.ts`                | Shifts, stock records and registers of another branch are invisible; writes naming another branch are refused before anything is written; the audit log, tax and fiscal views and the branch lists keep to the member's branches; org-wide members and tills are unchanged       |
| `sync/approvers/refresh.test.ts` (extended) | A deactivated manager drops off the approvers at the next refresh; the till forgets members deactivated or scoped away from its branch and keeps the rest                                                                                                                        |

## Break-it checks

Each check was broken on purpose, watched go red, then restored and watched go green:

- `grantedCodes` without the active-member filter → the deactivation permission assertions fail.
- `hasGrant` without its time-aware rule → the historical approval upload fails.
- Till login without the branch check → the scoped sign-in test fails.
- Approvers without the staff scope → the refresh pruning test fails.
- `listShifts` without its scope → the shift visibility test fails.

## Codex findings fixed (gpt-6.1-sol, per slice)

- Slice 2: a deactivated manager could still approve. `listApprovers` now returns active members only,
  and `hasGrant(..., at)` is historical.
- Slice 3: out-of-scope cashier sessions are now cut; role assignment respects the scope ceiling;
  `staff` is optional for older clients.
- Slice 4: an uppercase device id could bypass the revoke check, so ids are lowercased and an unknown
  device is refused; portal audit rows had a null branch, so `commandContext` now takes the write's branch.

## E2E (real portal against a reset e2e database)

`vp exec playwright test --project=setup --project=portal tests/e2e/portal/roles tests/e2e/portal/users`

- `roles/delete.spec.ts`: delete an unused role by keyboard; an in-use role says who holds it; the
  owner role offers no delete; group toggle and filter.
- `users/access.spec.ts`: limit a member to one branch by keyboard; an empty branch set is refused;
  the owner's switch is locked; deactivate signs the member's open browser out and moves them to
  Deactivated, and reactivate brings them back; a scoped admin manages only members inside their
  branches.
- `users/grantable/roles.spec.ts` gains: a member above the editor's ceiling keeps their role as a
  choice and can be moved to a grantable one (Codex finding, slice 5).
- Updated for "Edit access" / "Access updated": `users/{members,capabilities}.spec.ts`,
  `users/grantable/roles.spec.ts`.

Result (26 Oct): the roles and users folders are green, 48 tests. Two specs
(`users/grantable/roles.spec.ts` "loading feedback" and `users/mobile/navigation.spec.ts`) timed out
waiting for the app shell while the machine's load average was about 30 on 8 cores, with a second
portal stack running. Rerun alone, all 8 tests in those files passed.
