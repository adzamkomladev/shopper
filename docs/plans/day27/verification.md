# Day 27 · Verification

## Automated

- `vp check`: 0 errors (29 warnings, the existing baseline). `vp run guard`: clean.
- Integration: version gate (6), handshake, channel (3), updater policy (5, including Retry after a failed feed),
  installer config (5), packaged app (5, including a fresh install opening on enrolment), release feed (4), crash
  reporting (2).
- Till UI e2e (`tests/e2e/till/ui/update`, 11 tests): every state at 1920, 1440, 1366, till (1024x768), 768 and 390
  with overflow, touch-target and axe checks; Alt+U, Alt+R, Sign out; the shell banner. The shell suite still passes.
- Each fix was broken once on purpose and its test failed (S1, S2, S3, S5, S6, S7). S4's first-run break was not
  done.
- Local Windows run of the `till-windows` CI steps: NSIS build, silent install into
  `%LOCALAPPDATA%\Programs\shopper-register`, first start reached the enrol window from its host and wrote
  `register.json`, silent uninstall removed it.

## Not verified here

- `tests/e2e/admin/channel.spec.ts` did not run locally: the portal and admin e2e servers fail to prerender on this
  machine (`@tanstack/react-table` re-export, unrelated to this branch). CI runs it.
- Signing, the R2 feed and Sentry need the owner's accounts (plan.md, owner actions).
- Codex review ran on S1 and S2 only; the usage limit was reached after that (resets 4 Nov).

## Screenshots

`screenshots/update-<state>-<size>.png` for checking, downloading, ready, error and offline at every size, and
`update-banner-required.png`, `update-banner-ready.png`.
