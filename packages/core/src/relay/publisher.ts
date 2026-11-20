import { and, eq, inArray, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  asset,
  org,
  product,
  relayPublished,
  taxClass,
  workflowRun,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { BATCH_ROWS, type RelayBatch } from "../schemas/relay";
import { availabilityDue } from "./availability";
import { shareCustomers } from "./customers/box";
import { takeOrders, tellOrders } from "./inbox/box";
import { sendPhotos } from "./photos";
import { productFields, relayProjection } from "./projection";
import type { RelayPublisherDeps } from "../workflows/types";

type Kind = keyof RelayBatch;
type Row = { id: string };
type Hashed = { row: Row; hash: string };
type AvailabilityRow = RelayBatch["availability"][number];
/** Parents before children: a batch's rows land in this order, and a later kind waits for an earlier one. */
const KINDS = [
  "stores",
  "branches",
  "fulfilment",
  "categories",
  "products",
  "prices",
  "availability",
] as const;
const ENTITY = {
  stores: "store",
  branches: "branch",
  fulfilment: "fulfilment",
  categories: "category",
  products: "product",
  prices: "price",
  availability: "availability",
} as const;

/**
 * Sends the relay org whatever its copy of the online catalogue lacks: every row whose hash differs from the one the
 * relay last acknowledged (all of them the first time, a snapshot), plus a withdrawal for each product that left the
 * projection. Each acknowledged batch is recorded before the next is sent, so a crash resends at most one batch, which
 * the relay takes again without change. Paid orders are taken before and told after the publish (Day 50); then a
 * heartbeat (Day 49). A refusal (401/402/403) stops it and is kept for
 * the settings page.
 */
export async function publishPending(
  db: ShopperDatabase,
  context: CommandContext,
  relay: Pick<RelayPublisherDeps, "send" | "blobs">,
  now = new Date(),
) {
  const [shop] = await db
    .select({ onlineOrders: org.onlineOrders, relayError: org.relayError })
    .from(org)
    .where(eq(org.id, context.orgId));
  if (!shop?.onlineOrders) return { sent: 0, off: true };
  // Paid orders first (Day 50): stock the box holds for them goes up in this same run.
  const taken = await takeOrders(db, context, relay.send, now);
  if (taken && (await refusedBy(db, context, taken))) return { sent: 0, refused: taken.status };
  const pending = await pendingRows(db, context.orgId, now);
  let sent = 0;
  const offered = new Set<string>();
  for (const batch of batches(pending)) {
    const photos = (batch.products ?? []).map((entry) => (entry.row as { image?: string }).image);
    const response =
      (await sendPhotos(db, context.orgId, photos, relay.send, relay.blobs, offered)) ??
      (await relay.send("/relay/publish", { method: "POST", body: JSON.stringify(wire(batch)) }));
    if (await refusedBy(db, context, response)) return { sent, refused: response.status };
    sent += await recordPublished(db, context, hashed(batch), now);
  }
  // Nothing was pending: still clear a failure the relay has since got over.
  if (!sent && shop.relayError) await recordPublished(db, context, [], now);
  const shared = await shareCustomers(db, context, relay.send, now);
  if (shared && (await refusedBy(db, context, shared))) return { sent, refused: shared.status };
  const told = await tellOrders(db, context, relay.send);
  if (told && (await refusedBy(db, context, told))) return { sent, refused: told.status };
  // Alive only once what is due is on the relay (Day 49): a reconnecting box never reopens ordering on stale stock.
  const beat = await relay.send("/relay/heartbeat", { method: "POST", body: "{}" });
  if (await refusedBy(db, context, beat)) return { sent, refused: beat.status };
  return { sent };
}

/** A refusal (401/402/403) is kept with its reason and ends the run; any other failure throws, to be retried. */
async function refusedBy(db: ShopperDatabase, context: CommandContext, response: Response) {
  if ([401, 402, 403].includes(response.status)) {
    const reason = ((await response.json().catch(() => ({}))) as { error?: string }).error;
    await recordRelayError(db, context, { error: reason ?? `Refused (${response.status})` });
    return true;
  }
  if (!response.ok) throw new Error(`The relay answered ${response.status}`);
  return false;
}

async function pendingRows(db: ShopperDatabase, orgId: string, now: Date) {
  const projection = await db.transaction((tx) => relayProjection(tx, orgId, now), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
  const known = new Map(
    (await db.select().from(relayPublished).where(eq(relayPublished.orgId, orgId))).map((row) => [
      `${row.entity}:${row.entityId}`,
      row,
    ]),
  );
  // A product published before but no longer online goes up once more, hidden.
  const listed = new Set(projection.products.map((row) => row.id));
  const gone = [...known.keys()]
    .filter((key) => key.startsWith("product:") && !listed.has(key.slice(8)))
    .map((key) => key.slice(8));
  const withdrawn = gone.length
    ? await db
        .select(productFields)
        .from(product)
        .innerJoin(
          taxClass,
          and(eq(taxClass.orgId, product.orgId), eq(taxClass.id, product.taxClassId)),
        )
        .leftJoin(asset, and(eq(asset.orgId, product.orgId), eq(asset.id, product.imageAssetId)))
        .where(and(eq(product.orgId, orgId), inArray(product.id, gone)))
    : [];
  const rows = { ...projection, products: [...projection.products, ...withdrawn] };
  const pending = {} as Record<Kind, Hashed[]>;
  for (const kind of KINDS)
    pending[kind] = (
      await Promise.all(
        (rows[kind] as Row[]).map(async (row) => ({
          row,
          // An availability row keeps its figures as its "hash", so the next run can tell a drop from a rise.
          hash:
            kind === "availability"
              ? JSON.stringify((row as AvailabilityRow).branches)
              : await sha256(JSON.stringify(row)),
        })),
      )
    ).filter((entry) => {
      const last = known.get(`${ENTITY[kind]}:${entry.row.id}`);
      if (last?.hash === entry.hash) return false;
      // A switched-on snapshot blanks the hashes: it goes up whole, not held back.
      return (
        kind !== "availability" ||
        !last?.hash ||
        availabilityDue(entry.row as AvailabilityRow, last, now)
      );
    });
  return pending;
}

/** Up to BATCH_ROWS of each kind per batch, never a kind ahead of an earlier kind's leftovers. */
function batches(pending: Record<Kind, Hashed[]>) {
  const left = KINDS.map((kind): [Kind, Hashed[]] => [kind, [...pending[kind]]]);
  const out: Partial<Record<Kind, Hashed[]>>[] = [];
  while (left.some(([, rows]) => rows.length)) {
    const batch: Partial<Record<Kind, Hashed[]>> = {};
    for (const [kind, rows] of left) {
      if (!rows.length) continue;
      batch[kind] = rows.splice(0, BATCH_ROWS);
      if (rows.length) break;
    }
    out.push(batch);
  }
  return out;
}

const hashed = (batch: Partial<Record<Kind, Hashed[]>>) =>
  KINDS.flatMap((kind) =>
    (batch[kind] ?? []).map((entry) => ({
      entity: ENTITY[kind],
      entityId: entry.row.id,
      hash: entry.hash,
    })),
  );
const wire = (batch: Partial<Record<Kind, Hashed[]>>) =>
  Object.fromEntries(
    Object.entries(batch).map(([kind, entries]) => [kind, entries.map((entry) => entry.row)]),
  );

/** The relay acknowledged these rows; an empty list marks a run that left nothing pending. */
const recordPublished = async (
  db: ShopperDatabase,
  context: CommandContext,
  rows: ReturnType<typeof hashed>,
  now: Date,
) => (await relayPublishedCommand(db, context, { rows, now })).rows;

const relayPublishedCommand = defineCommand({
  name: "relay.published",
  async run(tx, context, input: { rows: ReturnType<typeof hashed>; now: Date }) {
    if (input.rows.length)
      await tx
        .insert(relayPublished)
        .values(input.rows.map((row) => ({ orgId: context.orgId, ...row, publishedAt: input.now })))
        .onConflictDoUpdate({
          target: [relayPublished.orgId, relayPublished.entity, relayPublished.entityId],
          set: { hash: sql`excluded.hash`, publishedAt: sql`excluded.published_at` },
        });
    await tx
      .update(org)
      .set({ relayPublishedAt: input.now, relayError: null })
      .where(eq(org.id, context.orgId));
    await mirrorRun(tx, context.orgId, "publish", "completed");
    return { rows: input.rows.length };
  },
  audit: (_input, output) => output,
});

/** Why the last publish did not go through, for the settings page; the next success clears it. */
export const recordRelayError = defineCommand({
  name: "relay.failed",
  async run(tx, context, input: { error: string; retrying?: boolean }) {
    const error = input.error.slice(0, 500);
    await tx.update(org).set({ relayError: error }).where(eq(org.id, context.orgId));
    // A refusal ends the run; an unreachable relay waits to try again.
    await mirrorRun(tx, context.orgId, "publish", input.retrying ? "waiting" : "failed");
    return { error };
  },
  audit: (_input, output) => output,
});

/**
 * The Publisher's state in `workflow_run`, the record. Not a step checkpoint: a loop reuses its step names every
 * run, so a saved step would replay an old answer instead of publishing.
 */
const mirrorRun = (
  tx: Pick<ShopperDatabase, "insert">,
  orgId: string,
  step: string,
  status: "completed" | "waiting" | "failed",
) =>
  tx
    .insert(workflowRun)
    .values({
      orgId,
      instanceId: orgId,
      businessKey: orgId,
      type: "relay-publisher",
      currentStep: step,
      status,
    })
    .onConflictDoUpdate({
      target: [workflowRun.orgId, workflowRun.instanceId],
      set: { currentStep: step, status, updatedAt: sql`now()` },
    });
