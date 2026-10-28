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
