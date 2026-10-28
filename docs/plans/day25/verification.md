# Day 25 verification

## S1 · Tenant onboarding workflow and `first_sale`

### What changed from the plan

- `onboarding` stores only the shop's part: `setup` or `trading`. Before the shop exists, the registration
  request is the record (trusted pre-shop scope), so `verifying` and `abandoned` are not stored on the row. They
  appear as the `onboarding.registration.*` commands in the registration chain.
- The box starts no onboarding: it has no public signup. `boxOnboardingFlows` carries the shared function for
  parity and the Rivet engine.
- The KYB draft opening on `catalogue` moved to S2, where `kyb_case` exists.

### Tests

- `tests/integration/onboarding/workflow.test.ts`: reminders at +2 h and +12 h, abandon at expiry, nudges at
  +1, +3 and +7 days (never more than three), one `first_sale` under concurrency, and a rolled-back sale
  marks nothing.
- `tests/integration/onboarding/marks.test.ts`: the real sale push and the product API stamp `first_sale`
  and `catalogue` once each, with one event each.
- `tests/integration/onboarding/replay.test.ts`: a run replayed 25 days later from cached steps is not
  abandoned, and a launch that fails at signup is retried when the owner verifies.

### Defects found

- Catalogue commands had no queue in the API, so their after-commit events were dropped (`routes/catalogue.ts`).

### Review fixes (Codex `gpt-6.1-sol`)

- P1: workflow branches used the live clock against cached step state. On a Cloudflare replay after hibernation
  that could abandon a provisioned shop. Each state step now records the time it read the row, and every branch
  uses that time. The replay test fails on the old code.
- P2: a failed onboarding launch at signup failed the signup with no way back. The launch is now logged and
  retried, idempotently, at verify and at completion.
- P2: a shop that is not VAT-registered counted as having tax setup unfinished. No VAT registration date now
  counts as configured.
- P2: nudges link to `/setup`, which S4 adds in the same PR.

## S2 · KYB case, checks, review and Paystack subaccount

### What changed from the plan

- One `kyb_case` per shop. Directors and documents are a jsonb snapshot on the case, not their own tables: a
  reviewer decides a submission as a whole, and `version` counts submissions so checks and decisions apply only
  to the one they were made for.
- KYB documents and Ghana Card scans are `kyb_document` assets in the durable private receipts store, under a
  `receipts/kyb/` key, so neither adapter needed a new bucket. Uploads go browser → object storage through a
  presigned grant, and the workflow re-reads the bytes, bounded at 5 MB, and checks size and digest right before
  the checks rely on them.
- The reviewer is a platform-org user, so the shop's chain names them in the `kyb.decide` payload and in
  `kyb_case.reviewer_id`. The tenant audit actor must be a tenant user. S3 writes the platform-chain row with the
  reviewer as actor.
- Settlement type is not a column. Paystack's GHS bank list carries both banks and mobile money providers, so
  one code covers both.
- The KYB draft does not open when the catalogue mark lands. The setup wizard's last step and Settings →
  Verification lead to it, and cash sales never need it.
- The box mounts no `/kyb` routes (404) and starts no KYB workflow.

### Tests

- `tests/integration/kyb/case.test.ts`: a draft in parts; an incomplete submit names what is missing;
  `org.kyb.submit` is enforced for cashier, accountant and inventory; audit rows; locked while held; tenant
  isolation; no routes on the box.
- `tests/integration/kyb/workflow.test.ts`: every failing check listed at once (TIN, Ghana Card format, card
  expiry, unknown settlement bank, a missing document, a tampered upload); the run is closed in `workflow_run`;
  fix and resubmit → in review; a rejection keeps its note and emails the owners; a stale decision is refused;
  one subaccount across a redelivered notice and a fresh launcher (restart); the payout account is locked once
  provisioned.
- `tests/integration/kyb/renewal.test.ts`: a renewal email 30 days before the earliest expiry, then expired
  and emailed, with the subaccount kept (fake clock).
- `tests/integration/payments/subaccount.test.ts`: till MoMo charges name the subaccount after approval, and
  still do once it lapses; without it they name none.

### Defects found

- S1 never added `OnboardingWorkflow` to the edge Worker's `exports.workflow` list, so the binding pointed at an
  undeclared class. Fixed together with `KybWorkflow`.
- A workflow that captured `Date.now` when it started kept the clock of its first tick across weeks of waiting
  under a faked clock. KYB reads the clock at each tick.

### Review fixes (Codex `gpt-6.1-sol`)

- P2: an approved shop could change its settlement account while payouts kept going to the old subaccount.
  Once a subaccount exists the bank and account are locked (409), and other details may still change.
- P2: runs that ended (checks failed, rejected, nothing left to wait for) left `workflow_run` waiting. A
  `kyb.close` step now records them completed.
