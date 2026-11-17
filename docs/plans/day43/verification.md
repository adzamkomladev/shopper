# Day 43 verification: cloud → on-prem

Milestone: **a cloud shop moves on-prem in one evening.** Everything below ran on Linux against real PostgreSQL 18
(Docker fixtures), the in-process cloud API and the real box app (`createBoxApp`), plus the real portal for the e2e.

## What each slice proved

| Slice | Test                                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                             | Break-check                            |
| ----- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| S1    | `migration/report.test.ts` (3)                                                 | The cloud and an imported copy report the same rows and checksums per table and the same per-day totals. A secret planted in a hidden column changes no checksum. One damaged sale plus one renamed device names `sale`, `device` and the day, with the gross out by 10000                                                                                                                         | Hidden columns not subtracted: red     |
| S2    | `migration/onprem.test.ts` (4)                                                 | Only `migration.run` starts the move. Starting it seals an archive and freezes the org (member write 423, push 423, no receipt blocks, reads work, banner status `open`). The licence is issued from a request code, is genuine, and is for this shop and site (422 for a bad code, 403 for a cashier). Calling it off unfreezes the shop                                                          | Freeze middleware removed: red         |
| S3    | `migration/handover.test.ts` (3)                                               | Unsigned 401. Another org's licence 409, a stray licence 403, another archive 409. The claim (through `serveRuntime`) hands over credentials and one code per device, and claiming again gives fresh codes. A wrong report stays claimed. A right one archives for good (a later report 409) and hands each register its `reloc/1` to the box                                                      | Licence id not checked: red            |
| S4    | `box/import.test.ts` (3)                                                       | The wizard names the archive's shop, and creating a shop is refused (409). A wrong code or a licence for another machine imports nothing. When the report's answer is dropped the result is 502 and the wizard stays. A rerun completes: `archive_import` ready with an `ok` report, and the cloud archived. The wizard is then gone                                                               | Retry gate on `needsInstall` only: red |
| S5    | `migration/onprem.cutover.test.ts` (1), **the row's test**                     | **Cloud → box full cutover; verification report all green.** Every table and every day agree, and the cloud is archived. An unpinned till asks to pin, spending nothing. Each till relocates to the box as the same device with the same codes and blocks, then gets the next block. The store sequence is cloud + 1. Fiscal documents, passwords and PINs are identical. The cloud refuses pushes | —                                      |
| S6    | `installer/install.test.ts` (4, container)                                     | The full offline install still passes. `--import` with a file that is not an archive (a relative path) is refused before anything is installed. The argument parsing was self-checked for every case                                                                                                                                                                                               | —                                      |
| S7    | e2e `portal/migration/onprem.spec.ts` (7), `portal/install/import.spec.ts` (1) | **M** and MOVE then **Mod+Enter** start the move. The archive is sealing, then ready with the install command, Download and licence issue (Copy / Download). A mismatch table and Call off. The moved state with the banner and tills. A box offers no Move on-prem. The box wizard covers a wrong code (back to step 1 with values kept), a mismatch, then done                                   | —                                      |

Screenshots for every state at 1920, 1440, 1366 (till), 768 and 390 are in `screenshots/`. Two issues they showed are
fixed: the mismatch title was clipped on mobile, and an empty action row left a gap in the moved state.

## Not run here

- The Electron half of `pin-box` (pin the CA, write `ca`, relaunch; keep the CA when relocating to a LAN box) is
  type-checked only. The host side is covered by S5.
- The installer's happy path with `--import` (copy plus `SHOPPER_IMPORT` in `box.env`) is not run in the container.
  Only the refusal is.

## Codex review (gpt-6.1-sol, `--base main`, medium)

Six findings. I checked each against the code, fixed five with a test that fails without the fix, and named one:

- **P1 fixed: the cloud runtime never served the move.** The authenticated `serveRuntime` path did not forward
  `licenceSigningKey`, so `/migration/onprem` was 404 and nothing froze in production. `handover.test.ts` now asks
  through `serveRuntime` (red with 404 without the fix).
- **P1 fixed: the storefront kept taking orders.** Shoppers have no back-office principal. Every storefront write
  (`/shop/:code/*` except GET) is now 423 for a leaving shop (`onprem.test.ts`, a shopper sign-in).
- **P1 fixed: a lost answer to an accepted report stranded the box.** The cloud now answers a repeated report from the
  move's own box with the agreed comparison, and a repeated claim with the credentials and no new codes. The box keeps
  the codes it recorded first. `box/import.test.ts` now loses the answer after the cloud has archived, then
  completes.
- **Second pass (the fix commit), P2 fixed:** the archived resume skipped the manifest check. It now checks it first,
  so a box installed from another archive is not resumed (`handover.test.ts`, 409).
- **P2 fixed: a mismatch marked the box's import ready.** The report is kept, and the import stays pending so the
  wizard can run again.
- **P2 fixed: a move called off mid-claim or mid-report could be claimed or archived.** Both transitions now update
  only from the expected status, and answer 409 otherwise.
- **P1 named, not fixed: background workflows still write during the window.** A store-day close or a billing run
  that wakes between the snapshot and the report makes the report disagree. The owner then sees which tables differ,
  calls the move off and starts again. Pausing those workflows for a leaving org is a cross-workflow change; I'm
  leaving that decision to you. After archiving, they keep updating the read-only cloud copy, which no one trades on.
