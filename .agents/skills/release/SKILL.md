---
name: release
description: Ship a Shopper release to staging or production (cloud Workers and/or the on-prem box), including migrations and version bumps. Use when the user asks to deploy, release, or cut a version.
---

# Release

Follow `docs/engineering/deployment.md`. Confirm with the user before every deploy command: deploys
are outward-facing.

1. Confirm CI is green on the release commit, and that the version in `package.json` is bumped. Never
   hard-code versions.
2. Review the pending migrations for expand/contract safety, idempotency and lock time.
3. Build and deploy staging (`vp -C apps/edge run build:staging`, then `deploy:staging`). Smoke-test a
   sale, till sync and the Z-report.
4. Production: gradual deployment of the Worker version. Watch Workers Logs and Traces. Note the
   rollback version.
5. Box: build the sealed binary, then smoke-test it on the staging box before any site.
6. Write plain-language release notes for owners.
