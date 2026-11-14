# Day 41 verification: data export and the Shopper Archive

Milestone: **one click produces a complete, verifiable copy of a business.** Everything below ran on the Ubuntu dev
server: real PostgreSQL 18, the real portal and box processes, the sealed box binary (Bun) with its WAN refused, real
browser downloads, and `unzip -t` for the ZIP itself.

## What each slice proved

| Slice | Test                                                                    | Result                                                                                                                                                                                                                                                                                                                     | Break-check                                                                                                     |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| S1    | `export/archive.test.ts` (7)                                            | The archive is a stored ZIP that `unzip -t` accepts. One flipped byte in a table file, a blob, the manifest or the signature is found and named; a missing, replaced or extra file is refused; a re-signed archive verifies but names its other key; a newer format says "update Shopper"; a non-archive is refused        | Skipping the SHA-256 compare turned 3 tests red                                                                 |
| S2    | `export/dump.test.ts` (6), `export/coverage.test.ts` (2)                | Every table's rows are in the dump once, in id order, across pages of 3; a row inserted mid-dump is in no table; nothing of another org; no credential (hash, token, session, session key) in any byte; a 2^63-ish counter keeps its digits; blobs come along, a missing or swapped one is named                           | No org filter: 2 red. `read committed`: 2 red. No hidden columns: 1 red                                         |
| S2    | (coverage)                                                              | **Found two credential-like columns nobody had decided about**: `registration_request.verification_digest` and `kyc_case.otp_digest` (now hidden). Lockout counters and token expiry columns are named as safe                                                                                                             | —                                                                                                               |
| S3    | `export/job.test.ts` (9)                                                | The workflow runs to ready; the assembled file verifies; its counts are the database's; its size equals `zipLength` exactly; start and seal are audited and the chain verifies; a part that fails once is retried into one job; one key per org; a failed export says why; Delete removes parts, never the org's own files | No busy check: 1 red. No fail step: 3 red                                                                       |
| S4    | `export/entities.test.ts` (8)                                           | CSV and Excel hold exactly the database's rows for all nine entities; money exact to four decimals; ranges honoured and refused over a year; commas, quotes, newlines survive and `=1+1` is defused in CSV; paging crosses page boundaries; Excel over its cap is refused; each export is audited                          | No org filter: 2 red. Page boundary `>=`: 1 red                                                                 |
| S5    | `api/export.test.ts` (8), `security/*` incl. the tenant sweep (5 files) | A till session and a signed-out caller get 403/401 on every route; an owner's archive downloads as one verified ZIP with only their shop; another shop's archive is 404 on get, download and delete; one archive at a time (409); the caller cannot set the page size or the Excel cap                                     | No permission middleware: 7 red. Caller options through: 1 red. No `requireOrgWide`: the branch-scoped test red |
| S6    | e2e `portal/export/export.spec.ts` (7)                                  | The owner presses **A**, the archive is made by the real box workflow, the browser downloads it and the real verifier accepts it; **C** downloads a CSV with the shop's product; every state (none, preparing, ready, failed, unreachable, Excel too long, busy, forbidden) is shown                                       | —                                                                                                               |
| S7    | `box/drills/export.test.ts`                                             | The sealed box binary makes an archive with no route to the internet (the egress trap saw nothing), it downloads, verifies from the file alone, and its counts are the box database's                                                                                                                                      | —                                                                                                               |

## Codex review (gpt-6.1-sol, `--base origin/main`, medium) and own review

Four findings, all confirmed against the code and fixed test-first (each new test failed first):

- **P1 fixed**: a branch-scoped member holding the admin role got `export.run` and could take every branch's sales,
  audit and the whole archive. `/export/*` now also needs `requireOrgWide`.
- **P2 fixed**: a failed export left its table parts behind and Delete only removed four metadata files. A dump that
  fails now deletes what it wrote, and Delete of a job that failed after its dump reads `files.json` and removes the parts.
