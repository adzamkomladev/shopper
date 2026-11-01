# Production rollback

Migrations are forward-only and expand-compatible, so code rolls back on its own; data does not.

## A bad release (errors, a failing smoke test or `/health/ready`)

1. Roll the Worker back to the previous deployment, edge last if the portal or admin is the problem and
   edge first otherwise:
   `vp exec wrangler rollback --name shopper-<app>-production` (or pick the version in the dashboard).
2. Check `https://shopper-api.temtem.dev/health/ready` and the two shells; the uptime run goes green.
3. A Worker rollback leaves Neon and D1 as they are. That is safe: the previous build reads the expanded
   schema. Never write a down-migration.

## Bad data (a wrong import, a mass edit)

1. Stop writes that would make it worse: tell the shop to keep selling offline only if the register is
   affected (it queues sales).
2. In Neon, branch production at a timestamp before the damage. Verify that branch:
   `vp exec tsx tooling/backup/verify.ts <branch-direct-url>`.
3. Copy the affected rows back from the branch, or, if the damage is wide, restore the production branch to
   that timestamp in the Neon console. Registers resend anything they sold after it.
4. Note what happened, the timestamp used and the rows touched in the pilot log.

## Who decides

The Shopper lead on call. A rollback of code needs no approval; a data restore needs the shop owner told
first.
