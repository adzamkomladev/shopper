import { createStart } from "@tanstack/react-start";

// Shared backoffice loaders use the browser's selected shop and the same-origin API, so routes
// render after hydration; the server only sends the document shell.
export const startInstance = createStart(() => ({ defaultSsr: false }));
