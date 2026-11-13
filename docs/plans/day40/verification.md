# Day 40 verification: tills on the box LAN

Milestone: **a sealed box runs a shop with no internet.** Everything below ran on the Ubuntu dev server against the
real sealed box binary (Bun), real till host processes, the virtual ESC/POS printer and, for USB, a systemd Ubuntu
machine with no network. Real Windows, real peripherals and a pulled WAN cable are the runbook (`windows.md`).

## What each slice proved

| Slice | Test                                                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Break-check                                     |
| ----- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| S1    | `till/electron/server.test.ts`, `till/host/enrol.test.ts`                                     | **Bug found**: first run pinned a box CA into `register.json`, but the host's config schema (`strictObject`) had no `ca`, so a register enrolling with a box exited at start ("Host exited before ready"). Fixed (`ca` optional in the install schema). First run now tries `https://shopper.local` for 3 s and pins it; otherwise the build's cloud. A name answering with a leaf, or nothing, falls back with nothing pinned; a silent box costs < 4.5 s                 | Failed first: host exited; `findServer` missing |
| S1    | (same)                                                                                        | Node's socket `timeout` fires at ~2× on a TLS socket that never answers (6 s for 3 s): replaced by `AbortSignal.timeout`                                                                                                                                                                                                                                                                                                                                                   | Silent-box test failed at 6026 ms first         |
| S2    | `till/electron/server.test.ts`, `till/host/enrol.test.ts`, e2e `till/ui/enrol/server.spec.ts` | Status names the server (`address`, `box`). A typed address goes to Electron, which checks it is a box on the LAN, pins its CA, rewrites `register.json` and relaunches (the host reads the CA only at start); refusals say why ("Nothing answered at …", "… is not a Shopper box", "Type the box's address …"). An enrolled register refuses (`ALREADY_ENROLLED`)                                                                                                         | Failed first on the missing request/reply       |
| S3    | `box/drills/lan.test.ts`                                                                      | With the box's internet unplugged: a register with no identity enrols with a one-time code over the real enrol routes, a cashier's sign-in is checked by the box (`offline: false`), printer settings saved, shift opened (drawer kick for the float), a cash sale prints its receipt number and kicks the drawer once in the same job, and the sale is on the box once with that number                                                                                   | — (no product change)                           |
| S4    | `box/drills/lan.test.ts`                                                                      | Same register, still no internet: 10 sales (cash, card, a split), a cash refund, then a count of exactly float + cash − refund and the card slips: every variance is 0, the Z prints, and the box holds every sale, the refund (own upload worker) and the Z with the same expected/declared cash. **The box made no outbound attempt at all during the session**; a control in the same file proves the trap catches Bun's fetch (`CONNECT api.paystack.co:443`, refused) | Control test                                    |
| S5    | machine `installer/install.test.ts`                                                           | Bundles arrive on a stick (ext4 image as a loop device; the test starts `shopper-usb@<dev>` as the udev rule would). Only the two signed bundles and the forged one are copied (owner `shopper`, mode 640); `notes.txt` and a symlink named `update-link.tgz` pointing at `/etc/shopper/box.env` are not; the stick is unmounted. The box lists the forged bundle as not signed and installs/rolls back the signed ones as before                                          | See result below                                |

## UI

- Till enrol screen (Figma "New Login" 173:3104): a server panel under the intro, "Shopper box on this network" or
  "Shopper cloud" with the address, **Change server** (Alt+S); the address form (autofocus, Enter submits, Esc
  cancels), inline errors, "Restarting on …" while the register relaunches. Screenshots at 1920, 1440, 1366 (till),
  768 and 390 in `screenshots/till-enrol-server-*`; no horizontal overflow at any size; axe has no serious findings.
  The OFFLINE refusal now says "network connection", not "internet connection" (a box LAN has none).
- Billing → Updates empty state: "Plug the USB stick with the update from Shopper into the box; its bundles appear here
  a few seconds later." (`screenshots/updates-rolled-back-*`, e2e `portal/updates/updates.spec.ts` 7/7).
- Figma MCP: one frame read (New Login), then the View seat's rate limit; the register-status frames were not read.

## Not exercised / limits

- Real Windows: mDNS resolution of `shopper.local`, the Public network profile, the signed installer's signature, real
  printer/scanner/drawer, a pulled WAN cable, a FAT/exFAT stick and udev itself (Docker has no udev). All in `windows.md`.
- Discovery trusts the first `shopper.local` that hands over a CA (trust on first use, as Day 37's pin); a rogue box on
  the LAN could take an enrolment code. Unchanged decision, documented in `deployment.md`.
- Change server only targets a box (`.local` or an IP); there is no "back to the cloud" button before enrolment
  (reinstall clears it).
- MoMo with no internet, the store-day close and fiscal drain after the WAN returns are in the runbook, not the drill.
