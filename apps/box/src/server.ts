import { createBoxApp } from "./app";

export const app = createBoxApp();
// Bun starts this configuration when running the entry point or compiled binary.
export default { port: Number(process.env.PORT ?? 3001), idleTimeout: 30, fetch: app.fetch };