- **P2 fixed**: a product image or fiscal bundle whose stored bytes differ from the size and SHA-256 its row registered
  was hashed and signed as if genuine. It is now left out and counted ("missing or did not match its record").
- **P2 fixed (narrowly)**: the audit export of a range including today held one row more than the audited count (the
  command's own audit row arrives after the count). The reader now stops at the counted rows. Not built, by the
  repo's own rule on speculative races: a snapshot shared between the count and the read. Concurrent edits could still
  move which rows fall inside the count; the Excel cap is a usability guard, not a security one.
- **Own, before review**: the HTTP route first spread the whole query string into the export input, so a caller could
  have set the server's page size and Excel cap. Only `from` and `to` are read now (test).
- **Own**: `@shopper/export` read `buildInfo` at import, so any plain-Node consumer (the e2e's verifier) died with
  `SHOPPER_VERSION is not defined`. `ARCHIVE_FORMAT` is now a number in the code, `./verify` is a config-free
  subpath, and a test holds the number equal to the build's constant.

## UI

- Sidebar → Organisation → **Data export** (`export.run`). Two cards: **Download a spreadsheet** (what to export, dates
  for history entities, CSV and Excel; keys **E**, **C**, **X**) and **Full copy of your business** (what it holds, what it
  never holds, **Create archive** key **A**, the list with status, size, rows, who, Download and Delete, the signing
  key's fingerprint).
- Screenshots at 1920, 1440, 1366, 768 and 390 in `screenshots/export-{ready,empty,running,list,ranged}-*`: no
  horizontal overflow and no serious axe finding at any size (the `shoot` helper fails the spec otherwise). The
  forbidden state for a cashier, the busy refusal, the failed row and the Excel refusal are asserted in text.
- **Figma was not read.** The Figma MCP View seat is rate-limited ("You've reached the tool call limit for your View
  seat"): every call of the six links was refused, as on Day 40. The screen reuses the shipped portal patterns (the
  Billing Updates card, the Reports date pickers and export menu, `Alert`, `Badge`, `Empty`). Fidelity to the designer's
  frames is the open item.
- Skeletons are sized to the loaded spreadsheet card; the archive list's height depends on its rows, so it keeps a
  one-row block. A `skeleton-audit` measurement of the archive list was not run.

## Not exercised / limits

- **No signed URL for the whole archive** (the Notion row asks for "R2 signed URL"): the `Blobs` port has no multipart
  upload, so one multi-gigabyte object cannot be written without a port change (both adapters and conformance). The
  download streams the ZIP from the stored parts instead, with an exact `Content-Length`. First follow-up if a multipart
  method is approved.
- **No box-side write to a USB stick.** The owner downloads in the browser to disk or a stick.
- **Size and entry limits**: no ZIP64, so under 4 GB and 65,535 files; the error says so. The dump is one Workflow step
  inside one snapshot transaction, fine at pilot scale; a business too large for one step needs per-table steps over an
  exported snapshot. A Worker killed mid-dump can leave orphaned parts (a clean failure cleans up).
- **The browser holds the archive in memory** when it downloads (`downloadFile` reads a blob); a multi-gigabyte
  archive needs a native download link. Behind Caddy a streamed download may carry no `Content-Length`.
- **Sale-receipt PDFs and sync snapshots are not archived** (rebuilt from rows); product images, KYB documents and
  fiscal bundles are.
- **No credentials in an archive**: after a move people reset passwords and PINs and registers enrol again. The key
  proves the archive is unaltered, not who made it; the importer (Day 42) decides which keys it trusts.
- **The upcaster chain** for older formats is not written (there is nothing to upcast from yet); a newer format is
  refused with a clear message.
- **Real Cloudflare**: the `ArchiveExportWorkflow` class, its bindings in the edge and portal configs, and the
  `RECEIPTS` bucket on the workflow's Worker are type-checked and the portal config test counts them, but no workflow ran
  on workerd or against real R2 here.
- The full integration and e2e suites run in CI; locally the export, API, security, auth, db and tooling suites ran.
