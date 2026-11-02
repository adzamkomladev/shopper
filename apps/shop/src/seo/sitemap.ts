import * as v from "valibot";
import { storeSitemap } from "../schemas/store";

type ShopApi = (request: Request) => Promise<Response>;

/** Every shop's store is indexable; the shopper's own pages and the API are not. */
export function robots() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /*/account",
      "Disallow: /*/signin",
      "Disallow: /*/receipts/",
      "",
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}

/** One shop's sitemap: its store, each category and each product the store shows online. */
export async function sitemap(request: Request, code: string, shopApi: ShopApi) {
  const origin = new URL(request.url).origin;
  const response = await shopApi(
    new Request(new URL(`/api/shop/${encodeURIComponent(code)}/sitemap`, origin), {
      headers: request.headers,
    }),
  );
  if (response.status === 404) return new Response("Not found", { status: 404 });
  if (!response.ok) return new Response("Sitemap unavailable", { status: 503 });
  const found = v.parse(storeSitemap, await response.json());
  const base = `${origin}/${encodeURIComponent(code.toLowerCase())}`;
  const urls = [
    base,
    ...found.categories.map((row) => `${base}/categories/${row.id}`),
    ...found.products.map((row) => `${base}/products/${row.id}`),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${url}</loc></url>`)
      .join("\n")}\n</urlset>\n`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
