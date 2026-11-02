// Manual journals and the books' controls, through the API:
//   - a manual entry needs two or more lines that balance, on accounts of this org; it posts once per id;
//   - a reversal mirrors an entry once, dated on its own day; a reversal itself cannot be reversed;
//   - nothing manual may be dated on or before the lock date, while a late synced sale still posts on the first open day;
//   - custom accounts can be added and archived, system accounts renamed but never archived;
//   - reading needs ledger.read, posting ledger.write, locking ledger.lock: a cashier gets 403.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../fixtures/sales/golden";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { send } from "../../support/stock/http";
import { entriesOf } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let account: Record<string, string>;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  const { body } = await get(owner.api, owner.cookie, "/ledger/accounts");
  account = Object.fromEntries(
    body.accounts.flatMap((row: any) => (row.systemKey ? [[row.systemKey, row.id]] : [])),
  );
});
afterAll(async () => {
  await world?.local.close();
});

const post = (path: string, body: unknown, method = "POST", cookie = owner.cookie) =>
  send(owner.api, cookie, method, path, body);
const journal = (lines: [string, number][], postedOn = "2026-10-20", id = v7()) => ({
  id,
  postedOn,
  memo: "Owner put cash into the bank",
  lines: lines.map(([key, amount]) => ({ accountId: account[key] ?? key, amount })),
});

test("a manual entry must balance, have two lines and use this org's accounts", async () => {
  expect(
    (
      await post(
        "/ledger/journal",
        journal([
          ["bank", 10_000],
          ["owner_equity", -9_000],
        ]),
      )
    ).status,
  ).toBe(422);
  expect((await post("/ledger/journal", journal([["bank", 10_000]]))).status).toBe(400);
  expect(
    (
      await post(
        "/ledger/journal",
        journal([
          ["bank", 10_000],
          [v7(), -10_000],
        ]),
      )
    ).status,
  ).toBe(404);

  const body = journal([
    ["bank", 1_000_000],
    ["owner_equity", -1_000_000],
  ]);
  const posted = await post("/ledger/journal", body);
  expect(posted.status).toBe(201);
  expect((await post("/ledger/journal", body)).status).toBe(201);
  expect(await entriesOf("manual", body.id)).toEqual([
    expect.objectContaining({
      posted_on: "2026-10-20",
      lines: { bank: 1_000_000, owner_equity: -1_000_000 },
    }),
  ]);
});

test("an entry is reversed once, and a reversal is never reversed", async () => {
  const body = journal([
    ["fees", 25_000],
    ["bank", -25_000],
  ]);
  const { body: posted } = await post("/ledger/journal", body);
  const reversed = await post(`/ledger/journal/${posted.id}/reverse`, { postedOn: "2026-10-21" });
  expect(reversed.status).toBe(201);
  expect((await entriesOf("reversal", posted.id))[0]).toMatchObject({
    posted_on: "2026-10-21",
    lines: { fees: -25_000, bank: 25_000 },
  });
  expect(
    (await post(`/ledger/journal/${posted.id}/reverse`, { postedOn: "2026-10-21" })).status,
  ).toBe(409);
  expect(
    (await post(`/ledger/journal/${reversed.body.id}/reverse`, { postedOn: "2026-10-22" })).status,
  ).toBe(422);
  expect((await post(`/ledger/journal/${v7()}/reverse`, { postedOn: "2026-10-22" })).status).toBe(
    404,
  );
});

test("the lock date refuses manual entries on or before it", async () => {
  expect((await post("/ledger/lock", { through: "2026-10-25" }, "PUT")).body).toEqual({
    through: "2026-10-25",
  });
  expect(
    (
      await post(
        "/ledger/journal",
        journal(
          [
            ["bank", 5_000],
            ["owner_equity", -5_000],
          ],
          "2026-10-25",
        ),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await post(
        "/ledger/journal",
        journal(
          [
            ["bank", 5_000],
            ["owner_equity", -5_000],
          ],
          "2026-10-26",
        ),
      )
    ).status,
  ).toBe(201);
  const { body: list } = await get(
    owner.api,
    owner.cookie,
    "/ledger/journal?from=2026-10-20&to=2026-10-20",
  );
  const [early] = list.entries;
  expect(
    (await post(`/ledger/journal/${early.id}/reverse`, { postedOn: "2026-10-24" })).status,
  ).toBe(409);
  expect((await post("/ledger/lock", { through: null }, "PUT")).body).toEqual({ through: null });
});

test("custom accounts are added and archived; system accounts only renamed", async () => {
  const created = await post("/ledger/accounts", { code: "5400", name: "Rent", type: "expense" });
  expect(created.status).toBe(201);
  expect(
    (await post("/ledger/accounts", { code: "5400", name: "Again", type: "expense" })).status,
  ).toBe(409);
  expect(
    (await post(`/ledger/accounts/${created.body.id}`, { archived: true }, "PATCH")).body,
  ).toMatchObject({
    archived: true,
  });
  expect(
    (await post(`/ledger/accounts/${account.bank}`, { name: "Main bank" }, "PATCH")).body,
  ).toMatchObject({
    name: "Main bank",
  });
  expect((await post(`/ledger/accounts/${account.bank}`, { archived: true }, "PATCH")).status).toBe(
    422,
  );
  expect(
    (
      await post(
        "/ledger/journal",
        journal([
          [created.body.id, 1_000],
          ["bank", -1_000],
        ]),
      )
    ).status,
  ).toBe(422);
});

test("a cashier can neither read nor post the books", async () => {
  const cashier = await portalMember(owner, "cashier");
  expect((await get(owner.api, cashier, "/ledger/accounts")).status).toBe(403);
  expect(
    (
      await post(
        "/ledger/journal",
        journal([
          ["bank", 1],
          ["owner_equity", -1],
        ]),
        "POST",
        cashier,
      )
    ).status,
  ).toBe(403);
  expect((await post("/ledger/lock", { through: "2026-10-01" }, "PUT", cashier)).status).toBe(403);
});
