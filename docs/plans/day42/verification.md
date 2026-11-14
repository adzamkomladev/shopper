# Day 42 verification: import + on-prem → cloud

Milestone: **an on-prem shop moves to the cloud in one evening.** Everything below ran on a Windows 11 dev machine
against real PostgreSQL 18 (Docker), RustFS and the real box and portal processes for the e2e. The Linux-only box
suites (sealed binary, slots, drills) cannot run on Windows and are left to CI.

## What each slice proved

| Slice | Test                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                  | Break-check                          |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| S1    | `migration/import.test.ts` (6)                    | A Day 41 archive of the fixture org imports into an empty database with every table's rows equal (as `to_jsonb`, minus hidden columns) and no other org. A second run changes nothing. One flipped byte writes zero rows. A newer schema is refused. The next store sequence and receipt block continue, and the audit chain verifies                                                                   | —                                    |
| S2    | `migration/api.test.ts` (3)                       | Unsigned → 401. A licence for another org → 403. A file that differs from the manifest → 422. A commit with files missing → 409, naming them. Commit → workflow → ready, with signed `reloc/1` messages. Credentials are applied, then nulled                                                                                                                                                           | No licence/org check: red            |
| S3    | `migration/relocate.test.ts` (3)                  | Before ready → 409. A good code → a token for the same device, which handshakes. Reuse, a wrong device or an expired code → 401                                                                                                                                                                                                                                                                         | `usedAt` not checked: red            |
| S4    | `migration/move.test.ts` (3)                      | From the start the box refuses member and register writes (423), and a second start is refused. The move seals, sends each file exactly once despite a dropped line, and commits. A handshake hands over the register's relocation once recorded and issues no receipt blocks                                                                                                                           | Read-only middleware removed: red    |
| S5    | `migration/tills.test.ts` (1), **the row's test** | **Box → cloud: tills relocate, next receipt numbers continue, fiscal sequence unbroken.** Two registers (one in its second block) relocate as the same devices with the same branch/register codes. The cloud hands back exactly their blocks, then the next one after the last. The store sequence continues at box + 1. Pending fiscal documents are identical. The box token is refused in the cloud | Import skipping `receipt_block`: red |
| S6    | e2e `portal/migration/move.spec.ts` (8)           | **M** opens the move. Confirm stays off until an https address and MOVE are typed, and **Mod+Enter** posts `{cloudUrl}`. The steps, the moved state with each till (Moved / Waiting), and a failed move with Try again prefilled are all shown. Every page shows the read-only banner. The cloud does not offer the link                                                                                | —                                    |

## Codex review (gpt-6.1-sol, `--base origin/main`, medium)

Five findings. I checked each against the code, fixed four test-first (each new test failed first) and left one as
a named limit:

- **P1 fixed: the runtime never routed `/migration/*`.** `isPublicRequest` did not list it, so both shells sent the
  move and the imports to the empty public API (404). `api.test.ts` now goes through `serveRuntime`: red with 404,
  then green.
- **P1 fixed: imported rows were not checked against the shop.** A licensed box signs its own manifest, so a
  crafted archive could plant rows (or a second org) in a shop already in the cloud. Every part is now refused
  unless each row's `org_id` (the `id` for `org`) is the importing shop's (`migration/tenant.test.ts`, 403).
- **P1 fixed: a lost commit answer reopened the box.** If the cloud took the commit but the box never heard back,
  the move was marked failed and the box took changes again. That would split the shop. From the commit on, a
  failure now keeps the box read-only with the reason shown (`migration/commit.test.ts`, plus an e2e state).
- **P2 fixed: a failed workflow start was never retried.** The import row moved to `importing` before `start()`, so
  a retried commit skipped it. Every commit now starts the import until it is ready (the port makes starting a
  running instance a no-op). In `api.test.ts` the engine refuses the first start.
- **P2 named, not fixed: a lost `/devices/relocate` answer spends the one-time code.** That register is enrolled
  again by hand. Making the code re-redeemable would weaken a deliberate single-use check, so that is your decision.
- **Found while running the wider suites:** `licence/readonly` and `billing/dunning` compared `/billing/status`
  exactly. They now include the new `move: null`.

## UI

- Sidebar → Organisation → **Move to cloud** is shown only on a box (its `/billing/status` names a licence) and only
  with `migration.run`. One card holds the evening checklist, the tills, **Move to cloud** (key **M**), and a confirm
  dialog asking for the cloud address and MOVE typed out. Next come the Sealing / Sending / Opening steps
  (`aria-current="step"`), then Moved with each till's state, or the stopped move with its reason and **Try again**.
- Banner on every box page while moving or moved (`role="status"`, link to the move).
- Screenshots at 1920, 1440, 1366, 768 and 390 are in `screenshots/move-{ready,confirm,uploading,moved,failed,banner}-*`.
  None overflows horizontally and none has a serious axe finding (the `shoot` helper fails the spec otherwise).
- **Figma**: only node 12-66 (a form field) could be read. Every later call hit the View seat's tool-call limit. The
  screen reuses shipped patterns: the Day 41 export card, `ConfirmDialog`, `Field`, `Badge`, `Alert`, `Empty`.
  Fidelity to the designer's frames is the open item.
- The till's own screen has no "Moving to the cloud…" state. A register relocates and restarts in the background
  within one handshake, so the cashier sees an ordinary reconnect.

## Environment notes

- The local e2e ran with the box and portal servers only (a temporary local config). The full six-server stack
  exhausted this machine's 16 GB, and its disk filled once (ENOSPC). CI runs the whole suite.
- A screenshot-loop ordering issue in the spec (M pressed after the viewport loop had moved focus out of the page) was
  fixed in the test. The screen behaved correctly.

## Named limits

See [migration.md](../../engineering/migration.md#named-limits): one transaction for the import, the move finishes
at commit, the pull cursor is not reset, uploaded copies are kept, pre-org bookkeeping is not audited per org, and
the 7-day relocation code. The required test does not push a real outbox sale to the cloud.