- P2, declined for now: if Paystack creates the subaccount and the database write after it fails, a retry
  makes a second one. That needs a write failure in the moment after a provider success. The fix reconciles
  against Paystack's subaccount list before creating, which is more code. Per AGENTS.md this waits for the
  owner's buy-in, so it is listed as a known limit.
- Break-on-purpose: dropping both subaccount guards made the restart test see two subaccounts, and dropping
  the close step failed the run-status assertion.

## S3 · Platform admin app (`apps/admin` + `@shopper/platform`)

### What changed from the plan

- Staff are members of the platform org (`SHOPPER_PLATFORM_ORG`, `shopper` in dev, e2e and staging) and sign in
  with the ordinary Better Auth session. `platform.kyb.review` and `platform.tenant.read` exist only as rows in that
  org (`seedPlatformRoles`), and `/platform/*` also checks the session's org, so a shop owner granting themselves
  the codes is refused.
- The screens reuse the back office's sign-in form, states, fields and helpers through a new
  `@shopper/backoffice/kit` subpath. The admin app imports no back-office routes.
- `apps/admin` has no `/_serverFn` host functions. Its Worker runs only for `/api/*`, with the portal's bindings
  plus `SHOPPER_PLATFORM_ORG`.
- The e2e host (`tests/support/portal/server.ts`) serves either app: `SHOPPER_PLATFORM_ORG` turns on the admin
  build and the platform routes. Playwright has an `admin` project on :5187, and S8 adds its specs.
- Scan links are presigned object-storage GETs, through a new `Blobs.createDownload` (the download twin of
  `createUpload`), so the browser reads the scan straight from R2/RustFS and the API proxies nothing.

### Tests

- `tests/integration/platform/access.test.ts`: other orgs, platform members without the permission, and a tenant
  that grants itself a platform code are all refused.
- `tests/integration/platform/kyb.test.ts`:
  - the queue lists cases by status, and following each scan link returns the uploaded bytes;
  - two concurrent decisions produce one winner and a 409, and both chains are audited;
  - the tenants list leaves out the platform org;
  - a scan that is no longer tracked shows no link, and the case still opens.
- `tests/integration/platform/runtime.test.ts`: through `serveRuntime`, the platform org lookup answers without a
  session or shop, `/platform/*` sits behind the staff session, and `/kyb` sits behind the shop session.
- `packages/conformance` `receiptUploadConformance`: a download grant reads only that object, only by GET, and
  only for its own org.

### Defects found

- `serveRuntime` routes only listed paths to the tenant API, and `kyb` and `platform` were not listed. The KYB
  owner routes from S2 and every platform route answered 404 on the Worker and the box runtime; the integration
  tests called `createApi` directly and missed it. The new runtime test fails on the old list.
- KYB scan links were app-signed blob URLs that no host serves, so they opened the SPA shell.
- Running the portal and admin e2e hosts together would have collided on the Arkesel fake's port. The admin host
  takes 3105.

### Review fixes (Codex `gpt-6.1-sol`)

- P1: scan links did not retrieve documents. Fixed with presigned GET grants (above). Break-on-purpose: presigning
  the download as PUT failed both the conformance case and the platform test.
- P2, declined for now: the shop's `kyb.decide` and the platform's `platform.kyb.decide` are separate commands, one
  per org chain. If the second fails after the first commits, the platform row is missing and a retry gets a 409.
  That needs a database failure between two consecutive writes. Making it atomic means running two org chains in
  one transaction and sending the notice after that outer commit, which is an audit-layer change. Per AGENTS.md it
  waits for the owner's buy-in, so it is listed as a known limit.
- P2, declined for now: the tenants list and each queue tab return at most 500 rows. That is ample at pilot scale,
  and cursor pagination comes once there are more than 500 shops.

### UI verification (playwright-cli, e2e host on :5187)

- Login, queue (in review, checks failed, an empty tab), review (failed checks; in review with approve and reject),
  the shops list, and sign-out, at 1920, 1440, 768 and 390. No horizontal overflow at any width.
- Keyboard: V and S switch pages. On a case, A or R opens the decision with the note focused, and Mod+Enter
  submits. An empty rejection note is refused, focused and announced. An approval lands on the Approved tab with a
  toast, and both audit rows are written.
