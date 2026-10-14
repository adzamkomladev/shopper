// Unpaid drafts: one draft per org/device/branch/cashier; scopes never see or change each other's baskets.
import { expect, test } from "vite-plus/test";
import { addToDraft, removeDraftLine, setDraftQuantity } from "@shopper/core/till";
import {
  add,
  asScope,
  at,
  bare,
  ctx,
  ctxFor,
  fails,
  ids,
  otherBranch,
  otherCashier,
  otherDevice,
  read,
  weightLabel,
  withTill,
  world,
  zeroTotals,
} from "../../../../support/till/drafts";

const others = {
  cashier: asScope({ cashierId: otherCashier }),
  device: asScope({ deviceId: otherDevice }),
  branch: asScope({ branchId: otherBranch }),
};
const foreignOrg = asScope({ orgId: ids.otherOrg });

test.each(Object.entries(others))(
  "another %s starts with its own empty draft and its edits never reach the first",
  async (_name, other) => {
    await withTill(async (db) => {
      await world(db);
      const mine = await add(db, 0, { code: bare });
      expect(await read(db, other)).toMatchObject({
        draft: null,
        quote: { lines: [], totals: zeroTotals },
      });

      const theirs = await add(db, 0, { code: weightLabel }, { scope: other });
      expect(theirs.draft?.id).not.toBe(mine.draft?.id);
      expect(theirs.draft?.revision).toBe(1);
      expect(theirs.draft?.lines).toHaveLength(1);
      expect(await read(db)).toEqual(mine);
      expect((await read(db, other)).draft?.id).toBe(theirs.draft?.id);
    });
  },
);

test("another scope cannot edit or remove a line it does not own", async () => {
  await withTill(async (db) => {
    await world(db);
    const mine = await add(db, 0, { code: bare });
    const lineId = mine.draft?.lines[0]?.id ?? "";
    const other = others.cashier;
    await add(db, 0, { code: weightLabel }, { scope: other });
    const theirs = await read(db, other);
    const input = { scope: other, expectedRevision: 1, at, lineId };
    await expect(
      setDraftQuantity(db, ctxFor(other), { ...input, quantityThousandths: 7000 }),
    ).rejects.toMatchObject(fails("LINE_UNKNOWN"));
    await expect(removeDraftLine(db, ctxFor(other), input)).rejects.toMatchObject(
      fails("LINE_UNKNOWN"),
    );
    expect(await read(db)).toEqual(mine);
    expect(await read(db, other)).toEqual(theirs);
  });
});

test("a scope that disagrees with the command context is rejected with the scope code", async () => {
  await withTill(async (db) => {
    await world(db);
    const mine = await add(db, 0, { code: bare });
    const lineId = mine.draft?.lines[0]?.id ?? "";
    for (const other of [...Object.values(others), foreignOrg]) {
      const input = { scope: other, expectedRevision: 1, at, code: bare };
      await expect(addToDraft(db, ctx, input)).rejects.toMatchObject(fails("scope"));
      await expect(
        setDraftQuantity(db, ctx, {
          scope: other,
          expectedRevision: 1,
          at,
          lineId,
          quantityThousandths: 5000,
        }),
      ).rejects.toMatchObject(fails("scope"));
      await expect(
        removeDraftLine(db, ctx, { scope: other, expectedRevision: 1, at, lineId }),
      ).rejects.toMatchObject(fails("scope"));
    }
    expect(await read(db)).toEqual(mine);
  });
});
