# Day 40 plan · Tills on the box LAN

Branch `day40-box-lan` off `origin/main` (4294b07b, PR #58 merged). Data is disposable: local Postgres, the Rivet
volume, RustFS buckets, `.shopper/` and machine containers may be wiped whenever that is simpler.

## Context

Notion row **40 · WINDOWS — tills on the box LAN** (Phase 6, P0, surfaces Box + Till + Hardware). **Done when: a sealed
box runs a shop with no internet.** Tasks:

1. Signed till installer discovers `shopper.local`; enrol against the box
2. Real hardware sale through the box
3. Unplug the internet: full trading session, Z-report
4. Air-gapped mode: apply an update from a signed USB package

This is a Windows + hardware day, and this machine is Ubuntu with no Windows till or peripherals. So every task gets
an automated drill here that proves the software path, and a short runbook for the parts only real hardware can prove.

What the code has today (read, not assumed):

- **Gap: the till cannot find a box.** `firstRun` (`apps/till/electron/src/main.ts:166`) takes the upstream from
  `SHOPPER_TILL_UPSTREAM` or the build's `tillUpstream`, which the release workflow sets to the cloud. One signed
  installer therefore always enrols with the cloud. `pinBoxCa` (`trust.ts`) already pins a `.local`/IP box's CA, and
  Avahi already publishes `shopper.local` (`deploy/avahi/shopper.service`). Nothing tries it.
- **Gap: no way to type a box address.** When mDNS is blocked (a Windows network profile set to Public blocks it), the
  cashier has no way to give the address; the enrol screen shows no server at all.
- **Gap: nothing reads a USB stick.** `boxUpdates` lists bundles in `/var/lib/shopper/updates` "put there by USB or
  scp", but a sealed box has no shell for the owner, so a stick plugged into the box does nothing.
- Z-report = the shift close report: box side `packages/backoffice/.../shifts/report`, till print
  `packages/hardware/src/escpos/shift.ts`, till close `apps/till/ui/src/components/shift/close/done.tsx`. Never run as one
  session against a box with egress refused.
- Box-served till updates (Day 39 S6), receipt/pin trust (`trustsPinned`), `drillBox` + `sealedBox`
  (`tests/support/box/`), the Ubuntu+systemd `--network none` machine (`tests/support/installer/machine.ts`) and the
  virtual printer (`vp run services:up`) all exist and are reused.
- Figma: the **New Login** frame (173:3104) was read; it is the frame the enrol screen already follows (title bar,
  centred card, teal primary button). The View seat hit its rate limit on the second call, so the register-status
  frames (339:9672 etc.) were not read; UI reuses the enrol card, `Alert`, `Field` and Updates card patterns.

| Notion task                           | Slice | Expected work beyond the test                                            |
| ------------------------------------- | ----- | ------------------------------------------------------------------------ |
| Installer discovers `shopper.local`   | S1    | First run tries the box before the build's cloud upstream                |
| (same, when mDNS is blocked)          | S2    | Enrol screen shows the server and takes a typed box address              |
| Enrol + hardware sale through the box | S3    | Probably none: real enrol code → sale → virtual printer + drawer         |
| No internet: full session + Z-report  | S4    | Whatever the run exposes                                                 |
| Air-gapped update from a signed USB   | S5    | udev rule + `shopper-usb@` unit copy bundles from a stick, read-only     |
| Real Windows + hardware               | S6    | Runbook for the owner's Windows day; results recorded in verification.md |

## Decisions (defaults; say if you want otherwise)

1. **Discovery order on first run:** `SHOPPER_TILL_UPSTREAM` (dev/test) → `https://shopper.local` if it answers
   `/ca.crt` with a CA within 3 s → the build's cloud upstream. Probing `/ca.crt` is exactly `pinBoxCa`, so discovery
   is the existing pin with a timeout, not a second protocol. Same trust as today (trust on first use on the LAN; the
   enrolment code is single-use and expires in 15 minutes). A rogue `shopper.local` on the LAN could take an enrolment;
   that is the Day 37 TOFU decision unchanged, named in the verification file, not widened.
2. **Typed address:** the enrol screen says where it will enrol ("Shopper box on this network · shopper.local" or
   "Shopper cloud") with **Change server** (Alt+S): an address field (`192.168.1.20` or `shopper.local`, https only,
   `.local` or IP; a public name is the cloud and needs nothing). The host asks main to re-pin and restart the
   enrolment host on the new upstream (one new bridge message, `set-upstream`). Refused: not a box (no CA at
   `/ca.crt`), no answer in 3 s. Only before enrolment; an enrolled till never changes server here.
3. **USB import:** a udev rule starts `shopper-usb@<dev>.service` when a USB block device with a filesystem appears.
   `/opt/shopper/bin/shopper-usb` mounts it `ro,nosuid,nodev,noexec` under `/run/shopper/usb`, copies only regular
   files matching the existing `updateFile` name pattern and under 2 GB to `/var/lib/shopper/updates` (owner `shopper`,
   mode 640, atomic rename), unmounts. It never verifies or installs: signature, maintenance date and version are still
   checked by `prepare()` when the owner presses Install, as today. No browser upload (Day 38 decision kept).
4. **Offline session = egress refused, not unplugged:** the box drill sets the egress guard with an empty allowlist, so
   every outbound call is refused as it would be with the LTE pulled. MoMo/card-online tenders are expected to be
   refused with a clear message; cash and offline tenders trade.
5. **Hardware here = the virtual printer + drawer kick bytes.** Real printer, scanner and drawer are the runbook (S6).

Out of scope (named): mDNS service browsing (DNS-SD) beyond the `shopper.local` name, a QR that carries the box
address, exFAT/NTFS-specific tests (the machine test uses ext4; FAT/exFAT/NTFS go through the same `mount -t auto`),
udev itself in the container (no udev in Docker: the test starts the unit the rule would start), real Windows, real
hardware, real WAN unplug.

## How I work (per your instructions)

No subagents and no Workflow: the `planner`, `test-author`, `implementer`, `ui-builder`, `ui-reviewer` and `reviewer`
roles are done inline by following their skills: `feature-plan` (this file), `tdd-slice` per slice, `ui-screen` +
`ui-verify` + `playwright-cli` for the enrol screen and Updates card, `skeleton-audit` if a loading state changes,
`pre-merge-review` (Codex `gpt-6.1-sol`) before push. Context7 for Electron `net`/udev/systemd questions when unsure.

Per slice: failing test first → break-check (revert the fix once, watch it fail) → implement → slice tests → `vp check`
→ `vp run guard` → commit. Push once at the end, PR, bind with `ccd_pr`, watch CI and auto-fix until green, merge,
then update the Notion row (ticks, Status, remarks, honest about what only Windows can prove).

## S0 · Branch

The local tree holds the PR #57/#58 changes uncommitted; they are byte-identical to `origin/main` (checked: tracked
files have no diff against it; the untracked files exist on main). Confirm untracked files match main, discard them,
`git switch -c day40-box-lan origin/main`, `vp install`, `vp run services:up`.