- Remaining: the favicon 404 and React hydration error #418 on the prerendered shell are shared with the portal
  (the portal's own e2e build shows both). There is no Figma frame for these screens; they are composed from the KYC
  queue and review frames.

## S4 · Setup wizard and the owner's business verification

### What changed from the plan

- `/setup` has seven steps: Store, Branch, Tax, Products, Team, Till and Done. Signup has already created the
  shop, so the wizard has no Shop step. Each step is derived from rows through `GET /setup`, and Alt+1…7 opens a
  step.
- The steps reuse the back office's own forms. These are the store, branch and invite sheets, the setup-link
  dialog, the tax settings form (which gained `onSaved`) and the enrol sheet.
- The enrol code view now shows a QR (`shopper:enrol?api=…&shop=…&code=…`). It is drawn from
  `@shopper/hardware/qr`, a new subpath over the receipt QR matrix, so no second QR library was added.
- The Till step is done only once a till actually enrols, not when a code is made.
- An owner who leaves with "Finish later" gets a "Shop setup" banner in the shell until the first sale. Sign-in,
  invitation acceptance and registration all land on `/`, which sends an owner with setup to do to `/setup`.
- The owner's KYB form is the Verification tab under Payments (`/payments/verification`). Scans upload straight to
  storage through `POST /kyb/documents` grants. Saving a draft keeps only the parts that are filled in.
  Submitting locks the form until Shopper decides. On the box, where `/kyb` answers 404, the tab explains that
  verification happens in the cloud portal.
- `SHOPPER_TILL_DOWNLOAD_URL` is a build-time constant. While it is unset, the Till step says "Installer coming
  soon" and still issues codes.

### Tests

- `tests/integration/onboarding/progress.test.ts`: 7 tests on progress derived from rows, skip, finish, dismiss,
  permissions, tenant isolation and the runtime route.
- `tests/e2e/portal/setup/wizard.spec.ts`:
  - Signup, then every step by keyboard, a reload that keeps the step, a code with its QR, and Finish. After
    Finish, `/` leads to Products.
  - "Finish later", the banner, and back to the wizard.
- `tests/e2e/portal/setup/verification.spec.ts`: an empty submit focuses the first field. A whole case, with three
  uploads through the file chooser, is submitted by Mod+Enter, is locked, and survives a reload.
- The public Playwright project now also matches `setup/*.spec.ts`. The older onboarding milestone now expects
  signup to land in the wizard.
- The devices, login and payments portal specs still pass (36 of 36).

### Defects found

- The router's `Link` forces `aria-current="page"` on an active link, so the rail uses plain anchors that navigate
  through the router and carry `aria-current="step"`.
- The rail's "Done" and "To do" text sat inside each link and became part of its accessible name. It is now
  referenced by `aria-describedby` only.
- The upload button disabled itself while uploading. That dropped focus to the body, so Mod+Enter stopped
  submitting. It now uses `aria-disabled` while busy.
- The e2e host had no receipts store, so every KYB scan upload failed with "Direct uploads are unavailable". It
  had no KYB bank list either. The host now has both.
- On a phone, the visually hidden file inputs widened the page. They are now `hidden`.

### Review fixes (Codex `gpt-6.1-sol`)

- P1: saving and then submitting a KYB case read the selected shop twice. A shop switch between the two requests
  could submit, or cache, the other shop's case. The shop is now read once per save and once per upload.
- P2: the wizard's loader fetched roles, branches and tax settings for anyone holding `store.write`. A custom role
  without one of those reads would get a 403 that failed the whole wizard. Each query now loads only for a member
  who can read it. Each step names every permission its form needs, and a member missing one sees the step's
  status without the form.
- P2: a failed bank list left the payout select saying "Loading banks…". The page now says the list failed and
  offers Try again. The verification spec forces the failure and recovers from it.
- P2, kept: the enrol QR has no reader on the till yet. That reader is S5 in this same PR, so the QR ships with it.

### UI verification (playwright-cli, e2e host on :5183)

- The wizard's Store, Tax, Products, Team, Till and Done steps, the shell banner, and the verification form (in
  its verified state), at 1920, 1440, 1366, 768 and 390. After the fixes there is no horizontal overflow.
- Fixed during the pass:
  - The step panel stretched to the rail's height.
  - The till steps lost their numbers.
  - The tax form ran the full panel width.
  - The KYB alert titles were truncated on a phone.
- Remaining:
  - React #418 on the prerendered shell, shared with the portal.
  - On a phone, the Products empty state's two buttons spill past its box. This predates S4 and belongs to S6's
    empty-states pass.
  - There are no Figma frames for the wizard or the KYB form. They are composed from the stepper, field and
    empty-state components.

## S5 · A till enrols itself by code or QR

### What changed from the plan

- The QR holds `shopper:enrol?shop=…&code=…`, without the API origin. The portal's origin is not the till's
  API origin, and the till already knows its server from its install config.
- The enrolment host is its own small bridge (`startEnrolmentHost`): it answers `hello`/`status` with
  `kind: "unenrolled"` and only `device.enrol`. On success it closes, and the full host takes the same port and
  capability, so the page that enrolled reconnects without a new link.
- Under Electron the host never writes the register file. It sends `{ type: "enrolled", registration }`, and
  Electron stores it atomically, seals the token with the existing `loadSecrets` path, scrubs it from
  `register.json` and starts the host again without opening a second window.
