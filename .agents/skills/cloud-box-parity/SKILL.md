---
name: cloud-box-parity
description: Add or change anything that runs on both Cloudflare and Rivet in Shopper - ports, adapters, Durable Objects/actors, Workflows, Queues, cron, realtime, blobs. Use whenever code touches packages/ports, packages/adapters/*, packages/conformance, apps/edge or apps/box.
---

# Cloud ⇄ box parity

1. Read `docs/engineering/platforms.md` and `architecture.md`. Check current platform docs
   (Cloudflare docs MCP or the `cloudflare`/`durable-objects`/`workers-best-practices` skills, and
   `https://rivet.dev/llms.txt` or context7 for Rivet). Never rely on memory for platform APIs.
2. Use a portable library if one covers it (Hono, Drizzle, unstorage, Better Auth). Use a port only
   for what no library covers.
3. Write the conformance cases first in `packages/conformance`, and run them against both adapters:
   `tests/integration/ports` (box) and `tooling/worker/tests` (Cloudflare).
4. Put the behaviour in one shared function in a domain package. Write the Cloudflare shell
   (`adapters/cf`) and the Rivet shell (`adapters/box`) as thin callers, about 20 lines each.
5. Check the rules: PostgreSQL is the record (table + audit + `workflow_run` in one transaction), no
   platform IDs in business tables, instance id = business key, five coordination classes only, no
   polling and no business crons.
6. Both suites green. Then run `pre-merge-review`.

## Architecture cleanup rules

Follow current `layout.md` and `code-quality.md`: no hyphens in authored paths (explicit stable/framework/generated/published exceptions); backoffice screens/components/queries/stores/hooks have separate homes nested by context; schemas and exported reusable types have owning modules; workflow modules each implement one responsibility. Reuse `@shopper/utils` SHA-256 without changing domain hash contracts. Assets use `@shopper/assets` for policy/tracking/grants and Blobs for provider transport; browser bytes upload directly to R2/RustFS and are bounded/verified immediately before processing. Never add an API byte-upload fallback. Verify both storage adapters and preserve public routes/subpaths.
