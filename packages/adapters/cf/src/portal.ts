import { servePortal } from "@shopper/api/portal";
import { cloudflareRuntime } from "./runtime";
import type { CloudflareRuntimeEnvironment } from "./runtime/types";
export type { CloudflareRuntimeEnvironment } from "./runtime/types";

export function cloudflarePortal(request: Request, env: CloudflareRuntimeEnvironment) {
  return servePortal(request, (request) => cloudflareRuntime(request, env));
}
