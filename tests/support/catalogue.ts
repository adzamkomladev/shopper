import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BOX_API, MART, PORTAL_ORIGIN } from "./e2e";

// Runs on the saved owner session. Earlier runs may have left products behind on a reused server,
// so every test names its products with a tag that is new each time.
export const tagOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const barcodeOf = () => String(Date.now()).padStart(13, "0");

export type Draft = { name: string; sku: string; barcode?: string };

async function orgHeaders(request: APIRequestContext) {
  const org = await request.get(`${BOX_API}/orgs/${MART.code}`);
  const { id } = (await org.json()) as { id: string };
  return { "X-Shopper-Org": id, Origin: PORTAL_ORIGIN };
}

/** Creates a product through the API as the saved owner (there is no tax class list: it is a fixed set). */
export async function seed(request: APIRequestContext, draft: Draft) {
  const created = await request.post(`${BOX_API}/products`, {
    headers: await orgHeaders(request),
    data: {
      name: draft.name,
      sku: draft.sku,
      baseUnit: "each",
      taxClass: "standard",
      barcodes: draft.barcode ? [{ code: draft.barcode }] : [],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()) as { id: string };
}

export const sheet = (page: Page) => page.getByRole("dialog");

export async function openSheet(page: Page) {
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(sheet(page)).toBeVisible();
}

/** Fills the new-product sheet: Unit "each", the first Tax class, and a Barcode when given. */
export async function fillSheet(page: Page, draft: Draft) {
  await sheet(page).getByLabel("Name", { exact: true }).fill(draft.name);
  await sheet(page).getByLabel("SKU", { exact: true }).fill(draft.sku);
  await sheet(page).getByRole("combobox", { name: "Unit" }).click();
  await page.getByRole("option", { name: /^each$/i }).click();
  await sheet(page).getByRole("combobox", { name: "Tax class" }).click();
  await page.getByRole("option").first().click();
  if (draft.barcode) await sheet(page).getByLabel("Barcode", { exact: true }).fill(draft.barcode);
}

/** Gives a product an org-wide price (in money units, 1 GHS = 10000) through the API. */
export async function seedPrice(request: APIRequestContext, productId: string, amount: number) {
  const created = await request.post(`${BOX_API}/products/${productId}/prices`, {
    headers: await orgHeaders(request),
    data: { amount, reason: "Seeded price" },
  });
  expect(created.status(), await created.text()).toBe(201);
}

/** Seeds a product and opens its page. */
export async function openProduct(page: Page, request: APIRequestContext, name: string) {
  const tag = tagOf();
  const draft = { name: `${name} ${tag}`, sku: `${name.slice(0, 3).toUpperCase()}-${tag}` };
  const { id } = await seed(request, draft);
  const loaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/products/${id}` &&
      response.request().method() === "GET",
  );
  await page.goto(`/products/${id}`);
  expect((await loaded).status()).toBe(200);
  await expect(page.getByRole("heading", { name: draft.name, level: 1 })).toBeVisible();
  return { ...draft, id };
}

/** A card on the product page: the Details, Barcodes or Prices region. */
export const card = (page: Page, name: "Details" | "Barcodes" | "Prices") =>
  page.getByRole("region", { name });

/** A `datetime-local` value for `days` from now at 08:00 local time. */
export function localDateTime(days: number) {
  const at = new Date();
  at.setDate(at.getDate() + days);
  at.setHours(8, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:00`;
}
