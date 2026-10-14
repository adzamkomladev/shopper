import * as v from "valibot";
import { portalAuthResponse } from "./schemas/portal";

export async function servePortal(
  request: Request,
  run: (request: Request) => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  const authPath = url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/");
  if (
    authPath &&
    !/^\/api\/auth\/(?:sign-in\/email|sign-up\/email|get-session|sign-out)$/.test(url.pathname)
  )
    return Response.json(
      { error: "Record not found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  if (url.pathname !== "/api/auth" && !url.pathname.startsWith("/api/auth/")) {
    if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
      url.pathname = url.pathname.slice(4) || "/";
  }
  const response = await run(new Request(url, request));
  if (authPath) response.headers.set("cache-control", "no-store");
  if (
    !response.ok ||
    !/^\/api\/auth\/(?:sign-in\/email|sign-up\/email|get-session)$/.test(url.pathname)
  )
    return response;
  const parsed = v.safeParse(portalAuthResponse, await response.json());
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  if (!parsed.success)
    return Response.json({ error: "Invalid authentication response" }, { status: 502, headers });
  return Response.json(parsed.output, { status: response.status, headers });
}
