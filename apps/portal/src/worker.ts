import { cloudflarePortal } from "@shopper/adapters-cf/portal";
import type { CloudflareRuntimeEnvironment } from "@shopper/adapters-cf/portal";
import server from "./server";

export default {
  fetch(request: Request, env: CloudflareRuntimeEnvironment) {
    return server.fetch(request, {
      context: { portalRuntime: (request) => cloudflarePortal(request, env) },
    });
  },
};
