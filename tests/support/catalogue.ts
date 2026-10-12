import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BOX_API, MART, PORTAL_ORIGIN } from "./e2e";

// Runs on the saved owner session. Earlier runs may have left products behind on a reused server,
// so every test names its products with a tag that is new each time.
export const tagOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const barcodeOf = () => String(Date.now()).padStart(13, "0");

export type Draft = { name: string; sku: string; barcode?: string };

/** Creates a product through the API as the saved owner (there is no tax class list: it is a fixed set). */
export async function seed(request: APIRequestContext, draft: Draft) {
  const org = await request.get(`${BOX_API}/orgs/${MART.code}`);
  const { id: orgId } = (await org.json()) as { id: string };
  const created = await request.post(`${BOX_API}/products`, {
    headers: { "X-Shopper-Org": orgId, Origin: PORTAL_ORIGIN },
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
