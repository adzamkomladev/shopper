# Day 25 · Onboarding & ease of installation

## Context

Notion row "25 · Onboarding & ease of installation" (phase 4 · Harden & pilot, Portal + UI, Thu 29 Oct).
**Goal:** a new supermarket goes from sign-up to its first sale without calling us. **Done when** you can
hand someone the URL and walk away. The required test is Playwright: signup → wizard → first enrolled till
(browser-mode till-ui).

**What already exists (Day 7 and later):**

- Signup → verify email → completion (`packages/auth/src/onboarding/*`, `flows/*`, `workflows/auth.ts`).
  Completion provisions an org (`packages/core/src/provisioning.ts`). It creates **no store or branch**,
  starts VAT-registered and is `priceMode: inclusive`. The registration id is the reserved `org_id`.
- Store/branch CRUD, tax settings (TIN, registered from, price mode), catalogue CSV import (`catalogue/import`,
  assets presigned upload), invitations, device enrolment codes (`components/devices/enrol/form.tsx`).
- KYC workflow (`packages/auth/src/workflows/kyc.ts` + `adapters/{cf,box}/src/workflows/kyc.ts`). It is the
  pattern KYB copies: the case row is the record, and events only wake the workflow.
- Paystack client (`core/payments/paystack/client.ts`): charge, OTP, refunds, settlements, checkout.

**The gaps:**

1. There is no tenant onboarding workflow and no `first_sale` signal.
2. There is no KYB, no Paystack subaccount and no Shopper platform-staff concept.
3. There is no wizard. A new owner lands on an empty `/products` page.
4. **A till cannot enrol itself.** The host needs a hand-written `register.json` with `identity` and
   `deviceToken`. The till UI has no enrol screen.
5. Empty states are uneven, and performance has never been measured.

**Your decisions (28 Oct):**

- **KYB reviewers:** a new **platform admin app**, `apps/admin`, built on TanStack Start in SPA mode like
  the portal, for Shopper staff.
- **Subaccount:** after approval, till MoMo charges for that org carry its Paystack subaccount.
- **Performance:** measure and report in `verification.md`, and fix what is over budget. No CI gates.
- **Wizard:** owners are redirected to `/setup` until every step is done or skipped. A "Finish setup"
  checklist stays in the shell until the first sale.

**How I work:**

- One session on Opus at medium effort, with **no subagents**. That overrides CLAUDE.md's
  `planner`/`reviewer` agent steps; I run their skills inline.
- Skills:
  - `tdd-slice`
  - `cloud-box-parity`, plus `workers-best-practices` for the new workflows and the admin Worker
  - `ui-screen`
  - `ui-verify` (playwright-cli at 1920, 1440, 1366, 768 and 390)
  - `skeleton-audit` for the new screens
  - `pre-merge-review`
- MCPs:
  - Figma, for design context per screen
  - context7, for TanStack Start SPA mode and Paystack subaccount docs
  - Cloudflare docs, for workflow bindings and the admin Worker
  - Notion, for the closing remarks
- Codex reviews each slice and the whole branch:
  `codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`.
- Tests come first and must be meaningful. I break each fix once on purpose to watch its test fail.
- Git: branch `day25-onboarding` from `main@20283dc`, one commit per slice, one push at the end, then a PR.
  I watch CI to green with the ccd_pr tools (fixing and re-pushing on failure), then merge. No AI attribution.
- Data is disposable. Migration 0033 is additive with no backfill, and I reset dev, e2e and CI databases freely.

## Figma

- `173:3087` "New Login": the centred "Shopper App" card and its seven states. The **till enrol screen**
  copies it, with idle, invalid code, expired, offline, enrolling and success states.
- `12:66` Components: stepper/tabs, field, badge and empty components for the wizard and KYB forms.
- `227:4900` Web Flow: responsive tabs and section headers for the wizard's step rail and the admin queue.
- `27:2031` Dashboard and `45:852` shell/table: the admin app shell, tenant table and KYB queue table.
- `173:3087` also has empty-state frames (Inventory empty, Sales Reports empty). Every new empty state follows them.
- No frame exists for the wizard, KYB or admin screens. They are composed from the frames above, and the
  remarks will say so.

## Schema: migration `0033_onboarding.sql` (additive, replayable)

- `onboarding`:
  - Keys: `org_id` PK/FK, `registration_id`.
  - `status` is one of `verifying`, `setup`, `trading` or `abandoned`.
  - Timestamps: `email_verified_at`, `provisioned_at`, `catalogue_at`, `wizard_done_at`, `wizard_skipped_at`
    and `first_sale_at`.
  - `nudges` (int).
  - The registration side lives in the pre-shop registration storage until provisioning, following Day 7's
    trusted-scope rule.
