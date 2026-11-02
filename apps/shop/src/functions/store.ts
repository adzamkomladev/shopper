import * as v from "valibot";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { shopCodeParam } from "../schemas/shop";
import { storeInfo, storeItem, storeItemInput, storePage, storePageInput } from "../schemas/store";

/**
 * The public store, read on the server so search engines get whole pages. Nothing personal: these are the same
 * answers for everyone, and the API caches them for a minute.
 */
export const readStore = createServerFn({ method: "GET" })
  .validator((code: unknown) => v.parse(shopCodeParam, code))
  .handler(async ({ context, data }) => {
    const found = await storeApi(context.shopApi, `/${encodeURIComponent(data)}/store`);
    // Canonical links and the sitemap name the address the shopper reached the store at.
    const origin = new URL(getRequest().url).origin;
    return found === null ? null : { ...v.parse(storeInfo, found), origin };
  });

export const readStorePage = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(storePageInput, input))
  .handler(async ({ context, data }) => {
    const query = new URLSearchParams(
      Object.entries({ branch: data.branch, category: data.category, q: data.q, page: data.page })
        .filter(
          (entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== "",
        )
        .map(([key, value]) => [key, String(value)]),
    );
    const found = await storeApi(
      context.shopApi,
      `/${encodeURIComponent(data.shop)}/products?${query}`,
    );
    return found === null ? null : v.parse(storePage, found);
  });

export const readStoreItem = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(storeItemInput, input))
  .handler(async ({ context, data }) => {
    const query = data.branch ? `?branch=${encodeURIComponent(data.branch)}` : "";
    const path = `/${encodeURIComponent(data.shop)}/products/${encodeURIComponent(data.id)}${query}`;
    const found = await storeApi(context.shopApi, path);
    return found === null ? null : v.parse(storeItem, found);
  });

/**
 * Calls the public store API with the shopper's address, so the lookup budget stays per shopper. Null when the
 * shop, branch or product is not in the store.
 */
async function storeApi(shopApi: (request: Request) => Promise<Response>, path: string) {
  const incoming = getRequest();
  const response = await shopApi(
    new Request(new URL(`/api/shop${path}`, incoming.url), { headers: incoming.headers }),
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Store lookup failed (${response.status})`);
  return response.json() as Promise<unknown>;
}
