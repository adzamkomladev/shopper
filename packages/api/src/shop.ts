export type { ShopContext } from "./types";

/**
 * The shop Worker's `/api/*`: only the shopper routes pass, without the `/api` prefix. Nothing is cached but the
 * public store's replies, which say so themselves.
 * Back-office and till routes are never reachable from a shop origin.
 */
export async function serveShop(
  request: Request,
  run: (request: Request) => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  if (!/^\/api\/shop(?:\/|$)/.test(url.pathname))
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  url.pathname = url.pathname.slice("/api".length);
  const response = await run(new Request(url, request));
  const headers = new Headers(response.headers);
  // Only the public store marks a reply public; everything else is the shopper's own and is never cached.
  if (!response.headers.get("cache-control")?.startsWith("public"))
    headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}
