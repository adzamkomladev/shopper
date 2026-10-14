import { beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { recordChanges } from "@shopper/core/changes";
import { api, databases, recordSale } from "../../../support/till/server";
import { createSyncApi, push } from "../../../support/till/requests";
import { ids } from "../../../support/till/sales";
import {
  addStore,
  appendRows,
  bulkRows,
  consumeSeqs,
  enrollDevice,
  head,
  pull,
  pullHeaders,
  storeId,
} from "../../../support/till/pull";

type Page = {
  changes: { seq: string; id: string; entity: string; entityId: string; op: string; v: number }[];
  cursor: string;
  head: string;
  hasMore: boolean;
};
const read = async (response: Response) => {
  expect(response.status).toBe(200);
  return (await response.json()) as Page;
};
const product = (n: number) => ({
  entity: "product" as const,
  entityId: v7(),
  op: "upsert" as const,
  payload: { n },
});
const write = (count: number, from = 0) =>
  databases().db.transaction((tx) =>
    recordChanges(
      tx,
      ids.org,
      Array.from({ length: count }, (_, i) => product(from + i)),
      [storeId],
    ),
  );

// A fresh database has head 0 and cursor 0 means "bootstrap", so every test starts above it.
beforeAll(() => write(1));

test("1,200 changes arrive as pages of 500, 500 and 200 and the last cursor is the head", async () => {
  const start = await head();
  await write(1_200);
  const sizes: number[] = [];
  const flags: boolean[] = [];
  let cursor = String(start);
  for (;;) {
    const page = await read(await pull(api, { cursor }));
    sizes.push(page.changes.length);
    flags.push(page.hasMore);
    expect(page.head).toBe(String(start + 1_200n));
    expect(BigInt(page.changes[0]!.seq)).toBe(BigInt(cursor) + 1n);
    expect(page.cursor).toBe(page.changes.at(-1)!.seq);
    cursor = page.cursor;
    if (!page.hasMore) break;
  }
  expect(sizes).toEqual([500, 500, 200]);
  expect(flags).toEqual([true, true, false]);
  expect(cursor).toBe(String(start + 1_200n));
  const first = await read(await pull(api, { cursor: String(start), limit: 100 }));
  expect(first.changes).toHaveLength(100);
  expect(Object.keys(first.changes[0]!).sort()).toEqual([
    "entity",
    "entityId",
    "id",
    "op",
    "payload",
    "seq",
    "v",
  ]);
  expect(first.changes[0]).toMatchObject({ entity: "product", op: "upsert", v: 2 });
});

test("a caught-up till gets no changes and the head as its cursor; exactly one full page has no more", async () => {
  const current = await head();
  expect(await read(await pull(api, { cursor: String(current) }))).toEqual({
    changes: [],
    cursor: String(current),
    head: String(current),
    hasMore: false,
  });
  await bulkRows(500);
  const page = await read(await pull(api, { cursor: String(current) }));
  expect(page.changes).toHaveLength(500);
  expect(page).toMatchObject({ hasMore: false, cursor: String(current + 500n) });
});

test("sales between feed writes leave seq gaps and every change is still delivered once, in order", async () => {
  const start = await head();
  const wrote: string[] = [];
  for (let round = 0; round < 3; round++) {
    const batch = Array.from({ length: 3 }, () => product(round));
    wrote.push(...batch.map((change) => change.entityId));
    await databases().db.transaction((tx) => recordChanges(tx, ids.org, batch, [storeId]));
    const sale = await recordSale();
    const accepted = await push(api, sale.event, sale.proof, sale.sessionId);
    expect((await accepted.json()).accepted).toHaveLength(1);
  }
  const heard: Page["changes"] = [];
  let cursor = String(start);
  for (;;) {
    const page = await read(await pull(api, { cursor, limit: 4 }));
    heard.push(...page.changes);
    cursor = page.cursor;
    if (!page.hasMore) break;
  }
  expect(heard.map((change) => change.entityId)).toEqual(wrote);
  const seqs = heard.map((change) => BigInt(change.seq));
  expect(seqs.some((seq, i) => i && seq - seqs[i - 1]! > 1n)).toBe(true);
  expect(seqs).toEqual([...seqs].sort((a, b) => (a < b ? -1 : 1)));
  expect(cursor).toBe(String(await head()));
});

test("a change still uncommitted during a pull is neither skipped nor passed by the cursor", async () => {
  const start = await head();
  let commit!: () => void;
  let held!: () => void;
  const inFlight = new Promise<void>((resolve) => (held = resolve));
  const gate = new Promise<void>((resolve) => (commit = resolve));
  const change = product(7);
  const writer = databases().db.transaction(async (tx) => {
    await recordChanges(tx, ids.org, [change], [storeId]);
    held();
    await gate;
  });
  await inFlight;
  let during: Page;
  try {
    during = await read(await pull(api, { cursor: String(start) }));
  } finally {
    // A failed assertion must still release the store row lock, or every later test blocks on it.
    commit();
    await writer;
  }
  expect(during).toEqual({
    changes: [],
    cursor: String(start),
    head: String(start),
    hasMore: false,
  });
  const after = await read(await pull(api, { cursor: during.cursor }));
  expect(after.changes.map((row) => row.entityId)).toEqual([change.entityId]);
  expect(after).toMatchObject({
    cursor: String(start + 1n),
    head: String(start + 1n),
    hasMore: false,
  });
});

test("a cursor of 0 asks the till to bootstrap from a snapshot", async () => {
  const body = await (await pull(api, { cursor: "0" })).json();
  expect(body).toEqual({ snapshot: true, head: String(await head()) });
});

test("more than 50,000 pending change rows ask for a snapshot, exactly 50,000 do not", async () => {
  const start = await head();
  await bulkRows(50_000);
  const exact = await read(await pull(api, { cursor: String(start) }));
  expect(exact).toMatchObject({ hasMore: true });
  expect(exact.changes).toHaveLength(500);
  await bulkRows(1);
  expect(await (await pull(api, { cursor: String(start) })).json()).toEqual({
    snapshot: true,
    head: String(start + 50_001n),
  });
});

test("seq numbers used by sales do not count towards the snapshot threshold", async () => {
  const start = await head();
  await appendRows([{}, {}]);
  await consumeSeqs(60_000);
  const page = await read(await pull(api, { cursor: String(start) }));
  expect(page.changes).toHaveLength(2);
  expect(page).toMatchObject({ hasMore: false, head: String(start + 60_002n) });
  expect(page.cursor).toBe(page.head);
});

test("a revoked device gets 401 and a missing, wrong or foreign credential gets none of the feed", async () => {
  const spare = await enrollDevice();
  const cursor = String(await head());
  expect((await pull(api, { cursor }, spare.headers)).status).toBe(200);
  await spare.revoke();
  expect((await pull(api, { cursor }, spare.headers)).status).toBe(401);
  expect((await pull(api, { cursor }, {})).status).toBe(401);
  expect(
    (await pull(api, { cursor }, { ...pullHeaders(), authorization: `Bearer ${"0".repeat(64)}` }))
      .status,
  ).toBe(401);
  expect(
    (await pull(api, { cursor }, { ...pullHeaders(), "X-Shopper-Org": ids.otherOrg })).status,
  ).toBe(401);
  expect((await pull(api, { cursor }, { ...pullHeaders(), "X-Shopper-Store": v7() })).status).toBe(
    401,
  );
});

test("another store or another organisation's changes are never visible", async () => {
  const start = await head();
  const sibling = await addStore();
  const foreign = await addStore(ids.otherOrg);
  const mine = await appendRows([{ payload: { owner: "mine" } }]);
  await appendRows([{ payload: { owner: "sibling" } }], sibling);
  await appendRows([{ payload: { owner: "foreign" } }], foreign, ids.otherOrg);
  const page = await read(await pull(api, { cursor: String(start) }));
  expect(page.head).toBe(String(mine));
  expect(page.changes.map((row) => (row as { payload?: unknown }).payload)).toEqual([
    { owner: "mine" },
  ]);
  const blocked = await pull(
    api,
    { cursor: String(start) },
    { ...pullHeaders(), "X-Shopper-Store": sibling },
  );
  expect(blocked.status).toBe(401);
});

test("an incompatible protocol header is rejected with 409 and N and N-1 are both accepted", async () => {
  const cursor = String(await head());
  expect((await pull(api, { cursor }, pullHeaders(0))).status).toBe(409);
  expect((await pull(api, { cursor }, pullHeaders(3))).status).toBe(409);
  const later = await createSyncApi(2);
  try {
    for (const [protocol, status] of [
      [1, 200],
      [2, 200],
      [0, 409],
      [3, 409],
    ] as const)
      expect((await pull(later, { cursor }, pullHeaders(protocol))).status).toBe(status);
  } finally {
    await later.close();
  }
});

test("a limit outside 1 to 500 or a malformed cursor is a 400 and 500 is allowed", async () => {
  const cursor = String(await head());
  for (const limit of ["0", "501", "-1", "abc", "1.5"])
    expect((await pull(api, { cursor, limit }, pullHeaders())).status).toBe(400);
  for (const bad of ["abc", "-1", "1.5"])
    expect((await pull(api, { cursor: bad })).status).toBe(400);
  expect((await pull(api, { cursor, limit: 500 })).status).toBe(200);
});
