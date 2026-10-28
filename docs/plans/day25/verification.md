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
