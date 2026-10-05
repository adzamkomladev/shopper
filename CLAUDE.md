# Shopper — conventions for AI agents

Shopper is an offline-first supermarket POS for Ghana. Cloud (Cloudflare Workers) and
on-prem (sealed Bun binary + Rivet) share one codebase.

## Non-negotiable rules

- Money: integers only. 1 GHS = 10000. Use @shopper/money for ALL arithmetic. Never floats.
- Quantities: integer thousandths. Rates: integer basis points.
- IDs: UUIDv7. Never serial/autoincrement. Every table has org_id.
- Every mutation goes through defineCommand() and writes an audit row in the same transaction.
- Tax: read rules by date from the tax_rule table; snapshot tax onto every sale line.
- Never import a Cloudflare binding or a Rivet handle outside packages/adapters-*.
  Business code uses @shopper/ports, Drizzle, unstorage, Hono only.
- Validation: Valibot only (import * as v from 'valibot'). Never add Zod.
- Cache port: never read-after-write in the same request.
- Permissions are data (role_permission). Never write `if (role === ...)`.
- Tests: integration tests only. No unit tests. Use the Postgres 18 fixture and golden sale fixtures.
- Any port change must update packages/conformance and pass against BOTH adapters.
- Business processes that wait on people, partners or time = a Workflow (onboarding, KYB, KYC,
  payments, orders, reviews, approvals, billing, store day). Use sleep/sleepUntil/waitForEvent;
  instance id = the business key. Never poll, never add a cron for business logic.
- Durable Objects only for hot coordination: StoreSequencer, StoreHub, FiscalLane, StockHold,
  RateLimiter. Ask before adding a sixth. Queues only for fire-and-forget fan-out.
- PostgreSQL is the record: every workflow step and DO write also writes its table and an audit
  row in one transaction, and updates workflow_run. Reports never read engine state.
- Back office code lives in @shopper/backoffice and must run in both the web portal and Electron.
- Assets go through the Blobs port: R2 in the cloud, RustFS (S3) or fs on the box.
- Receipts: render from receipt JSON with the shared component (Satori-safe flexbox only).
  Tills render their own PDFs; never re-render a stored PDF on view.
- Migrations are forward-only and idempotent. Breaking changes use expand-then-contract.
- Every synced event carries a version `v`; bump it and add an upcaster when its shape changes.
- Never hard-code a version string; read the build-time constants (SHOPPER_VERSION etc.).

## Commands

- vp install | vp run dev | vp check | vp test | vp run build
- docker compose -f tooling/docker-compose.dev.yml up -d

## UI

- Use components from @shopper/ui (shadcn/ui, Tailwind v4). Do not add another UI library.
- Keyboard-first on the till. Every action has a shortcut.
