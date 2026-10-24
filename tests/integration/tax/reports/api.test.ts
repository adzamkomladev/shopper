// The tax report API: the summary and the VAT return worksheet and its Excel export need tax.read; entering the
// input tax claimed needs tax.return (accountant, admin and super admin), and is audited.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import * as schema from "@shopper/db-pg";
import { api, context, cookies, db, request } from "../../auth/setup";

const call = async (who: string, path: string, method = "GET", body?: unknown) => {
  const response = await request(api, cookies.get(who)!, path, method, body);
  return { status: response.status, response };
};
const json = async (who: string, path: string, method = "GET", body?: unknown) => {
  const { status, response } = await call(who, path, method, body);
  return { status, body: await response.json() };
};

test("reading the reports needs tax.read; the cashier and the stock clerk are refused", async () => {
  for (const path of [
    "/tax/summary?from=2026-10-01&to=2026-10-31",
    "/tax/returns/2026-10",
    "/tax/returns/2026-10/export.xlsx",
  ]) {
    expect((await call("accountant", path)).status, path).toBe(200);
    expect((await call("cashier", path)).status, path).toBe(403);
    expect((await call("inventory", path)).status, path).toBe(403);
  }
});

test("an empty month is all zeros, and a bad period or range is a 400", async () => {
  const empty = await json("accountant", "/tax/returns/2026-10");
  expect(empty.body).toMatchObject({
    period: "2026-10",
    from: "2026-10-01",
    to: "2026-10-31",
    standard: { value: 0, vat: 0 },
    payable: 0,
  });
  expect((await json("accountant", "/tax/returns/2026-02")).body.to).toBe("2026-02-28");
  expect((await call("accountant", "/tax/returns/2026-13")).status).toBe(400);
  expect((await call("accountant", "/tax/summary?from=2026-10-01")).status).toBe(400);
  expect((await call("accountant", "/tax/summary?from=x&to=2026-10-31")).status).toBe(400);
});

test("the accountant enters the input tax claimed; it is audited and lowers the balance", async () => {
  const before = (
    await db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, context.orgId))
  ).filter((row) => row.command === "tax.return.input").length;
  const body = { vat: 50_000, nhil: 8_000, getfund: 8_000 };
  expect((await call("cashier", "/tax/returns/2026-10/input", "PUT", body)).status).toBe(403);
  expect(
    (
      await call("accountant", "/tax/returns/2026-10/input", "PUT", {
        vat: -1,
        nhil: 0,
        getfund: 0,
      })
    ).status,
  ).toBe(400);
  const saved = await json("accountant", "/tax/returns/2026-10/input", "PUT", body);
  expect(saved.status).toBe(200);
  expect(saved.body).toMatchObject({ input: body, payable: -66_000 });
  const after = (
    await db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, context.orgId))
  ).filter((row) => row.command === "tax.return.input").length;
  expect(after).toBe(before + 1);

  const { response } = await call("accountant", "/tax/returns/2026-10/export.xlsx");
  expect(response.headers.get("content-type")).toContain("spreadsheetml");
  expect(response.headers.get("content-disposition")).toContain("vat-return-2026-10.xlsx");
  const book = XLSX.read(new Uint8Array(await response.arrayBuffer()));
  const rows = XLSX.utils.sheet_to_json<[string, number]>(book.Sheets["VAT return"]!, {
    header: 1,
  });
  expect(rows.find((row) => row[0] === "Input VAT")?.[1]).toBe(5);
  expect(rows.find((row) => row[0] === "Net payable")?.[1]).toBe(-6.6);
});
