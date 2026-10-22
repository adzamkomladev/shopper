import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { registerReportCsv } from "@shopper/core/till";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../fixtures/sales/golden";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { customerApi, parseCsv } from "../../support/customers/http";
import { addCreditEntry, addCustomer, addLoyaltyEntry } from "../../support/customers/seed";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let accountant: ReturnType<typeof customerApi>;
let inventory: ReturnType<typeof customerApi>;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  accountant = customerApi(owner, await portalMember(owner, "accountant"));
  inventory = customerApi(owner, await portalMember(owner, "inventory"));
});
afterAll(async () => {
  await world?.local.close();
});

/** The export as header-keyed rows. */
async function exported() {
  const response = await accountant.csv();
  const [header, ...rows] = parseCsv(response.text.trimEnd());
  return {
    response,
    header: header!,
    rows: rows.map((row) => Object.fromEntries(header!.map((name, i) => [name, row[i]]))),
  };
}

test("the export carries each customer's folded balance in cedis and folded points", async () => {
  const owing = await addCustomer({ name: "Owes Money", phone: "0249990001" });
  await addCreditEntry(owing, "charge", 200_000);
  await addCreditEntry(owing, "payment", -75_000);
  await addLoyaltyEntry(owing, "earn", 40);
  await addLoyaltyEntry(owing, "redeem", -15);
  const deposit = await addCustomer({ name: "Has Deposit", phone: "0249990002" });
  await addCreditEntry(deposit, "payment", -30_000);
  await addCustomer({ name: "Quiet One", phone: "0249990003" });
  await addCustomer({ name: "Foreign Shopper", orgId: ids.otherOrg });

  const { response, header, rows } = await exported();
  expect(response.status).toBe(200);
  expect(response.type).toMatch(/^text\/csv/);
  expect(header).toEqual(expect.arrayContaining(["Name", "Phone", "Balance", "Points"]));
  const byName = (name: string) => rows.find((row) => row.Name === name);
  expect(byName("Owes Money")).toMatchObject({
    Phone: "0249990001",
    Balance: "12.50",
    Points: "25",
  });
  expect(byName("Has Deposit")).toMatchObject({ Balance: "-3.00", Points: "0" });
  expect(byName("Quiet One")).toMatchObject({ Balance: "0.00", Points: "0" });
  expect(byName("Foreign Shopper")).toBeUndefined();
});

test("cells that a spreadsheet would run as formulas are prefixed with an apostrophe", async () => {
  const names = [
    '=HYPERLINK("x")',
    "+cmd|' /C calc'!A0",
    "-2+3",
    "@SUM(A1)",
    "\tTabbed",
    "\rReturned",
  ];
  for (const name of names) await addCustomer({ name, businessName: "=1+1" });
  const { rows, response } = await exported();
  for (const name of names) {
    const row = rows.find((r) => r.Name === `'${name}`);
    expect(row, name).toBeDefined();
    expect(row!["Business name"]).toBe("'=1+1");
  }
  expect(response.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  expect(rows.some((r) => r.Name === 'HYPERLINK("x")' || r.Name === '=HYPERLINK("x")')).toBe(false);
});

test("the export needs customer.read: the inventory role gets 403 and an anonymous caller 401", async () => {
  expect((await inventory.csv()).status).toBe(403);
  expect((await owner.api.request("/customers/export.csv")).status).toBe(401);
});

test("the register report CSV neutralises formula names and prints quantities as exact thousandths", () => {
  const amount = 15_000;
  const csv = parseCsv(
    registerReportCsv({
      from: "2026-10-15",
      to: "2026-10-15",
      totals: { sales: amount, transactions: 1, tax: 1_000, discounts: 0, net: 14_000 },
      tenders: [{ method: "cash", amount }],
      byHour: [],
      topProducts: [
        { productId: v7(), name: "=cmd|' /C calc'!A0", quantityThousandths: 1_500, amount },
        { productId: v7(), name: "Rice, 5kg", quantityThousandths: 4_000, amount },
        { productId: v7(), name: "@Weighed", quantityThousandths: 1_005, amount },
        { productId: v7(), name: "\tTab", quantityThousandths: 12_345_678, amount },
      ],
      returns: { count: 0, amount: 0 },
      products: 4,
      discountedSales: 0,
    }),
  );
  const start = csv.findIndex((row) => row[0] === "Product");
  expect(csv.slice(start + 1)).toEqual([
    ["'=cmd|' /C calc'!A0", "1.5", "1.50"],
    ["Rice, 5kg", "4", "1.50"],
    ["'@Weighed", "1.005", "1.50"],
    ["'\tTab", "12345.678", "1.50"],
  ]);
  expect(csv.find((row) => row[0] === "Total sales")).toEqual(["Total sales", "1.50"]);
});
