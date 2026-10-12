import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { BOX_API, MART, PORTAL_ORIGIN, type Shop } from "./e2e";

export type Row = { id: string; name: string };

/** A short id that is new on every run, so tests never collide on a reused server. */
export const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Headers that address one shop as the signed-in owner (the request fixture carries the cookie). */
export async function shopHeaders(request: APIRequestContext, shop: Shop = MART) {
  const org = await request.get(`${BOX_API}/orgs/${shop.code}`);
  const { id } = (await org.json()) as { id: string };
  return { "X-Shopper-Org": id, Origin: PORTAL_ORIGIN };
}

export async function post<T>(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(`${BOX_API}${path}`, {
    headers: await shopHeaders(request),
    data,
  });
  expect(response.status(), await response.text()).toBeLessThan(300);
  return (await response.json()) as T;
}

export const createStore = (request: APIRequestContext, name: string) =>
  post<Row>(request, "/stores", { name });

export const createBranch = (request: APIRequestContext, name: string, storeId: string) =>
  post<Row>(request, "/branches", { name, storeId });

/** Enrols a till in the branch through the real two-step flow: owner issues a code, the till redeems it. */
export async function enrolDevice(request: APIRequestContext, branchId: string, name: string) {
  const headers = await shopHeaders(request);
  const { code } = await post<{ code: string }>(request, "/devices/enrollment", { branchId });
  const enrolled = await request.post(`${BOX_API}/devices/enroll`, {
    headers,
    data: { orgId: headers["X-Shopper-Org"], code, name },
  });
  expect(enrolled.status(), await enrolled.text()).toBe(201);
  return (await enrolled.json()) as { deviceId?: string; id?: string };
}

export const SIZES = [
  [1366, 768],
  [1440, 900],
  [390, 844],
] as const;

/** Screenshots the page at till, desktop and phone sizes and attaches them to the report. */
export async function captureSizes(
  page: Page,
  info: TestInfo,
  name: string,
  ready: () => Promise<void>,
) {
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await ready();
    const path = info.outputPath(`${name}-${width}x${height}.png`);
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    await info.attach(`${name}-${width}x${height}`, { path, contentType: "image/png" });
  }
}

/** Reports whether a focused table action fits within its scroll region's visible bounds. */
export async function fitsInsideTable(action: Locator) {
  return action.evaluate((button) => {
    const region = button.closest('[role="region"]');
    if (!region) return { fits: false, region: null, action: null };
    const table = region.querySelector("table");
    const cell = button.closest("td");
    const group = button.parentElement;
    const actionRect = button.getBoundingClientRect();
    const regionRect = region.getBoundingClientRect();
    const cellRect = cell?.getBoundingClientRect();
    const groupRect = group?.getBoundingClientRect();
    const style = (element: Element | null) => {
      if (!element) return null;
      const computed = getComputedStyle(element);
      return { width: computed.width, minWidth: computed.minWidth };
    };
    return {
      fits:
        actionRect.left >= regionRect.left &&
        actionRect.right <= regionRect.right &&
        actionRect.top >= regionRect.top &&
        actionRect.bottom <= regionRect.bottom,
      action: actionRect.toJSON(),
      region: regionRect.toJSON(),
      scroll: { left: region.scrollLeft, top: region.scrollTop },
      layout: {
        region: { clientWidth: region.clientWidth, scrollWidth: region.scrollWidth },
        table: table && {
          rect: table.getBoundingClientRect().toJSON(),
          clientWidth: table.clientWidth,
          scrollWidth: table.scrollWidth,
          style: { ...style(table), layout: getComputedStyle(table).tableLayout },
        },
        cell: cell && { rect: cellRect?.toJSON(), style: style(cell) },
        group: group && { rect: groupRect?.toJSON(), style: style(group) },
      },
    };
  });
}
