export function cloudflarePortal(
  request: Request,
  bindings: { API?: Pick<Fetcher, "fetch">; ASSETS: Pick<Fetcher, "fetch"> },
) {
  const url = new URL(request.url);
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/"))
    return bindings.ASSETS.fetch(request);
  if (!bindings.API) return new Response("Portal API unavailable", { status: 503 });
  if (url.pathname !== "/api/auth" && !url.pathname.startsWith("/api/auth/"))
    url.pathname = url.pathname.slice(4) || "/";
  return bindings.API.fetch(new Request(url, request));
}
