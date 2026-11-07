# Day 37 plan · Box services

Branch `day37-box-services` off `main` (01c582d, Day 36 merged as PR #53). Data is disposable: local Postgres,
the Rivet volume, RustFS buckets and `.shopper/` may be wiped whenever that is simpler.

## Context

Notion row **37 · Box services** (Phase 6, P0, surfaces Box + Security). Done when both adapters pass the same suite.
The Versioning & Upgrades page fixes the licence's commercial rules: the licence is perpetual and machine-bound,
`maintenance_until` is a separate date that only governs updates, and "the 60-day check-in ladder only confirms the
licence is genuine; it never depends on maintenance".

| Notion task                                  | State today / decision                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conformance green on `adapters-box`          | Box dev adapters pass `portConformance`; Rivet passes the workflow contract (`rivet.test.ts`, Day 36). **Gap:** the port suite never ran on the box's production blobs (RustFS). |
| mDNS `shopper.local`                         | Not done. Avahi publishes the host name; no new dependency.                                                                                                                      |
| LAN TLS via Caddy internal CA                | Not done. Caddy `tls internal`; the till pins the box's root CA at first run.                                                                                                    |
| Backup timer `pg_dump \| age \| rclone → R2` | Only `tooling/backup/verify.ts` (cloud restore check). Box backup not done.                                                                                                      |
| Licence: Ed25519, machine-bound, ladder      | Not done. Read-only machinery exists (`readOnlyGuard`, 402, `ReadOnlyBanner`) for overdue invoices.                                                                              |
| Egress allowlist                             | Not done.                                                                                                                                                                        |
| `maintenance_until` separate                 | Part of the licence format `lic/1`.                                                                                                                                              |
| Licence-signed request helper (v1.5 relay)   | Not done. Used first by the licence check-in itself.                                                                                                                             |

## Decisions

1. **Licence `lic/1`** (`@shopper/core/licence`, WebCrypto Ed25519 — Workers, Bun and Node all have it, no
   dependency). `licence.json` = `{ format: "lic/1", id, org, site, machine, key, terminals, issuedAt,
   maintenanceUntil, signature }`. `machine` is SHA-256 of `/etc/machine-id`; `key` is the box's own Ed25519 public
   key. Shopper signs it with the issuer key. The issuer **public** key is a build define (`SHOPPER_LICENCE_ISSUER`
   → `buildInfo.licenceIssuer`), never an env var on the box, so an operator cannot swap it. A build without an
   issuer (dev, tests) does not enforce licences.
2. **Ladder from the last check-in.** A check-in is a licence-signed request to the cloud; the cloud answers with a
   confirmation `{ licence, confirmedAt }` signed by the issuer, which the box keeps as `confirmation.json`. Days since
   the last confirmation (or `issuedAt`): under 30 `valid`; 30–59 `grace` (banner: check in by …); 60+ `locked`
   (portal read-only). Missing, forged, other-machine or unreadable licence → `locked` at once. Tills never lock:
   device principals pass the guard. Maintenance is shown, never consulted. An air-gapped site gets the same
   signed confirmation file from support (no new code).
3. **Check-in runs on the existing daily watchdog** on the box (no new timer), plus a "Check in now" action.
   No licence table, no migration: two signed files in `SHOPPER_LICENCE_DIR`, which cannot be forged.
4. **Licence-signed request helper**: `signedRequest(box key, licence, request)` adds `Shopper-Licence`,
   `Shopper-Signed-At` and `Shopper-Signature` (Ed25519 over method, path, time and the body's SHA-256);
   `verifySignedRequest` rejects a forged licence, a wrong key, a changed body and a signature older than 5 minutes.
   The cloud route `POST /licence/confirmations` is public on purpose (sweep `PUBLIC` list) and answers 503 unless the
   edge holds `SHOPPER_LICENCE_SIGNING_KEY` (an Ed25519 private JWK).
5. **First boot without a licence** generates the box key and shows a _licence request code_
   (`{ machine, key }`) in Settings → Licence; `tooling/licence/issue.ts` turns a request code into `licence.json`.
6. **Backup** (`apps/box/src/backup.ts`, CLI entry run by a systemd timer): export a snapshot and count every table
   inside it, `pg_dump --snapshot -Fc`, restore into a scratch database, count again, refuse on any difference, then
   `age -r <recipient>` and `rclone copyto <remote>`; the plaintext dump never leaves the work dir and is deleted.
   The box never holds the age identity. CI installs `postgresql-client-18`, `age` and `rclone`.
7. **Egress allowlist** (`apps/box/src/egress.ts`): the box entry wraps `fetch` so internet calls go only to the
   provider hosts it uses (Paystack, Hubtel ×2, Arkesel, Maileroo), the GRA SDC and licence hosts from config, plus
   `SHOPPER_EGRESS_ALLOW`. Loopback, private LAN and `.local` are always allowed. The OS firewall copy is the Day 39
   installer's job. (Notion said five hosts; the box actually calls seven, listed in platforms.md.)
8. **mDNS + TLS are configuration**: `apps/box/deploy/` gets the Caddyfile (`shopper.local`, `tls internal`,
   `/ca.crt` on port 80), the Avahi service file and the backup systemd units. The till's first run with a `.local`
   upstream fetches `http://<host>/ca.crt`, checks it is a CA certificate, pins it, and forks the host with
   `NODE_EXTRA_CA_CERTS` (trust on first use on the shop LAN; the enrolment code still proves the server).
9. **Conformance**: `portConformance` also runs on "box production adapters" (RustFS blobs, PostgreSQL sequencer,
   SQLite cache). The workflow cases stay on the in-process twin there; Rivet passes the same contract in
   `rivet.test.ts`.

Out of scope (named): licence revocation list in the cloud, admin UI to issue licences (script only), uploading a
confirmation file through the portal, OS-level firewall rules and installing Caddy/Avahi (Day 39 installer), the
backup subcommand inside the sealed binary (Day 38), clock-rollback detection.

## How I work (per your instructions)

No subagents. Per slice: failing integration test first (`tdd-slice`), break-check, implement, run the slice's tests,
`vp check`, `vp run guard`, commit. Before push: `codex review` (`pre-merge-review`). Push once, PR, ccd_pr bind, CI
until green, squash-merge, then Notion. UI (licence banner and settings page) verified with `playwright-cli` at
1920/1440/1366/768/390 and till size, every state and the keyboard path. Figma MCP is rate-limited on this seat, so
the screens follow the existing portal settings and banner styling.

## S1 · Licence core and signed requests

`tests/integration/licence/licence.test.ts`: a valid licence is `valid`; 30 days without check-in is `grace` with
its lock date; 60 days is `locked`; a confirmation resets the ladder; a past `maintenanceUntil` changes nothing;
forged signature, another machine, another issuer and a missing file are `locked` with a reason. Signed request:
accepted; changed body, other key, stale time rejected.

## S2 · Check-in route and the read-only guard

`tests/integration/licence/checkin.test.ts` (edge API with a signing key): a signed check-in returns a confirmation
the box accepts; a forged one is 401; no key is 503. `tests/integration/box/licence.test.ts` (`createBoxApp`):
**expired licence → owner's product change is 402 with the licence reason, reads work, a till sale still syncs**;
`GET /licence` shows the state; without a licence it shows the request code; check-in now posts to a fake cloud and
unlocks.

## S3 · Backup

`tests/integration/box/backup.test.ts`: on a seeded shop with a sale, the backup restores into a scratch database
with identical row counts per table, the remote (rclone `:local:`) holds one `.age` file that decrypts with the
identity to a dump, the scratch database is dropped and the plaintext deleted.

## S4 · Egress allowlist

`tests/integration/box/egress.test.ts`: an unknown host is refused before any network call; configured hosts,
loopback, LAN and `.local` pass; `SHOPPER_EGRESS_ALLOW` adds a host.

## S5 · LAN TLS and mDNS

`tests/integration/till/electron/trust.test.ts`: a CA from `/ca.crt` is pinned (a leaf certificate is refused), and a
Node process started with the pinned file reaches an HTTPS server whose certificate that CA issued (openssl in the
test); without it, the request fails. Deploy files: Caddyfile, Avahi service, systemd units.

## S6 · Conformance on box production adapters

`portConformance("box production adapters", …)` with RustFS blobs in `conformance.test.ts`.

## S7 · Licence UI

Shell banner (grace = warning, locked = destructive, "Tills keep selling"), Settings → Licence page (state, site,
licence id, terminals, maintenance until, last check-in, lock date, request code with copy, Check in now). Only shown
when the API has a licence (`GET /licence` 404 on the cloud). e2e spec for the states.

## S8 · Docs, review, ship

platforms.md (box services), deployment.md (box backup, licence issue), security.md (licence, egress, TLS),
`apps/box/README.md`; `docs/plans/day37/verification.md`; Codex review; PR; CI; merge; Notion.