- `kyb_case`:
  - Keys: `id` UUIDv7, `org_id`.
  - `status` is one of `draft`, `submitted`, `checks_failed`, `in_review`, `approved`, `rejected` or `expired`.
  - Business details: `business_name`, `registration_number`, `tin`.
  - Settlement details: `settlement_type` (`bank` or `momo`), `settlement_bank_code`, `settlement_account`.
  - Results: `checks` (jsonb, one result per check), `reviewer_user_id`, `decision_note` and `decided_at`.
  - Expiry and payout: `expires_at` (the earliest document expiry) and `paystack_subaccount_code`.
  - `version`.
- `kyb_director`: `id`, `org_id`, `case_id`, `name`, `ghana_card_number`, `card_expires_on` and
  `card_asset_id` (an asset ref).
- `kyb_document`: `id`, `org_id`, `case_id`, `kind` (`registration_certificate` or `tin_certificate`),
  `asset_id` and `expires_on`.
- New permissions:
  - `org.kyb.submit` for owners and admins.
  - `platform.tenant.read` and `platform.kyb.review`, granted only to the platform org's roles.
- Platform org: config `SHOPPER_PLATFORM_ORG` (an org code; `shopper` in dev and e2e). Seed and tooling create
  it with an owner, through the existing bootstrap path. Its members sign in to `apps/admin` with the existing
  Better Auth session.

## Slices (tests first, one commit each)

### S1 · Tenant onboarding workflow and `first_sale`

**Tests:**

- `tests/integration/onboarding/workflow.test.ts`, run with both launchers:
  - Signup starts `onboarding-<orgId>`.
  - Reminder emails go out at +2 h and +12 h while unverified, through the existing resend action. Fake time
    and the captured Maileroo prove this.
  - Expiry at 24 h ends as `abandoned`.
  - Verify → `email_verified`. Completion → `provisioned`, so status becomes `setup`.
  - A catalogue import applied, or the step skipped → `catalogue`. The KYB case then opens as `draft`, and the
    owner gets one email.
  - `first_sale` nudges are emailed at +1 d, +3 d and +7 d, at most three.
  - The first accepted sale → `trading`. A second sale sends no event.
  - Replaying any step writes nothing twice: audit rows and `workflow_run` stay one per step.
- `tests/integration/sync/first.test.ts`: two concurrent first sales from two tills produce one
  `first_sale_at`, and the event is sent after commit only. A rolled-back accept sends nothing.
- `packages/conformance`: the onboarding launcher handles start, send, timeout and replay against both adapters.

**Code:**

- `packages/core/src/onboarding/{commands,queries,records}.ts`
- `packages/core/src/workflows/onboarding.ts` (the shared `runOnboarding`)
- Thin shells in `adapters/cf/src/workflows/onboarding.ts` and `adapters/box/src/workflows/onboarding.ts`
- The `ONBOARDING_FLOWS` binding and its export in `apps/edge`
- Events are sent after commit by verify, completion, import apply and the sale accept. The sale accept checks
  `first_sale_at IS NULL` under the onboarding row lock.
- The box starts the workflow at its fixed-org owner setup, with the email and KYB steps skipped. KYB is cloud
  control plane.

### S2 · KYB case, checks, review and Paystack subaccount

**Tests:**

- `tests/integration/kyb/case.test.ts`:
  - The owner saves a draft and submits it, with directors' Ghana Card numbers, a TIN, a registration number,
    documents (asset refs) and the settlement account.
  - Submitting needs `org.kyb.submit`. The tenant is isolated.
  - Each write produces an audit row.
- `tests/integration/kyb/checks.test.ts`, the automated checks:
  - The TIN matches the GRA format (`[PCGQV]\d{10}`).
  - Each Ghana Card matches `GHA-\d{9}-\d` and is unexpired.
  - There is at least one director.
  - Every document asset resolves in the tenant, with its digest verified through `@shopper/assets`.
  - No document has expired.
  - The settlement bank code is in Paystack's GHS bank list, which a fake supplies.
  - A failing check → `checks_failed`, the reasons are listed, and the owner can fix and resubmit.
- `tests/integration/kyb/workflow.test.ts`, run with both launchers:
  - Submit → checks → `waitFor reviewer_decision`.
  - Approve → a subaccount is created **once**, even across step retries and replays, because the stored code
    short-circuits. The Paystack fake sees exactly one `POST /subaccount`.
  - Reject → the note is kept, and the owner is emailed.
  - `sleepUntil` 30 days before the earliest expiry sends a renewal email. At expiry the case becomes `expired`.
    The subaccount stays, the admin app flags it, and the owner is emailed to renew.