- `/devices/enroll` now also returns `storeId` and `branchName`, which the identity needs.

### Tests

- `tests/integration/till/host/enrol.test.ts` (3): over IPC, unenrolled status, `SHOP_NOT_FOUND`,
  `ENROL_REFUSED` for a wrong and for a reused code, a good code, the parent's `enrolled` message and the second
  ready on the same port and capability; `OFFLINE` against an unreachable server; and, run from a file, the
  registration written into it and the host booted.
- `tests/integration/till/electron/enrol.test.ts`: a real Electron register with an unenrolled `register.json`
  and a page that enrols through the bridge. The registration is stored, the token sealed and scrubbed, and the
  host answers again on the same port.
- `tests/e2e/till/ui/enrol/screen.spec.ts` (2), browser-mode till UI against a real host: missing fields, unknown
  shop, wrong code (cleared and refocused), locked, server down, success and the move on to sign-in; and a QR
  typed by a keyboard-wedge scanner into the code field fills the form and submits it, with no overflow at 390.
- Broken on purpose: an identity with the wrong register name fails two host tests; dropping Electron's
  `enrolled` handler fails its test; turning off the UI's reconnect after enrolment fails the QR spec.

### Defects found

- The till test API served no `/orgs/:slug` (the runtime adds it beside `createApi`), and the test org had no
  shop code. The test server now routes `/orgs/` the way the runtime does, and the org has a slug.
- The bridge proxy used by till-ui specs recorded a refused upstream connect as a test failure. During the host's
  restart after enrolment that refusal is what a browser sees, so it now just closes the browser socket.

### Review fixes (Codex `gpt-6.1-sol`)

- P2: the code field's `maxLength={6}` cut a QR scan typed into it to `shoppe`, and a refusal puts focus there.
  The limit is gone (the schema still requires six digits), and the QR spec now scans into the code field.
- Found in the UI pass: the till asks for the shop code, but the portal's code sheet never showed it. It now shows
  the shop code under the code (the wizard spec checks it). The till also accepts the code typed with the space the
  portal shows (`424 242`), which the till spec now types.

### UI verification (e2e screenshots, browser-mode till UI)

- The enrol screen idle at 1920, 1366, 768 and 390, and with a refusal at 1366. It follows Figma "New Login": the
  title bar, a centred column, touch-size fields and the full-width primary button. No horizontal overflow at 390.
- States walked in the spec: idle, missing fields, unknown shop, wrong code, locked, server down, setting up,
  set up and the move on to sign-in. Keyboard only: Enter submits from any field, and focus goes to the field to fix.
- Remaining:
  - Real scanner hardware was not tried. The scan is tested as typed keystrokes into the focused field.
  - The portal code sheet's new shop-code line was checked by the wizard spec, not screenshotted.
  - Till-ui regressions on this machine (load about 6): 44 of 51 passed first time; 6 timeouts passed with a
    longer limit; `receipt status warns at 100 remaining` hit its own 240 s limit and is left to CI.

## S6 · Empty states and inline help

### What changed from the plan

- Most screens the wizard covers already had a designed empty state. S6 adds the way back: while the shop is
  being set up, the empty Stores, Branches, Products, Users (invitations) and Devices screens show
  "Back to setup" next to their own action, opening the matching wizard step (`SetupStepLink`). It reads the
  same setup status as the shell banner, so it disappears once the shop is trading.
- The till's first boot is the S5 enrol screen. The wizard's inline help is each step's description plus the
  reused forms' own field help, so no new `FieldDescription` was needed.

### Tests

- `tests/e2e/portal/setup/empty.spec.ts`: a new owner leaves the wizard, then visits each screen. For each, the
  empty heading, axe, no page overflow and no action outside its empty box at 1440 and 390, then "Back to setup"
  opens the right step.
- Broken on purpose: without the wrap, the box check fails on Products at 390. The page-level overflow check
  alone passed there, which is why the spec has both.

### Defects found

- The S4 Products overflow: empty-state button rows were `flex-row` without wrapping, so on a phone the buttons
  spilled out of the box while the page width stayed the same. Every empty-state button row now wraps (the shared
  list state, the catalogue, shift detail and transaction detail).
- The catalogue's empty title was a `div`, so screen readers got no heading. It now uses the shared `EmptyList`
  with an `h2`, like every other list.

### Review fixes (Codex `gpt-6.1-sol`)

- None found.
- Regression found by the portal suite: the catalogue's new `h2` "No products yet" also matched the auth setup's non-exact `heading "Products"` lookup. Both Products heading lookups are now exact (63 of 63 portal specs pass).

### UI verification (e2e screenshots on the public host)

- Stores, Branches, Products, Users and Devices empty at 1440 and 390. Remaining: the members table on Users
  scrolls sideways inside its frame on a phone, which predates S6.
