import { createServerFn } from "@tanstack/react-start";

/** Host-only data. Backoffice data stays on the shared `/api` so the box SPA and Electron reuse it. */
export const readPortalHost = createServerFn({ method: "GET" }).handler(({ context }) =>
  context.portalHost(),
);

export const checkPortalHealth = createServerFn({ method: "GET" }).handler(({ context }) =>
  context.portalHealth(),
);
