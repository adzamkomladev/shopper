import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import {
  createBarcodeMapping,
  listBarcodeMappings,
  updateBarcodeMapping,
} from "@shopper/core/catalogue";
import { openFeed } from "../../../support/till/feed";
import { price, weight } from "./support";

let feed: Awaited<ReturnType<typeof openFeed>>;
let world: Awaited<ReturnType<Awaited<ReturnType<typeof openFeed>>["world"]>>;
beforeAll(async () => {
  feed = await openFeed();
  world = await feed.world(1);
});
afterAll(async () => feed?.close());

const context = () => ({ ...world.context, reason: "Validation test" });
const stored = () => listBarcodeMappings(feed.db, world.orgId);
const rejected = (data: unknown, label?: string) =>
  expect(createBarcodeMapping(feed.db, context(), data), label).rejects;

test("invalid layouts are rejected and nothing is stored", async () => {
  const bad: [string, unknown][] = [
    ["prefix below 20", weight({ prefix: 19 })],
    ["prefix above 29", weight({ prefix: 30 })],
    ["fractional prefix", weight({ prefix: 25.5 })],
    ["string prefix", weight({ prefix: "21" })],
    ["product before digit 2", weight({ product: { start: 1, length: 5 } })],
    ["value past digit 11", weight({ value: { start: 8, length: 5 } })],
    ["zero length product", weight({ product: { start: 2, length: 0 } })],
    ["fractional start", weight({ value: { start: 7.5, length: 4 } })],
    [
      "overlapping slices",
      weight({ product: { start: 2, length: 5 }, value: { start: 6, length: 5 } }),
    ],
    [
      "identical slices",
      weight({ product: { start: 2, length: 4 }, value: { start: 2, length: 4 } }),
    ],
    ["unknown kind", weight({ kind: "volume" })],
    ["missing kind", { ...weight(), kind: undefined }],
    ["weight without unit", { ...weight(), unit: undefined }],
    ["unknown weight unit", weight({ unit: "lb" })],
    ["weight decimals above 4", weight({ decimals: 5 })],
    ["negative decimals", weight({ decimals: -1 })],
    ["fractional decimals", weight({ decimals: 1.5 })],
    ["price decimals above 4", price({ decimals: 5 })],
    ["price with a unit", price({ unit: "g" })],
    ["body orgId", weight({ orgId: world.orgId })],
    ["unknown field", weight({ discount: 1 })],
    ["not an object", "21"],
  ];
  for (const [label, data] of bad) await rejected(data, label).toThrow();
  expect(await stored()).toEqual([]);
  expect(await feed.changes(world.orgId, { entity: "barcode-mapping" })).toEqual([]);
});

test("layouts on the edges of the allowed digits are accepted", async () => {
  const good = [
    weight({ prefix: 20, product: { start: 2, length: 1 }, value: { start: 11, length: 1 } }),
    weight({
      prefix: 29,
      product: { start: 2, length: 5 },
      value: { start: 7, length: 5 },
      unit: "kg",
      decimals: 4,
    }),
    price({ prefix: 28, decimals: 0 }),
    price({
      prefix: 27,
      decimals: 4,
      product: { start: 6, length: 6 },
      value: { start: 2, length: 4 },
    }),
  ];
  for (const data of good)
    expect(await createBarcodeMapping(feed.db, context(), data)).toMatchObject(data);
  expect(await stored()).toHaveLength(good.length);
});

test("an update must leave a valid, non-overlapping layout and a free prefix", async () => {
  const taken = await createBarcodeMapping(feed.db, context(), price({ prefix: 26 }));
  const target = await createBarcodeMapping(feed.db, context(), weight({ prefix: 23 }));
  const update = (data: unknown) =>
    expect(updateBarcodeMapping(feed.db, context(), { id: target.id, data })).rejects;
  await update({}).toThrow();
  await update({ prefix: 31 }).toThrow();
  await update({ value: { start: 6, length: 6 } }).toThrow(); // overlaps the product digits
  await update({ decimals: 9 }).toThrow();
  await update({ orgId: world.orgId }).toThrow();
  await update({ prefix: taken.prefix }).toMatchObject({ status: 409 });
  expect((await stored()).find((m) => m.id === target.id)).toMatchObject(weight({ prefix: 23 }));

  const ok = await updateBarcodeMapping(feed.db, context(), {
    id: target.id,
    data: { prefix: 23, decimals: 3 },
  });
  expect(ok).toMatchObject(weight({ prefix: 23, decimals: 3 }));
});
