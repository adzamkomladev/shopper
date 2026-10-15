import { mkdirSync } from "node:fs";
import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { BOX_API } from "../e2e";
import { post, shopHeaders } from "../admin";

const API_PATH = "/catalogue/barcodes/mappings";

export type Layout = {
  prefix: number;
  product: { start: number; length: number };
  value: { start: number; length: number };
  kind: "weight" | "price";
  unit?: "g" | "kg";
  decimals: number;
};

/** The common scale layout: 2 PPPPP WWWWW C, weight in kilograms with three decimals. */
export const weightLayout = (prefix: number): Layout => ({
  prefix,
  product: { start: 2, length: 5 },
  value: { start: 7, length: 5 },
  kind: "weight",
  unit: "kg",
  decimals: 3,
});

export const priceLayout = (prefix: number): Layout => ({
  ...weightLayout(prefix),
  kind: "price",
  unit: undefined,
  decimals: 2,
});

export const seedMapping = (request: APIRequestContext, layout: Layout) =>
  post<{ id: string }>(request, API_PATH, layout);

/** Prefixes are unique per shop and there are only ten, so each test starts from an empty list. */
export async function clearMappings(request: APIRequestContext) {
  const headers = await shopHeaders(request);
  const listed = await request.get(`${BOX_API}${API_PATH}`, { headers });
  expect(listed.status(), await listed.text()).toBe(200);
  for (const { id } of (await listed.json()) as { id: string }[]) {
    const removed = await request.delete(`${BOX_API}${API_PATH}/${id}`, { headers });
    expect(removed.status(), await removed.text()).toBe(204);
  }
}

const VIEWPORTS = { desktop: [1440, 900], mobile: [390, 844] } as const;

/**
 * Runs `ready` (state assertions, axe) at desktop and phone width and screenshots each. Set
 * E2E_SHOTS_DIR to keep the PNGs; they are always attached to the report.
 */
export async function shoot(page: Page, info: TestInfo, name: string, ready: () => Promise<void>) {
  const saved = process.env.E2E_SHOTS_DIR;
  if (saved) mkdirSync(saved, { recursive: true });
  for (const [label, [width, height]] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize({ width, height });
    await ready();
    const path = saved ? `${saved}/${name}-${label}.png` : info.outputPath(`${name}-${label}.png`);
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    await info.attach(`${name}-${label}`, { path, contentType: "image/png" });
  }
}
