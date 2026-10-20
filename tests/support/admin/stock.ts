// Stock for the portal specs, written through the real API as the E2E Mart owner on the saved session.
//   seedStock() -> once per run, at Accra Central:
//     Rice      kg    received 24 kg at GH₵ 9.50, 2.5 kg damaged (on hand 21.5 kg), reorder level 5 kg
//     Tomatoes  kg    received 10.5 kg at GH₵ 28.00, reorder level 12 kg (low)
//     Beans     each  nothing received, no level
// Names carry a tag that is new on every run, so a reused server never collides.
import { expect, request as playwright, type APIRequestContext, type Page } from "@playwright/test";
import { v7 } from "uuid";
import { BOX_API, BRANCH_NAME } from "../e2e";
import { post, shopHeaders, unique } from "../admin";
import { createCustomRole, createStaff, type Staff } from "./people";

type Row = { id: string; name: string };
type Branch = Row & { storeId: string };

let seeded: ReturnType<typeof seed> | undefined;
export const seedStock = () => (seeded ??= seed());

async function seed() {
  const request = await playwright.newContext({ storageState: "tests/e2e/.auth/owner.json" });
  try {
    return await seedWith(request);
  } finally {
    await request.dispose();
  }
}

const product = (request: APIRequestContext, sku: string, name: string, baseUnit: string) =>
  post<Row>(request, "/products", { sku, name, baseUnit, taxClass: "standard" });

async function seedWith(request: APIRequestContext) {
  const headers = await shopHeaders(request);
  const branches = (await (
    await request.get(`${BOX_API}/branches`, { headers })
  ).json()) as Branch[];
  const branch = branches.find((row) => row.name === BRANCH_NAME)!;
  const tag = unique();
  const supplier = await post<Row>(request, "/suppliers", { name: `Agyei Wholesale ${tag}` });
  const rice = await product(request, `RICE-${tag}`, `Rice ${tag}`, "kg");
  const tomatoes = await product(request, `TOM-${tag}`, `Tomatoes ${tag}`, "kg");
  const beans = await product(request, `BEAN-${tag}`, `Beans ${tag}`, "each");
  await post(request, "/stock/receipts", {
    id: v7(),
    branchId: branch.id,
    supplierId: supplier.id,
    lines: [
      { productId: rice.id, quantityThousandths: 24_000, unitCost: 95_000 },
      { productId: tomatoes.id, quantityThousandths: 10_500, unitCost: 280_000 },
    ],
  });
  await post(request, "/stock/adjustments", {
    id: v7(),
    branchId: branch.id,
    cause: "damaged",
    lines: [{ productId: rice.id, quantityThousandths: 2_500 }],
  });
  for (const [item, level] of [
    [rice, 5_000],
    [tomatoes, 12_000],
  ] as const)
    await reorder(request, branch.id, item.id, level);
  return { tag, branch, supplier, rice, tomatoes, beans };
}

export async function reorder(
  request: APIRequestContext,
  branchId: string,
  productId: string,
  levelThousandths: number | null,
) {
  const response = await request.put(`${BOX_API}/stock/reorder`, {
    headers: await shopHeaders(request),
    data: { branchId, productId, levelThousandths },
  });
  if (!response.ok()) throw new Error(`reorder ${response.status()}: ${await response.text()}`);
}

export const heading = (page: Page, name: string, level = 1) =>
  page.getByRole("heading", { name, level });
export const rowOf = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
export const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
export const search = (page: Page) => page.getByRole("textbox", { name: "Search stock" });
export const lowToggle = (page: Page) => page.getByRole("button", { name: /Low stock/ });

/** The stock list of Accra Central, signed in as the saved owner. */
export async function openStock(page: Page, query = "") {
  const { branch, tag } = await seedStock();
  await page.goto(`/stock?branch=${branch.id}${query}`);
  await expect(heading(page, "Stock")).toBeVisible();
  return { branch, tag };
}

// Members are listed in a virtualized table that other specs read, so these are made once per run and shared.
const members = new Map<string, Promise<Staff>>();

/** A member who can read stock ("accountant"), manage it ("inventory"), or can see neither stock nor products ("nobody"). */
export function stockMember(
  request: APIRequestContext,
  kind: "accountant" | "inventory" | "nobody",
) {
  const found = members.get(kind);
  if (found) return found;
  const made =
    kind === "nobody"
      ? createCustomRole(request, `No access ${unique()}`, []).then((role) =>
          createStaff(request, role.name, "Nobody"),
        )
      : createStaff(request, kind, kind === "inventory" ? "Kwame" : "Esi");
  members.set(kind, made);
  return made;
}
