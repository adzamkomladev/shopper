import { ratePolicies, type RateLimiter, type RatePolicy } from "@shopper/ports";

/**
 * Spends the request's budget on every key that applies; a spent key answers 429 with Retry-After.
 * Only unauthenticated entry points are budgeted; signed-in calls are bounded by their permissions.
 */
export async function enforceRateLimit(
  request: Request,
  limiter: RateLimiter,
  clientIP = "unknown",
  orgId?: string,
) {
  const budget = await budgetOf(request, clientIP, orgId);
  if (!budget) return undefined;
  for (const key of budget.keys)
    if (!(await limiter.limit(budget.policy, key)))
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(ratePolicies[budget.policy].period) } },
      );
  return undefined;
}

async function budgetOf(request: Request, ip: string, orgId?: string) {
  const path = new URL(request.url).pathname;
  const shop = (orgId ?? request.headers.get("X-Shopper-Org") ?? "none").toLowerCase();
  const budget = (policy: RatePolicy, ...keys: string[]) => ({ policy, keys });
  // Hono answers HEAD with the GET handler, so it spends the same budget.
  if (request.method === "GET" || request.method === "HEAD") {
    if (path.startsWith("/public/statements/")) return budget("public", `${ip}:statements`);
    if (/^\/orgs\/[^/]+$/.test(path)) return budget("public", `${ip}:orgs`);
    if (/^\/shop\/[^/]+$/.test(path)) return budget("public", `${ip}:shop`);
    // An order id with the wrong key is a guess at someone's order.
    if (/^\/shop\/[^/]+\/orders\/[^/]+$/.test(path)) return budget("public", `${ip}:shop-order`);
    return undefined;
  }
  if (request.method !== "POST") return undefined;
  if (/^\/shop\/[^/]+\/signin$/.test(path)) return budget("otp", `${ip}:shop-otp`);
  if (/^\/shop\/[^/]+\/orders$/.test(path)) return budget("checkout", `${ip}:checkout`);
  // A payment code starts a provider request too, so it spends the same budget as paying.
  if (/^\/shop\/[^/]+\/orders\/[^/]+\/pay(?:\/code)?$/.test(path))
    return budget("checkout", `${ip}:pay`);
  if (/^\/shop\/[^/]+\/cart$/.test(path)) return budget("public", `${ip}:cart`);
  // A review or a cancel needs the order's key, so a wrong key is a guess at someone's order.
  if (/^\/shop\/[^/]+\/orders\/[^/]+\/(?:review|cancel)$/.test(path))
    return budget("public", `${ip}:shop-order`);
  // Each login also locks itself after five wrong codes; this stops one address cycling through many logins.
  if (/^\/shop\/[^/]+\/signin\/[^/]+\/(?:verify|resend)$/.test(path))
    return budget("auth", `${ip}:shop-code`);
  if (path === "/cashiers/login" || path === "/cashiers/unlock")
    return budget("cashier", `${shop}:${ip}`);
  // Each shop also locks itself after five wrong codes; this budget stops one address spraying many shops.
  if (path === "/devices/enroll") return budget("enrol", ip);
  // Each check-in verifies two signatures before it can be refused.
  if (path === "/licence/confirmations") return budget("public", `${ip}:licence`);
  const operation =
    path.match(
      /^\/api\/auth\/(sign-in|sign-up|forget-password|request-password-reset|reset-password)/,
    )?.[1] ??
    // The last segment names the step (start, verify, resend…); registration ids never become keys.
    path.match(/^\/onboarding\/(?:[^/]+\/)?([^/]+)$/)?.[1] ??
    path.match(/^\/invitations\/[^/]+\/(accept|preview)$/)?.[1];
  if (!operation) return undefined;
  // One account is budgeted on its own too, so spreading guesses over many addresses buys nothing.
  // Better Auth also takes form posts, and a guess in that encoding must spend the same budget.
  const form = request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded");
  const email: unknown = await (
    form
      ? request
          .clone()
          .text()
          .then((body) => new URLSearchParams(body).get("email"))
      : request
          .clone()
          .json()
          .then((body: { email?: unknown } | null) => body?.email)
  ).catch(() => undefined);
  return budget(
    "auth",
    `${ip}:${operation}`,
    ...(typeof email === "string" ? [`${shop}:${email.trim().toLowerCase()}:${operation}`] : []),
  );
}
