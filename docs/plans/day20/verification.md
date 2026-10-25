# Day 20 · Audit system UI: verification

Branch `day20-audit`, from `main` at `8d146a8`. One commit per slice.

| Slice | What                                                                                 | Commit    |
| ----- | ------------------------------------------------------------------------------------ | --------- |
| 1     | `device_audit` / `audit_anchor` (migration 0028), paged stream verification          | `9db50ff` |
| 2     | Till audit chains upload to `POST /sync/audit`; golden-day audit coverage            | `2e93900` |
| 3     | Audit viewer API, CSV export, `price.set` on the product's history                   | `9054f85` |
| 4     | Daily anchor: the one watchdog (cron / box timer) starts a one-shot workflow per org | `fe242c9` |
| 5     | Shifts carry a Z cross-check and an anchor check, computed at read time              | `ae7f125` |
| 6–7   | Portal Audit log and Integrity tabs, shift badges, product History link              | `94ff8f8` |

Slice 8 (docs, schema pins, this file) is the last commit.

## Notion tests

| Test                                                        | File                                                                    | Broken once on purpose                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| A row tampered in the DB is flagged exactly                 | `tests/integration/audit/tamper.test.ts` (org), `device.test.ts` (till) | Upload hash check skipped → 2 red in device |
| Every command the golden fixtures ran produced an audit row | `tests/integration/sales/golden/day.test.ts`                            | —                                           |
| Done when: who changed this price, when, where, approved by | `tests/e2e/portal/audit.spec.ts` (three clicks from the product)        | —                                           |

Also broken on purpose: the runtime allowlist (`/audit` missing → `tests/integration/audit/runtime.test.ts` red,
and the screens got a 404 in the e2e), and the entry sheet's focus fallback (a linked entry with no row on the page
→ the Integrity e2e red against the old bundle).

## Suites

- Audit and shifts integration (`tests/integration/audit`, `shifts/crosscheck`, `api/shifts`, `sales/golden`): green.
- Portal e2e `tests/e2e/portal/audit.spec.ts`: 6 specs green (plus setup). Setup needed a 30 s expect timeout on this
  machine (about 0.5 GB free); the specs themselves run unchanged.
- Full integration: 329 files, 1444 tests. First run: 1429 passed, 12 skipped, 3 failed plus one suite. Two were
  schema pins that did not know the new tables and till step (fixed in Slice 8); the workerd suite and the portal
  staging build hit their 5-minute timeouts under memory pressure; rerun alone, both pass (workerd 1 test in
  115 s, the staging build 6 tests in 43 s).

## Screens

`docs/plans/day20/screenshots/portal`: the log at 1920, 1440, 1366, 768 and 390; the entry sheet at 1440 and 390;
the filtered-empty state at 1440 and 390; Integrity passing at all five sizes and failing at 1440 and 390. Every
shot ran an axe pass and a horizontal-overflow check. Figma has no audit frames; the tabs follow "Previous
purchases" (45:852) and the sheet the Day 19 fiscal sheet.

The first mobile pass showed the eight stacked filters squeezing the table to nothing; the table now keeps a
minimum height and the page scrolls. `/skeleton-audit`: the route's pending state dropped the heading, tabs and
action, so the page jumped on load. It now keeps them, rows match the real 66 px, and the Integrity note follows
its wrapped height (68 / 108 / 148 px). Loaded and skeleton boxes agree at all five sizes; layout shift is 0.

## Review

Codex (`gpt-6.1-sol`) reviewed each slice. Fixed: the Cloudflare runtime closed the DB before a streamed CSV
finished (now closed after the body ends); the Z cross-check compares tax and account figures too; focus fell to
the document when a linked entry had no row. Kept as a known limit: shift membership by the register's clock.

## Known limits

- The entry diff shows stored values (money in minor units, field names as stored).
- Shift membership for the cross-check is by device time; a clock set back mid-shift reads as a mismatch.
- A day the watchdog misses has no anchor; the next day's covers it. A retried anchor email may arrive twice.
- Tampering on a till before upload is caught as a rejected upload and blocks it; the till UI does not show it yet.
- The box anchor runs in-process until Rivet lands (Day 36). No Scheduler conformance case: nothing uses the port.
- Archive inclusion of the CSV waits for Days 41–44 (`auditCsv` is ready for it).
