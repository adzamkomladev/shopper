import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";

const start = createStartHandler(defaultStreamHandler);

export default createServerEntry({
  fetch(request, options) {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) {
      return options.context.portalRuntime(request);
    }
    return start(request, options);
  },
});