## S1 · First run finds the box

Test `tests/integration/till/electron/discover.test.ts` (extends the `register` harness used by `enrol.test.ts`):

- a local HTTPS server with a Caddy-style internal CA serving `/ca.crt` stands in for `shopper.local`; with no
  `SHOPPER_TILL_UPSTREAM`, first run writes `register.json` with that upstream and `box-ca.pem` pinned;
- no box answering → the build's cloud upstream, nothing pinned, within the 3 s timeout (asserted bound);
- something answers `/ca.crt` with a leaf (not a CA) → falls back to the cloud, never pins it.

Implementation: `findUpstream(candidates, fallback, userData)` in `trust.ts` (candidates = `["https://shopper.local"]`
from main, the test's URL in the test) built on `pinBoxCa` with a timeout. Break-check: drop the probe → first test fails.

## S2 · Enrol screen names the server and takes an address

- Integration (same file): bridge `set-upstream` with a box URL → `register.json` upstream and pin replaced, host back
  as an enrolment host; a URL with no CA → refused with the reason, config unchanged; after enrolment → refused.
- Till UI: `components/enrol/server.tsx` (server line + Change server, Alt+S, an address `Field`, errors inline), host
  status carries `upstream` and `kind: "box" | "cloud"`. Harness states: cloud, box, changing, refused, connecting.
- e2e `tests/e2e/till/enrol/server.spec.ts`: keyboard path (Alt+S → type → Enter → server line changes), refused state.
- `ui-verify` at desktop 1920, laptop 1440, till 1366×768, tablet 768, mobile 390; console and overflow clean.

## S3 · Enrol and sell through a sealed box

Test `tests/integration/box/drills/lan.test.ts`: `drillBox()`; the owner creates an enrolment code on the box API; a
fresh register enrols with it against the box URL (real enrol route, not a fixture token); a cashier signs in, opens a
shift, rings a scanned item with cash; the virtual printer receives the receipt (receipt number and total in the
ESC/POS bytes) and the drawer kick; the sale is on the box once with the till's receipt number. Expect no product
change; anything that breaks is fixed test-first.

## S4 · No internet: a full trading day and a Z-report

Test `tests/integration/box/drills/offline.test.ts`: `drillBox({ SHOPPER_EGRESS: "on", allowlist: none })`, two tills:

- open shifts with a float; 30 sales across cash, card-offline and split tenders, one void, one refund, one paid-out;
- a MoMo tender is refused with a message that names the missing internet; the sale stays open and is paid in cash;
- close both shifts with counted cash → the box's shift report (Z) equals the till's: sales, refunds, tenders,
  expected vs counted cash, over/short; the till prints the Z (ESC/POS bytes carry the same totals);
- the store day closes on Rivet (`workflow_run` done), ledger entries balance, fiscal documents wait `pending` (not
  dead), and the egress log shows only refusals (nothing left the box).

Fix whatever the run exposes, test-first. Break-check on any fix made.

## S5 · Air-gapped update from a signed USB stick

- Files: `apps/box/deploy/udev/99-shopper-usb.rules`, `apps/box/deploy/systemd/shopper-usb@.service`,
  `apps/box/deploy/bin/shopper-usb`; `tooling/installer/install.sh` installs them and reloads udev rules.
- Machine test (in `tests/integration/installer/install.test.ts`, after the existing update test): build an ext4 image
  holding a signed 1.0.1 bundle, an unsigned bundle, `notes.txt`, and a symlink named like a bundle; `losetup` it in
  the machine; `systemctl start shopper-usb@loopN`; assert only the two bundle files are in `updates/` (owner
  `shopper`, mode 640), the symlink and `notes.txt` are not, the stick is unmounted, and `findmnt` during the copy
  showed `ro,nosuid,nodev,noexec`. Then the owner API lists both; Install of the unsigned one is refused ("not signed
  by Shopper"); Install now of 1.0.1 → the box reports 1.0.1 and the till feed answers 1.0.1, with no network.
- UI: Billing → Updates empty state and list hint say "Plug the USB stick with the update into the box. It appears
  here in a few seconds." `ui-verify` at the five sizes. Break-check: drop `nodev,noexec` check or the name filter.

## S6 · Windows and hardware runbook

`docs/plans/day40/windows.md`, for the Windows day: build the signed installer (`release-till` with Azure Trusted
Signing), install on the Windows till on the box LAN, check discovery (and Change server with the box IP), enrol,
sale on the real printer/scanner/drawer, pull the box's WAN, run a shift to a printed Z-report, close the day, plug the
USB stick with the update into the box, install, then the till updates from the box. Each step names what to record.
`docs/engineering/deployment.md` gains discovery, the typed address and USB import.

## Finish

`pre-merge-review` (Codex `gpt-6.1-sol`) on the branch, fix and re-run; full `vp check`, `vp run guard`, targeted
suites locally (the shared server is slow, so the full suites run in CI); `docs/plans/day40/verification.md` with
results, break-checks and limits; push once, PR, `ccd_pr` bind, CI until green (auto-fix and push), merge; Notion row:
ticks for what was proven here, Status, remarks that say plainly which items wait for the Windows/hardware run.
