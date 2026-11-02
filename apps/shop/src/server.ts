import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { robots, sitemap } from "./seo/sitemap";

const start = createStartHandler(defaultStreamHandler);

export default createServerEntry({
  fetch(request, options) {
    const path = new URL(request.url).pathname;
    // The browser calls the shopper API at this origin, so its session cookie stays first-party.
    if (path === "/api" || path.startsWith("/api/")) return options.context.shopApi(request);
    if (path === "/robots.txt") return robots();
    const map = /^\/([^/]+)\/sitemap\.xml$/.exec(path);
    if (map) return sitemap(request, decodeURIComponent(map[1]!), options.context.shopApi);
    return start(request, options);
  },
});
