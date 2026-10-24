import { mkdirSync } from "node:fs";
import { expect, type Page, type Route } from "@playwright/test";

// Set SHOPPER_SCREENSHOTS_DIR to keep the screenshots (docs/plans/day13/screenshots).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;

export const sizes = [
  { name: "1366", width: 1366, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

export const today = new Date().toISOString().slice(0, 10);

export const report = {
  from: today,
  to: today,
  totals: { sales: 1_245_000, transactions: 7, tax: 150_000, discounts: 20_000, net: 1_095_000 },
  tenders: [
    { method: "cash", amount: 745_000 },
    { method: "momo", amount: 500_000 },
  ],
  byHour: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    amount: hour === 9 ? 400_000 : hour === 14 ? 845_000 : 0,
    count: hour === 9 ? 3 : hour === 14 ? 4 : 0,
  })),
  topProducts: [
    {
      productId: "0198f0a0-0000-7000-8000-000000000001",
      name: "Milo 400g tin",
      quantityThousandths: 3_000,
      amount: 540_000,
    },
    {
      productId: "0198f0a0-0000-7000-8000-000000000002",
      name: "Loose rice (kg)",
      quantityThousandths: 4_500,
      amount: 330_000,
    },
  ],
  returns: { count: 0, amount: 0 },
  products: 128,
  discountedSales: 2,
  customers: 5,
  returningCustomers: 3,
};
export const emptyReport = {
  ...report,
  totals: { sales: 0, transactions: 0, tax: 0, discounts: 0, net: 0 },
  tenders: [],
  byHour: report.byHour.map((hour) => ({ ...hour, amount: 0, count: 0 })),
  topProducts: [],
  products: 0,
  discountedSales: 0,
  customers: 0,
  returningCustomers: 0,
};

export const catalogue = [
  { productId: "p1", sku: "MILO-400", name: "Milo 400g tin", match: "name" },
  { productId: "p2", sku: "RICE-KG", name: "Loose rice (kg)", match: "name" },
  { productId: "p3", sku: "MILK-1L", name: "Fresh milk 1L", match: "name" },
];

export type QueueRow = {
  id: string;
  kind: "count" | "receipt";
  status: "queued" | "sent" | "rejected";
  createdAt: string;
  blockedReason: string | null;
  payload: { lines: unknown[] };
};

export type Register = {
  /** The permissions `/api/session/permissions` answers with. */
  permissions: string[];
  report: unknown;
  /** Status for `GET /api/register/report`; anything but 200 answers `{error}`. */
  reportStatus: number;
  reportDelayMs: number;
  stock: QueueRow[];
  stockStatus: number;
  /** Every request path (with its query) the page made, in order. */
  requests: string[];
  /** The JSON bodies POSTed to /api/register/stock. */
  posted: Record<string, unknown>[];
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Stands in for the register host's `/api`; returns the state a test reads and changes. */
export async function mockRegister(page: Page, overrides: Partial<Register> = {}) {
  const state: Register = {
    permissions: ["report.read", "stock.read", "stock.write", "sale.create"],
    report,
    reportStatus: 200,
    reportDelayMs: 0,
    stock: [],
    stockStatus: 200,
    requests: [],
    posted: [],
    ...overrides,
  };
  // Only the host's /api: the dev server also serves source files under paths like /packages/backoffice/src/api/.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api/, "");
      state.requests.push(`${path}${url.search}`);
      if (path === "/session/permissions") return json(route, state.permissions);
      if (path === "/register/report.csv")
        return route.fulfill({
          contentType: "text/csv; charset=utf-8",
          headers: {
            "content-disposition": `attachment; filename="register-${url.searchParams.get("from")}-${url.searchParams.get("to")}.csv"`,
          },
          body: "Register report\nTotal sales,124.50",
        });
      if (path === "/register/report") {
        if (state.reportDelayMs) await new Promise((done) => setTimeout(done, state.reportDelayMs));
        if (state.reportStatus !== 200)
          return json(
            route,
            { error: "The register could not build the report" },
            state.reportStatus,
          );
        return json(route, state.report);
      }
      if (path === "/register/products") {
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        return json(
          route,
          catalogue.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q)),
        );
      }
      if (path === "/register/stock" && route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          kind: "count" | "receipt";
          lines: unknown[];
        };
        state.posted.push(body);
        state.stock.unshift({
          id: `doc-${state.posted.length}`,
          kind: body.kind,
          status: "queued",
          createdAt: new Date().toISOString(),
          blockedReason: null,
          payload: { lines: body.lines },
        });
        return json(route, { id: `doc-${state.posted.length}` }, 201);
      }
      if (path === "/register/stock") {
        if (state.stockStatus !== 200)
          return json(route, { error: "The queue is unavailable" }, state.stockStatus);
        return json(route, state.stock);
      }
      return json(route, { error: "Not mocked" }, 404);
    },
  );
  return state;
}

export async function expectFits(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

export async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png` });
}

/** Opens the shell harness on a tab; `permissions` decide which tabs exist, `extra` adds query flags. */
export async function openShell(
  page: Page,
  tab: "Dashboard" | "Inventory" | "Sales Reports",
  extra = "",
) {
  await page.goto(`/harness/index.html?scenario=lines${extra}`);
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
}
