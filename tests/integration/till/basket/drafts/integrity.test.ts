// Unpaid drafts: optimistic revisions, atomic storage, one winner under concurrency, survival across restart.
import { sql } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { removeDraftLine, setDraftQuantity } from "@shopper/core/till";
import {
  add,
  at,
  bare,
  ctx,
  draftAudit,
  expectChain,
  fails,
  products,
  read,
  scope,
  weightLabel,
  withDatabase,
  withTill,
  world,
} from "../../../../support/till/drafts";

test("a stale expected revision is REVISION_STALE for add, quantity and remove, and changes nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    const view = await add(db, 0, { code: bare });
    await add(db, 1, { code: bare });
    const current = await read(db);
    const rows = await draftAudit(db);
    const lineId = view.draft?.lines[0]?.id ?? "";
    const stale = { scope, expectedRevision: 1, at, lineId };
    await expect(add(db, 1, { code: weightLabel })).rejects.toMatchObject(fails("REVISION_STALE"));
    await expect(add(db, 5, { code: bare })).rejects.toMatchObject(fails("REVISION_STALE"));
    await expect(
      setDraftQuantity(db, ctx, { ...stale, quantityThousandths: 9000 }),
    ).rejects.toMatchObject(fails("REVISION_STALE"));
    await expect(removeDraftLine(db, ctx, stale)).rejects.toMatchObject(fails("REVISION_STALE"));
    expect(await read(db)).toEqual(current);
    expect(await draftAudit(db)).toEqual(rows);
    await expectChain(db);
  });
});

test("expecting a revision above 0 when no draft exists is REVISION_STALE and creates nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    await expect(add(db, 1, { code: bare })).rejects.toMatchObject(fails("REVISION_STALE"));
    expect((await read(db)).draft).toBeNull();
    expect(await draftAudit(db)).toEqual([]);
  });
});

test("a storage failure rolls back draft and audit together and leaves the revision usable", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: bare });
    const before = await read(db);
    const rows = await draftAudit(db);
    await db.read((tx) =>
      tx.run(
        sql.raw(`CREATE TRIGGER reject_draft_audit BEFORE INSERT ON till_audit
          WHEN NEW.command LIKE 'till.draft.%'
          BEGIN SELECT RAISE(ABORT, 'injected draft failure'); END`),
      ),
    );
    await expect(add(db, 1, { code: weightLabel })).rejects.toThrow();
    await expect(
      setDraftQuantity(db, ctx, {
        scope,
        expectedRevision: 1,
        at,
        lineId: before.draft?.lines[0]?.id ?? "",
        quantityThousandths: 4000,
      }),
    ).rejects.toThrow();
    await db.read((tx) => tx.run(sql.raw("DROP TRIGGER reject_draft_audit")));
    expect(await read(db)).toEqual(before);
    expect(await draftAudit(db)).toEqual(rows);

    const retried = await add(db, 1, { code: weightLabel });
    expect(retried.draft).toMatchObject({ id: before.draft?.id, revision: 2 });
    await expectChain(db);
  });
});

test("a storage failure on the very first add leaves no draft behind", async () => {
  await withTill(async (db) => {
    await world(db);
    await db.read((tx) =>
      tx.run(
        sql.raw(`CREATE TRIGGER reject_draft_audit BEFORE INSERT ON till_audit
          WHEN NEW.command LIKE 'till.draft.%'
          BEGIN SELECT RAISE(ABORT, 'injected draft failure'); END`),
      ),
    );
    await expect(add(db, 0, { code: bare })).rejects.toThrow();
    await db.read((tx) => tx.run(sql.raw("DROP TRIGGER reject_draft_audit")));
    expect((await read(db)).draft).toBeNull();
    expect((await add(db, 0, { code: bare })).draft?.revision).toBe(1);
  });
});

test("concurrent adds with the same expected revision: exactly one wins, the rest are stale", async () => {
  await withTill(async (db) => {
    await world(db);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => add(db, 0, { code: bare })),
    );
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(5);
    for (const r of lost) expect(r.reason).toMatchObject(fails("REVISION_STALE"));
    const view = await read(db);
    expect(view.draft).toMatchObject({
      revision: 1,
      lines: [{ productId: products.ordinary.id, quantityThousandths: 1000 }],
    });
    expect(await draftAudit(db)).toHaveLength(1);
    await expectChain(db);
  });
});

test("concurrent edits of an existing draft also admit a single winner per revision", async () => {
  await withTill(async (db) => {
    await world(db);
    const view = await add(db, 0, { code: bare });
    const lineId = view.draft?.lines[0]?.id ?? "";
    const results = await Promise.allSettled([
      setDraftQuantity(db, ctx, {
        scope,
        expectedRevision: 1,
        at,
        lineId,
        quantityThousandths: 3000,
      }),
      removeDraftLine(db, ctx, { scope, expectedRevision: 1, at, lineId }),
      add(db, 1, { code: bare }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await read(db)).draft?.revision).toBe(2);
    expect(await draftAudit(db)).toHaveLength(2);
    await expectChain(db);
  });
});

test("the draft survives closing and reopening the till database, then accepts the next revision", async () => {
  await withDatabase(async (path) => {
    let db = openTillDatabase(path);
    try {
      await world(db);
      await add(db, 0, { code: bare });
      const saved = await add(db, 1, { code: weightLabel });
      await db.close();
      db = openTillDatabase(path);
      expect(await read(db)).toEqual(saved);
      const next = await add(db, 2, { code: bare });
      expect(next.draft).toMatchObject({ id: saved.draft?.id, revision: 3 });
      expect(next.draft?.lines.map((l) => l.quantityThousandths)).toEqual([2000, 500]);
      await expectChain(db);
    } finally {
      await db.close();
    }
  });
});
