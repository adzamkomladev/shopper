const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Refuses a write a browser may have sent on another site's behalf. A write that carries a cookie must come
 * from this origin: an `Origin` naming it, or `Sec-Fetch-Site: same-origin` when a browser leaves Origin out.
 * Callers without a cookie (devices with bearer tokens, payment webhooks) cannot ride a session, so pass.
 */
export function refuseCrossSite(request: Request, baseURL: string) {
  if (SAFE_METHODS.has(request.method)) return undefined;
  const origin = request.headers.get("Origin");
  const trusted = new URL(baseURL).origin;
  const sameSite =
    origin === trusted || (!origin && request.headers.get("Sec-Fetch-Site") === "same-origin");
  // A foreign Origin is refused with or without a cookie, as it always was.
  if (sameSite || (!origin && !request.headers.has("cookie"))) return undefined;
  return Response.json({ error: "Origin is not allowed" }, { status: 403 });
}

/** Headers every API answer carries; signed-in answers are never cached by a browser or a proxy. */
export function secureHeaders(request: Request, response: Response, baseURL: string) {
  // A WebSocket upgrade's headers are already on the wire.
  if (response.status === 101) return response;
  const hardened = new Response(response.body, response);
  hardened.headers.set("X-Content-Type-Options", "nosniff");
  hardened.headers.set("Referrer-Policy", "no-referrer");
  hardened.headers.set("X-Frame-Options", "DENY");
  if (baseURL.startsWith("https://"))
    hardened.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // A route that chose its own caching (a receipt image, say) keeps it.
  const signedIn = request.headers.has("cookie") || request.headers.has("authorization");
  if (signedIn && !hardened.headers.has("Cache-Control"))
    hardened.headers.set("Cache-Control", "no-store");
  return hardened;
}
