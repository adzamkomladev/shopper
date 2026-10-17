import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { auth, cookies, baseURL } from "../setup";

async function principal(role: string) {
  const found = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get(role)! } }),
  );
  return { ...found!, deviceId: v7() };
}

test("seeded roles may use report.read, stock.read and stock.write on a till device", async () => {
  const [inventory, accountant, cashier] = await Promise.all([
    principal("inventory"),
    principal("accountant"),
    principal("cashier"),
  ]);
  expect(await auth.hasPermission(inventory, "stock.read")).toBe(true);
  expect(await auth.hasPermission(inventory, "stock.write")).toBe(true);
  expect(await auth.hasPermission(accountant, "report.read")).toBe(true);
  expect(await auth.hasPermission(accountant, "stock.read")).toBe(true);
  // Permissions are data: the cashier role holds none of them, so the till grants nothing.
  expect(await auth.hasPermission(cashier, "stock.write")).toBe(false);
  expect(await auth.hasPermission(cashier, "report.read")).toBe(false);
});
