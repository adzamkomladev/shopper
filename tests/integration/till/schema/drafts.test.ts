import { afterEach, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import {
  localSale,
  saleDraft,
  saleDraftLine,
  saleDraftTender,
  type TillDatabase,
} from "@shopper/db-sqlite";
import { openTillDatabase } from "../../../support/till/storage";
import { violation } from "../../../support/violation";

let directory: string;
let db: TillDatabase;
afterEach(async () => {
  await db?.close();
  await rm(directory, { recursive: true, force: true });
});

const org = v7();
const scope = { orgId: org, deviceId: v7(), branchId: v7(), cashierId: v7() };
const stamp = "2026-10-15T09:00:00.000Z";
const draft = (status: "open" | "held" | "voided", over: Partial<typeof scope> = {}) => ({
  ...scope,
  ...over,
  id: v7(),
  status,
  revision: 1,
  totals: {},
  createdAt: stamp,
  updatedAt: stamp,
});

async function open() {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-schema-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
}

test("a scope holds many held and voided drafts beside one open draft", async () => {
  await open();
  await db.transaction(async (tx) => {
    await tx.insert(saleDraft).values([draft("held"), draft("held"), draft("voided")]);
    await tx.insert(saleDraft).values(draft("open"));
  });
  const rows = await db.read((tx) => tx.select().from(saleDraft));
  expect(rows.map((row) => row.status).sort()).toEqual(["held", "held", "open", "voided"]);
});

test("a second open draft in the same scope is rejected", async () => {
  await open();
  await db.transaction((tx) => tx.insert(saleDraft).values(draft("open")));
  const second = db.transaction((tx) => tx.insert(saleDraft).values(draft("open")));
  expect(await violation(second)).toMatch(/UNIQUE/);
});

test("open drafts of other cashiers, devices and branches coexist", async () => {
  await open();
  await db.transaction((tx) =>
    tx
      .insert(saleDraft)
      .values([
        draft("open"),
        draft("open", { cashierId: v7() }),
        draft("open", { deviceId: v7() }),
        draft("open", { branchId: v7() }),
      ]),
  );
  expect(await db.read((tx) => tx.select().from(saleDraft))).toHaveLength(4);
});

test("a held draft can be reopened only when no other draft is open", async () => {
  await open();
  const held = draft("held");
  await db.transaction(async (tx) => {
    await tx.insert(saleDraft).values([held, draft("open")]);
  });
  const reopen = () =>
    db.transaction((tx) =>
      tx.update(saleDraft).set({ status: "open" }).where(eq(saleDraft.id, held.id)),
    );
  expect(await violation(reopen())).toMatch(/UNIQUE/);
});

test("draft status defaults to open and is limited to open, held and voided", async () => {
  await open();
  const { status: _status, ...bare } = draft("open");
  await db.transaction((tx) => tx.insert(saleDraft).values(bare));
  const [stored] = await db.read((tx) => tx.select().from(saleDraft));
  expect(stored!.status).toBe("open");
  expect(
    await violation(
      db.transaction((tx) =>
        tx.run(sql`UPDATE sale_draft SET status = 'lost' WHERE org_id = ${org}`),
      ),
    ),
  ).toMatch(/CHECK/);
});

test("lines default to no discount and tenders keep one position per draft", async () => {
  await open();
  const parent = draft("open");
  const base = { orgId: org, draftId: parent.id };
  await db.transaction(async (tx) => {
    await tx.insert(saleDraft).values(parent);
    await tx
      .insert(saleDraftLine)
      .values({ ...base, id: v7(), position: 0, productId: v7(), quantityThousandths: 1000 });
    await tx.insert(saleDraftTender).values({
      ...base,
      id: v7(),
      position: 0,
      kind: "momo",
      amount: 25000,
      reference: "ref-1",
      phone: "024****567",
      network: "mtn",
      status: "pending",
      createdAt: stamp,
    });
  });
  const [line] = await db.read((tx) => tx.select().from(saleDraftLine));
  expect(line!.discount).toBe(0);
  const duplicate = db.transaction((tx) =>
    tx.insert(saleDraftTender).values({
      ...base,
      id: v7(),
      position: 0,
      kind: "cash",
      amount: 1000,
      status: "applied",
      createdAt: stamp,
    }),
  );
  expect(await violation(duplicate)).toMatch(/UNIQUE/);
});

test("a completed local sale defaults to completed with no receipt yet", async () => {
  await open();
  await db.transaction((tx) =>
    tx.insert(localSale).values({
      id: v7(),
      orgId: org,
      deviceId: scope.deviceId,
      localId: v7(),
      payload: {},
      contentHash: "hash",
    }),
  );
  const [sale] = await db.read((tx) => tx.select().from(localSale));
  expect(sale).toMatchObject({ status: "completed", receipt: null });
});
