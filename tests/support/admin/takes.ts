// Stock takes for the portal specs, driven through the real API as the E2E Mart owner on the saved session.
//   freshBranch()           a new store and branch, so a spec's takes and valuation start from nothing
//   startTake(), readTake() open a take and read its sheet
//   countAllBut()           counts every line except `leave` at what is expected, so a Full take is left with only those
//   cancelOpenTakes()       a failed run leaves a take open, and a branch can hold only one
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { v7 } from "uuid";
import { BOX_API } from "../e2e";
import { createBranch, createStore, post, shopHeaders, unique } from "../admin";
import { asOwner, seedStock } from "./stock";

export type TakeLine = {
  productId: string;
  name: string;
  countedThousandths: number | null;
  expectedThousandths: number | null;
  varianceThousandths: number | null;
};
export type TakeView = { id: string; status: string; lines: TakeLine[] };

async function send<T>(
  request: APIRequestContext,
  method: "get" | "put",
  path: string,
  data?: unknown,
) {
  const response = await request[method](`${BOX_API}${path}`, {
    headers: await shopHeaders(request),
    data,
  });
  expect(response.status(), await response.text()).toBeLessThan(300);
  return (await response.json()) as T;
}

/** A branch of its own, with no takes and no stock. */
export const freshBranch = () =>
  asOwner(async (request) => {
    // A take needs products to count, and a shop that has none yet is not what these specs are about.
    await seedStock();
    const tag = unique();
    const store = await createStore(request, `Takes store ${tag}`);
    return createBranch(request, `Takes branch ${tag}`, store.id);
  });

export const startTake = (request: APIRequestContext, branchId: string, categoryId?: string) =>
  post<TakeView>(request, "/stock/takes", {
    id: v7(),
    branchId,
    ...(categoryId ? { scope: "category", categoryId } : { scope: "full" }),
  });

export const readTake = (request: APIRequestContext, id: string) =>
  send<TakeView>(request, "get", `/stock/takes/${id}`);

export const countTake = (
  request: APIRequestContext,
  id: string,
  counts: { productId: string; countedThousandths: number }[],
) => send<TakeView>(request, "put", `/stock/takes/${id}/counts`, { lines: counts });

export const cancelTake = (request: APIRequestContext, id: string) =>
  post<TakeView>(request, `/stock/takes/${id}/cancel`, {});

/** Counts every uncounted line but those of `leave`, each at the quantity expected, so posting would move nothing. */
export async function countAllBut(request: APIRequestContext, id: string, leave: string[]) {
  const { lines } = await readTake(request, id);
  const rest = lines
    .filter((line) => !leave.includes(line.productId) && line.countedThousandths === null)
    .map((line) => ({
      productId: line.productId,
      countedThousandths: line.expectedThousandths ?? 0,
    }));
  for (let at = 0; at < rest.length; at += 500)
    await countTake(request, id, rest.slice(at, at + 500));
}

export async function cancelOpenTakes(branchId: string) {
  await seedStock();
  await asOwner(async (request) => {
    const { items } = await send<{ items: { id: string }[] }>(
      request,
      "get",
      `/stock/takes?branchId=${branchId}&status=open`,
    );
    for (const take of items) await cancelTake(request, take.id);
  });
}

/** The take's count inputs, one per row showing. */
export const countInputs = (page: Page) => page.getByRole("textbox", { name: /^Counted/ });
