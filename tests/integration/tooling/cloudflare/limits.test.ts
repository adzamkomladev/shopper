import { expect, test } from "vite-plus/test";

// Every Worker that serves the API counts against the same namespaces, so a client cannot spread its guesses
// across the edge, portal and admin hosts to get three budgets.
const env = async (app: string) => {
  const config = (await import(`../../../../apps/${app}/cloudflare.config.ts`)).default;
  const bound: Record<string, unknown> = (await config({ mode: "staging" })).worker.env;
  return Object.fromEntries(Object.entries(bound).filter(([name]) => name.startsWith("RATE_")));
};

test.each(["portal", "admin"])(
  "the %s Worker shares the edge's rate-limit bindings",
  async (app) => {
    const edge = await env("edge");
    expect(Object.keys(edge)).toHaveLength(4);
    expect(await env(app)).toEqual(edge);
  },
);
