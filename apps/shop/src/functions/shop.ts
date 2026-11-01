import * as v from "valibot";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { shopCodeParam, shopInfo } from "../schemas/shop";

/**
 * The shop a link names, read on the server so the page renders with its name; null when no shop has the code.
 * The shopper's own data never renders here: it loads in the browser with the session cookie.
 */
export const readShop = createServerFn({ method: "GET" })
  .validator((code: unknown) => v.parse(shopCodeParam, code))
  .handler(async ({ context, data }) => {
    const incoming = getRequest();
    // The client's address travels on, so the public lookup budget stays per shopper.
    const response = await context.shopApi(
      new Request(new URL(`/api/shop/${encodeURIComponent(data)}`, incoming.url), {
        headers: incoming.headers,
      }),
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Shop lookup failed (${response.status})`);
    return {
      ...v.parse(shopInfo, await response.json()),
      turnstileSiteKey: process.env.TURNSTILE_SITEKEY || null,
    };
  });
