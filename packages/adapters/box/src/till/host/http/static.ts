import { existsSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";

/**
 * Serves the built till UI; unknown routes fall back to the SPA shell (the back office has its own).
 * A missing file (last segment has an extension) stays a 404. serveStatic itself rejects `..`.
 */
export function serveTillUi(root: string) {
  const backoffice = existsSync(join(root, "backoffice/index.html"));
  return serveStatic({
    root,
    rewriteRequestPath: (path) =>
      existsSync(join(root, path)) || /\.[^/]+$/.test(path)
        ? path
        : backoffice && path.startsWith("/backoffice/")
          ? "/backoffice/index.html"
          : "/index.html",
  });
}
