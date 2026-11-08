# Day 38 verification

## Sealed binary (S1)

`tests/integration/box/sealed.test.ts` (5) seals the box with a small portal and runs the executable from a folder that holds
nothing else:

- an empty database is migrated on start (journal count equals the repo's), the portal shell and a hashed asset come out of the
  binary with the portal's headers, and `%2e%2e` / `..%2f` paths never read a file. Break-checked: dropping the migrations from
  the extraction makes the box exit;
- a restart migrates nothing again; a shop installed by an older binary gets exactly one `upgrade` `shopper_meta` row and one
  `org.record_upgrade` audit entry across two starts;
- `shopper-box backup` is the Day 37 backup (real `pg_dump`/`age`/`rclone`);
- `shopper-box doctor` runs a workflow to its first step on the in-process engine and on the real Rivet engine
  (`rivetdev/engine:3.0.0-preview.3`). This was red first: rivetkit loads its native addon by a computed name, so Bun never
  embedded it and the box died with "could not load a core runtime". `tooling/build/rivet.mjs` fixes it;
- a bare `ubuntu:24.04` container with `--network none` runs `doctor` and renders an image. This was red too: satori's
  harfbuzz and the resvg wasm were read from the build tree's `node_modules`, so the box passed on this server and died as the
  `shopper` user. The wasm is now embedded.

## Signed releases and the boot gate (S2)

`tests/integration/release/manifest.test.ts` (3) and `tests/integration/box/release.test.ts` (3): a manifest verifies for its key
and any changed kind, build date, version, file or key voids it; a folder as signed starts; a changed or missing engine, a manifest
from another key, a swapped binary (both ways round) refuse to start naming the file. Break-checked: skipping the engine hash
lets the changed engine start. The update verdict (`updateVerdict`) is tested at the boundary: the last day of cover passes, the
next does not, a tax pack passes, an older or same version, a missing licence and an install bundle are refused.

## Offline installer (S3), first boot (S4), updates (S5, S6) on a real systemd machine

`tests/integration/installer/install.test.ts` (project `machine`, 3 tests, about five minutes) builds the signed installer and
boots `ubuntu:24.04` with systemd as PID 1 on `--network none` (Docker, privileged):

1. an installer with one byte changed, and one whose public key was swapped, are refused before anything is installed (no
   `/opt/shopper`, no `psql`, no user);
2. `sh /installer.run` leaves PostgreSQL 18, Caddy, the Rivet engine and the box active, the migration journal complete, the box
   answering through Caddy's own CA at `https://shopper.local`, `box.env` at mode 640 and `current` pointing at slot `a`;
   `/setup` redirects a browser to `/install`; the printed setup code plus a licence issued from the wizard's request code creates the
   shop, the replay is 404, the owner signs in; a second run of the installer is refused. Installed and checked in **INSTALL_MINUTES**
   (budget 30);
3. the owner signs in, lists two signed bundles, is refused the update until backups are set up ("needs a verified backup first"),
   installs `update-good` (verified backup to a local rclone remote, spare slot `b`, `shopper-apply` flips and the box comes up
   healthy, `running.slot` is `b`), then installs a signed bundle whose box exits at once: after the health wait the helper switches
   back, `result.json` says `rolled_back` and the box is healthy on slot `b`.

Bugs this test found in code that was otherwise green: the box's database role needed `CREATEDB` (the backup restores into a
scratch database), Bun needs an executable `TMPDIR` for the native addon (a hardened `/tmp` is `noexec`), the box cannot remove its
spare slot's folder (its parent is root's), and `dpkg -i` (not `apt-get install ./*.deb`) is the offline way to install a closure.

API tests: `box/install.test.ts` (4: state and request code; wrong code, another machine's licence, weak password and no licence
create nothing; one audited creation under two simultaneous submits (break-checked: removing the lock's re-check gives a 500) and the
owner signs in to the one shop; five wrong codes lock the limiter), `box/update.test.ts` (4: verdicts and listing; backup first then
the spare slot holds exactly the signed files; failed backup, changed file, tax pack and path names leave the slot alone; scheduled
after closing waits, installs once, and a cancel installs nothing), `box/apply.test.ts` (2: healthy flips, unhealthy flips back with
the restore message, a request for the running slot or a bad slot changes nothing; break-checked: removing the switch back fails),
`box/updates.api.test.ts` (3: the cloud mounts no update routes, only `billing.manage` reads or starts, refusals reach the owner).
Break-checked: removing the backup before staging fails three update tests.

## UI

`tests/e2e/portal/install/wizard.spec.ts` (3) and `tests/e2e/portal/updates/updates.spec.ts` (4), with the box's answers replayed,
at 1920×1080, 1440×900, 1366×768, 768×1024 and 390×844 (axe and horizontal overflow asserted at each; screenshots reviewed):
the four steps with the licence last, validation, focus on the first field, Enter moves on, Back keeps what was typed, a wrong code
returns to step one with the reason, three steps where no licence is checked, an installed box goes to log in; the Updates card with
a bundle refused for being built after the updates date, Install now behind a confirmation, After closing with tonight 23:00 as the
default, a past time refused, a scheduled update with Cancel, the rolled-back result, the empty folder, and no card on the cloud.

Figma: the MCP seat is rate limited (one metadata call answered; the rest refused), and the supplied frames are the POS "Dashboard"
page with no install or update frame. The screens reuse the signup card, billing card, alert and badge patterns.

## Not exercised

mDNS (`avahi-daemon` cannot start in a no-network container: the installer warns and goes on; the real drill needs a LAN), a real
Ubuntu VM and hardware, Windows tills on the box LAN (Day 40), real R2 upload (the backup test uses a local rclone remote), the
`ufw` rules (not in the test image), a real production release key and licence issuer, and applying a tax rule pack (the verdict
accepts it; the tax module that applies one does not exist yet).
