# Day 38 plan · Seal the binary + offline installer

Branch `day38-seal-installer` off `main` (ec62677, Day 37 merged as PR #54). Data is disposable: local
Postgres, the Rivet volume, RustFS buckets and `.shopper/` may be wiped whenever that is simpler.

## Context

Notion row **38 · Seal the binary + offline installer** (Phase 6, P0, surfaces Box + Infra).
Goal: **install a whole store server with no internet in under 30 minutes.** Done when a fresh Ubuntu VM with no
network goes installer → wizard → running box in < 30 minutes.

What the code has today (checked, not assumed):

- `apps/box` builds with Vite SSR to `dist/index.js` (`tooling/build/server.mjs box`). Nothing compiles it.
- **Spike on this server (Bun 1.4.4):** `bun build --compile dist/index.js` works (125 MB, 1.1 s).
  `--compile --bytecode` **fails**: `apps/box/src/server.ts` has a top-level `await import("hono/bun")`, which
  bytecode (CommonJS) cannot hold. The sealed entry must not use top-level await.
- The box never runs migrations at start: only `tooling/database/migrate.ts` does, from a folder on disk.
  `deployment.md` already promises "On start, the binary runs pending migrations, records the version in
  `shopper_meta`". That promise is unmet.
- The portal is served from `SHOPPER_PORTAL_DIR` on disk (`apps/box/src/portal.ts`), not embedded.
- Day 37 left: backup CLI inside the sealed binary (the systemd unit already calls `/opt/shopper/bin/shopper-backup`),
  Caddy/Avahi/firewall installation, the mDNS drill.
- Day 36 left: the napi Rivet runner (`rivetkit` + `@rivetkit/rivetkit-napi-linux-x64-gnu`) inside the binary.
- `/setup` in `@shopper/backoffice` already exists, but it is the signed-in **shop readiness** wizard
  (`_shop/setup`, needs a session). First boot has no org and no user, so it cannot reuse it.
- No archive import exists yet (Shopper Archive is Days 41–44).

| Notion task                                                                    | Decision                                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bun build --compile --bytecode` → `shopper-box`, migrations + portal embedded | S1. Static `hono/bun` import in a Bun-only entry; migrations and portal embedded as files; first spike answers the native addons.       |
| Signature checks at boot for binary, Rivet engine, licence                     | S2. Release manifest signed with an Ed25519 release key; licence check already exists (Day 37) and moves into the same boot gate.       |
| Offline installer `shopper-box-installer.run`                                  | S3. A shell header plus a tar payload, no new dependency; PostgreSQL 18, pinned Rivet engine, Caddy, binary, Avahi, systemd units.      |
| First-boot wizard at `https://shopper.local/setup`                             | S4. Org, store, admin user, licence. **Archive import is not built** (needs Day 41 format); the wizard says so and the step comes then. |
| Signed update bundle, build date signed in                                     | S5. Same bundle format, `kind: "update"`.                                                                                               |
| Refuse bundles built after `maintenance_until`; tax packs always ok            | S5. `builtAt` is signed; compared with the licence's `maintenanceUntil`.                                                                |
| A/B slots, mandatory verified backup, Install update, schedule after closing   | S5 + S6. Slots `a`/`b` and a `current` symlink; Day 37's `backupBox` runs first; scheduling is a Workflow (`sleepUntil`).               |

## Decisions

1. **Sealed entry** `apps/box/src/main.ts` (Bun only, static `import { websocket } from "hono/bun"`). `server.ts` stays
   for Node tests. Migrations: the drizzle folder is embedded with `import … with { type: "file" }` through a
   generated `embedded.ts` (written by the seal script, not committed), extracted to a temp dir, then run with the
   same `migrateDatabase`. Version recorded in `shopper_meta` after a clean migrate.
2. **Portal embedded** the same way (a generated file map; `portal.ts` reads `Bun.file` from the map when no
   `SHOPPER_PORTAL_DIR`). The traversal tests from Day 36 keep running against both sources.
3. **Native and wasm assets.** The spike in S1 decides per asset: `rivetkit-napi` (`.node`), `better-sqlite3-multiple-ciphers`
   (`.node`), `@resvg/resvg-wasm` and the satori fonts. Preferred: embedded and loaded from the compiled binary. Fallback
   (named, not silent): shipped in `/opt/shopper/lib` beside the binary, hashed in the release manifest, so the
   boot check still covers them. The test below runs the binary from an empty directory to prove which one it is.
4. **Release signing** (`@shopper/core/release`, WebCrypto Ed25519 like `lic/1`): `manifest.json` =
   `{ format: "rel/1", kind: "install"|"update"|"taxpack", version, builtAt, schemaVersion, files: {path: sha256} }`
   signed with the release private key (CI secret `SHOPPER_RELEASE_SIGNING_KEY`, never in the repo). The public key is
   a build define (`SHOPPER_RELEASE_KEY`), like `SHOPPER_LICENCE_ISSUER`, so the box config cannot swap it. A build
   without it (dev, tests) verifies nothing, same rule as the licence.
5. **Boot gate** (`apps/box/src/boot.ts`): hash the running binary and the Rivet engine against the signed manifest
   in `/opt/shopper/current/manifest.json`, check the licence (Day 37), then serve. A mismatch refuses to start with one
   plain sentence naming the file. The installer's own check uses `openssl pkeyutl -verify -rawin` (Ed25519), which an
   offline Ubuntu has, so verifying the bundle needs nothing from the bundle.
6. **Bundle** = `#!/bin/sh` header + `tar` payload (`makeself`-style, hand written, about 60 lines, no dependency).
   `tooling/installer/build.ts` assembles it from `tooling/installer/pins.json` (exact versions and sha256 of the
   PostgreSQL 18 debs, the Rivet engine binary, Caddy, Avahi debs). Fetching pins is the only online step and runs in
   the release job, never on the customer's machine. The installer: verify signature and hashes → install debs with
   `dpkg -i` (offline) → create `shopper` user, `/etc/shopper/box.env` (random secrets), PostgreSQL cluster and
   database → place slot `a`, `current` symlink → install units (box, engine, Caddy, backup timer, Avahi) →
   start → print the **one-time setup code**.
7. **Wizard** at `/setup` while the box has no org: the box redirects `/setup` to the portal route `/install` (a public
   layout in `@shopper/backoffice`, because `/setup` is taken by the signed-in readiness screen and a route cannot be
   both). Steps: (1) setup code (printed by the installer, hashed in `shopper_meta`; stops a LAN neighbour claiming
   the box), (2) organisation and first store, (3) admin user, (4) licence (paste `licence.json`, or copy the request
   code), (5) done, sign in. One `defineCommand` `box.install` creates org, store, owner and audit row in one
   transaction and burns the code; once an org exists `/install` answers 404 forever.
8. **Updates** are found in `/var/lib/shopper/updates/*.run` (USB or scp), never uploaded through the browser
   (assets rule). The portal lists verified bundles with version, built date and the `maintenanceUntil` verdict;
   **Install now** or **Install after closing** (pick a time). Apply: verified backup (`backupBox`, aborts on any count
   mismatch) → stage into the inactive slot → flip `current` → restart → boot gate + migrations + health. A health
   failure flips back and says so. Migrations are forward-only, so rollback after a migration is the documented
   restore of the pre-upgrade backup (`deployment.md` already says this). Scheduling is a Workflow
   (`box/update`: `sleepUntil` → backup → handoff to a transient `systemd-run` unit that survives the box restart); the
   row is `workflow_run`, the change is audited. No cron, no polling.
9. **Backup CLI in the binary**: `shopper-box backup` subcommand; `/opt/shopper/bin/shopper-backup` is a symlink to it,
   so the Day 37 systemd unit works unchanged.

Out of scope (named): archive import in the wizard (Days 41–44), Windows tills on the LAN (Day 40), failure drills
(Day 39), browser upload of bundles, delta updates, update-channel server, real Ubuntu VM and real mDNS (see Risks).

## How I work (per your instructions)

No subagents (the `planner`, `test-author`, `implementer`, `ui-builder`, `ui-reviewer` and `reviewer` roles are done
inline using the skills `feature-plan`, `tdd-slice`, `cloud-box-parity`, `ui-screen`, `ui-verify`, `skeleton-audit`,
`pre-merge-review`, `playwright-cli`). Per slice: failing integration test first, break-check, implement, run the
slice's tests, `vp check`, `vp run guard`, commit. Before push: `codex review` on `gpt-6.1-sol`. Push once, PR, bind with
`ccd_pr`, watch CI and auto-fix until green, merge, then update the Notion row. Context7 and the Cloudflare/Bun docs
for compile and embed questions. Figma: the MCP seat is **rate limited again** (one metadata call answered, the rest
refused) and the supplied frames are the POS "Dashboard" page with no install or update frame, so the new screens reuse
the portal's setup rail, billing card, alert and badge patterns; that goes in the verification record.

## S1 · Seal the binary

`tests/integration/box/sealed.test.ts` (builds once, `bun build --compile --bytecode`): copy the binary to an empty
temp dir with no `node_modules`; start it against a fresh database with only the config env; `/health` answers; the
migration journal equals `SCHEMA_VERSION` and `shopper_meta` holds the version; the portal shell and one hashed asset
are served from the binary (no `SHOPPER_PORTAL_DIR`); a Rivet-backed workflow starts and finishes (the napi runner
loads); a receipt renders (satori + resvg). A second start does not re-run migrations. Break-check: removing an embedded
migration fails the journal assertion. Work: `main.ts`, `tooling/box/seal.ts`, `embedded` generation, `box migrate`
at boot, `shopper-box backup` subcommand (the Day 37 backup test also runs through the binary).

## S2 · Signed releases and the boot gate

`tests/integration/box/boot.test.ts`: a valid install passes; a changed binary byte, a swapped engine, a missing file,
a manifest signed by another key and a manifest from another `kind` refuse to start with the file named; a locked
licence still boots read-only (Day 37 rule); no `SHOPPER_RELEASE_KEY` build verifies nothing. Break-check: skipping the
engine hash fails the swapped-engine case.

## S3 · Offline installer

`tests/integration/installer/install.test.ts` (Docker, skipped without it; runs in CI): an Ubuntu 24.04 container on
`--network none` with systemd runs `shopper-box-installer.run`; a tampered payload byte is refused **before** anything
is installed; a good run leaves PostgreSQL 18, the engine, Caddy, the box and the timer active, `https://shopper.local`
answering through Caddy, and prints a setup code; the whole run is timed and asserted under 30 minutes (expected
minutes, not tens). Re-running the installer on an installed box is refused unless `--repair`. `tooling/installer/pins.json`
and `build.ts` are exercised by a small test that rejects a pin whose hash differs.

## S4 · First-boot wizard

API `tests/integration/box/install.test.ts`: an empty box reports `needsInstall`; a wrong setup code is 403 and counts
against the rate limit; the right one creates org, store, owner and one audit row in a single transaction and burns the
code; a replay is 404; the new owner signs in; a licence pasted for another machine is refused with its reason; a
double submit creates one org. The tenant sweep gets the new public routes in `PUBLIC` on purpose. UI
`tests/e2e/portal/install/wizard.spec.ts` against the sealed binary: each step, validation, wrong code, licence refused,
keyboard path (`Enter`, `Alt+1..5`), finished state that signs in. Screens: `screens/install/screen.tsx`,
`components/install/`, `queries/install/`, following the setup rail. `ui-verify` at 1920/1440/1366/768/390 and till size.

## S5 · Update bundles

`tests/integration/box/update.test.ts` (real files, fake `systemctl`): a signed update stages into the inactive slot;
a bundle built after `maintenanceUntil` is refused with the dates in the message; a tax-pack bundle with the same
dates is accepted; a bundle for an older `schemaVersion`, a tampered file and an unsigned bundle are refused; a failed
backup count aborts before any slot changes; after a health failure `current` points at the old slot again. Break-check:
dropping the `builtAt` comparison fails the maintenance case.

## S6 · Install update UI and scheduling

`tests/integration/box/update-schedule.test.ts`: `Install after closing` starts a `box/update` workflow that sleeps to
the chosen time, survives a box restart (Rivet), runs once, writes `workflow_run` and an audit row; cancelling before the
time runs nothing. `tests/e2e/portal/updates/updates.spec.ts`: list of bundles, refused-by-maintenance state, install now,
schedule, in-progress and failed-and-rolled-back states. Permission is data (`settings.write` or the existing box
permission), no role checks. Same viewport matrix.

## S7 · Docs, CI, review, ship

CI job builds the sealed binary and runs S1–S2 on every PR; the installer job runs S3 on a schedule and on release
branches (it is slow). Docs: `deployment.md` (box release, installer, update bundles, signing keys), `platforms.md`
(boot gate, slots), `security.md` (release signing, setup code, update refusal), `apps/box/README.md`,
`docs/plans/day38/verification.md`. Codex review; PR; CI; merge; Notion row (tick tasks, Status Done, Progress, Remarks).

## Risks (read before approving)

- **Native addons in the compiled binary** (`rivetkit-napi`, SQLite, resvg wasm) are the unknown. S1 answers it in its
  first hour; the fallback keeps them beside the binary under the signed manifest, and the remark says so.
- **The < 30 minute claim** is measured in a no-network container with systemd, not a real Ubuntu VM. A real VM run and
  real mDNS (no Avahi daemon on this server) need your machine; I will record exactly what was and was not exercised.
- **Pinned downloads** (PostgreSQL 18 debs, Rivet engine, Caddy) need network when the installer is **built**. Hashes are
  pinned; if a pin moves upstream the build fails loudly instead of shipping something unsigned.
- **Scope**: this is a full day only if S1's spike goes well. S5/S6 are the first to slip; I would rather ship S1–S4
  solid than all seven thin.