- `tests/integration/payments/subaccount.test.ts`: a till MoMo charge for an org with an approved case sends
  `subaccount`; without one it sends none. Already-started charges keep the shape they began with.

**Code:**

- `packages/core/src/kyb/{commands,checks,queries,records}.ts`
- `packages/core/src/workflows/kyb.ts`
- `paystack/subaccounts.ts`: `banks()` and `createSubaccount()`, with Valibot schemas in `paystack/schemas/`
- `KYB_FLOWS` cf shell. On the box, KYB routes answer 404.
- Owner API: `/kyb` (get, save, submit) in `@shopper/api`.

### S3 · Platform admin app (`apps/admin` + `@shopper/platform`)

**Tests:**

- `tests/integration/platform/access.test.ts`:
  - `/platform/*` refuses sessions from any org other than `SHOPPER_PLATFORM_ORG`, and from platform members
    without the permission.
  - Tenant users can never reach another tenant's KYB except through this path.
  - A decision is audited in the **tenant's** chain with the reviewer's id, and in the platform org's chain.
- `tests/integration/platform/kyb.test.ts`: the queue filters by status. A case can be decided only once, so
  concurrent approve/reject gives one winner and a 409. Deciding sends `reviewer_decision`.

**Code:**

- `packages/api/src/routes/platform.ts`, with these endpoints:
  - tenants list: org, onboarding status, KYB status, first sale
  - KYB queue
  - case detail with presigned read grants for the documents
  - decide
- `packages/platform/src/{screens,components,queries,routes,schemas}/…`, which follows the backoffice layout:
  - `screens/auth/login`, `screens/tenants/list` and `screens/kyb/{queue,review}`
- `apps/admin`: a copy of the portal's shape. TanStack Start SPA, prerendered shell, Workers Static Assets,
  one Worker for `/api/*`, `cloudflare.config.ts` with staging, `README.md`. It is wiring only, and it is cloud
  only, not mounted on the box.
- Dev and e2e: `vp run dev` serves admin on :5187. The e2e harness gets an `admin` Playwright project.

### S4 · Setup wizard in the back office

**Tests (e2e, written first):**

- `tests/e2e/portal/setup/*.spec.ts`:
  - Redirect to `/setup` until each step is done or skipped.
  - The steps in order: Shop → Store → Branch → Tax (TIN, VAT registered from, price mode) → Products (CSV
    import, add one, or skip) → Team (invite) → Till (download installer, issue code + QR) → Done.
  - Progress survives a reload, because it is derived from data.
  - Back and next work by keyboard. Each step is reachable with Alt+1…8, and Mod+Enter submits.
  - Members without permission see a read-only view.
  - Offline is shown. There are no serious axe findings.
- `tests/integration/onboarding/progress.test.ts`: `GET /onboarding` derives every step from real rows
  (stores, branches, tax settings, product count, invitations, devices), and the result is tenant-isolated.

**Code:**

- `packages/backoffice/src/{routes/setup.tsx, screens/setup/screen.tsx, components/setup/<step>/…,
  queries/onboarding/…}`
- The steps reuse the existing store, branch, tax, import, invitation and enrol forms. No duplicated forms.
- Shell `beforeLoad` redirects. The "Finish setup" checklist goes in the shell top bar.
- Installer download: build-time `SHOPPER_TILL_DOWNLOAD_URL`, with the version from `SHOPPER_VERSION`. When it
  is unset, the step says "Installer coming soon" and still issues the code. Day 27 builds the signed installer.
- QR: `qrcode-generator` is already a workspace dependency (`packages/hardware`). It is added to backoffice at
  the same version, so there is no new library.

### S5 · Till enrols itself by code or QR

**Tests:**

- `tests/integration/till/host/enrol.test.ts`:
  - A host started with only `{ upstream, sqlitePath, origins, port }` reports `unenrolled`.
  - The bridge `device.enrol { shopCode, code, name }` enrols through `/orgs/:code` and `/devices/enroll`. It
    writes `identity`, `deviceToken` and `receiptCodes` atomically into the config, then boots normally.
  - A bad, expired or reused code maps to its own error code, and nothing is written.
  - A restart mid-enrol either is still unenrolled or is fully enrolled.
- `tests/e2e/till/ui/enrol/*.spec.ts`:
  - The enrol screen and every state.
  - A scanned QR payload `shopper:enrol?api=…&shop=…&code=…` (keyboard-wedge input) fills the screen and
    submits it.
  - The enrolled till moves on to sign-in.

**Code:** host config schema `core/schemas/till/config.ts` (identity becomes optional when unenrolled),
`apps/till/host` enrol op, `apps/till/ui/src/screens/enrol/screen.tsx`, and Electron `secrets.ts` sealing the
newly written token through the same path.

### S6 · Empty states and inline help

- Audit every screen the wizard lands on:
  - stores, branches, products, imports, users/invitations, devices, tax, dashboard/reports
  - the till's first boot
- Each gets an `Empty` from `@shopper/ui/components/empty`, with one action back into the matching wizard
  step and a one-line help text. Wizard fields get `FieldDescription` help.
- e2e: `tests/e2e/portal/setup/empty.spec.ts` visits each screen on a fresh org and asserts the empty state
  and its action. `skeleton-audit` runs for the new screens.

### S7 · Performance pass (measure, fix, report)

- `tooling/database/year.ts` seeds one org, 2 branches, 3,000 products and 365 days × 400 sales with lines,
  tenders and stock movements.
- `tooling/perf/*.ts` measures each budget:
  - Till cold boot: host spawn → ready → UI first render, through playwright.
  - Scan-to-line: `performance.mark` around scan → line in the browser till.
  - Receipt render: in the hardware render.
  - Reports: dashboard, sales, products, stock and journal endpoints, p50 and p95 over a year of data.
- Fix what is over budget: likely missing indexes or rollups for reports, and lazy imports for cold boot.
  Each fix gets a measured before and after.
- `docs/plans/day25/verification.md` records the numbers and notes that this machine runs about 7–8× slower
  than CI.

### S8 · The milestone e2e and wrap-up

- `tests/e2e/portal/onboarding/first.spec.ts` (public project, plus till-ui):
  1. Signup → emailed link → complete.
  2. Wizard through every step, with a real CSV import and a code + QR.
  3. A browser-mode till-ui enrols with that code.
  4. Cashier sign-in → one cash sale.
  5. Onboarding shows `trading`.
- `tests/e2e/admin/kyb.spec.ts`: an owner submits KYB with uploads → a platform reviewer approves in the admin
  app → the case shows the subaccount through the fake Paystack. A rejected case shows the owner the note.
- Docs:
  - `docs/engineering/platforms.md`: the onboarding and KYB workflows.
  - `architecture.md`: the platform org and the admin app.
  - `deployment.md`: the admin Worker, `SHOPPER_PLATFORM_ORG` and `SHOPPER_TILL_DOWNLOAD_URL`.
  - The READMEs for the till host, the till UI and the admin app.
  - `docs/plans/day25/{plan,verification}.md` and screenshots.

## Critical files

- `packages/auth/src/workflows/kyc.ts` and `adapters/{cf,box}/src/workflows/kyc.ts`: the workflow and shell
  pattern.
- `packages/auth/src/onboarding/*` and `flows/*`: where verify and completion emit events.
- `packages/core/src/provisioning.ts`: completion.
- `packages/core/src/payments/paystack/client.ts`: subaccount, and the charge `subaccount` field.
- `packages/core/src/catalogue/import/apply.ts`: the catalogue event.
- `packages/sync/src/push/*`: the first-sale event after commit.
- `packages/backoffice/src/routes/create.tsx`: the setup route and the shell redirect.
- `components/devices/enrol/form.tsx`: QR.
- `apps/till/host/src/server.ts`, `core/schemas/till/config.ts` and `apps/till/electron/src/secrets.ts`:
  unenrolled mode.
- `apps/portal/*`: the template for `apps/admin`.
- `apps/edge/cloudflare.config.ts` and `apps/edge/src/index.ts`: new workflow bindings.
- `playwright.config.ts` and `playwright.public.config.ts`: admin and setup projects.

## Verification

- Each slice: run `vp check`, `vp run guard`, the slice's integration tests with `vp test --run` (PG18 and both
  adapters), and the relevant Playwright projects. Then a Codex review, fixes, and a commit.
- `ui-verify` with playwright-cli for each of these, at 1920, 1440, 1366, 768 and 390, plus the till sizes:
  - the wizard
  - the empty states
  - the enrol screen
  - the KYB owner form
  - the admin queue and review
- I check every state, the keyboard path, the console and overflow, and save screenshots to
  `docs/plans/day25/screenshots`.
- At the end:
  - The full `vp test --run` and the e2e suites.
  - `vp run build`, including the admin build for staging. Nothing is deployed.
  - A Codex review of the whole branch.
  - Push, then a PR.
  - Watch CI and fix until it is green, then merge.
- Notion: set the Day 25 row to Done, tick the checklist and add **Remarks** in Day 24's format:
  - the PR, what landed, your decisions, defects found, review fixes, upgrade notes, known limits
  - the performance numbers
- The remarks will name what this day cannot prove:
  - A real Paystack subaccount and real Ghana Card verification. There is no NIA/ORC API, so the checks are
    format, expiry and document checks.
  - The signed installer, which is Day 27.
  - Real scanner QR reading on Windows hardware.
