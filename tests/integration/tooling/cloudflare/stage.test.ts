// Each Worker's config per stage: production is its own Worker, domain and resources, never staging's.
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";

type Built = { worker: { name: string; domains?: string[]; env: Record<string, any> } };
// Each app's cloudflare.config.ts is a function of the build mode; `cf build` calls it the same way.
const resolve = async (app: string, mode: string) => {
  const url = pathToFileURL(resolvePath(`apps/${app}/cloudflare.config.ts`)).href;
  const config = (await import(url)).default as (context: { mode: string }) => Built;
  return config({ mode }).worker;
};

const apps = [
  { name: "edge", domain: "shopper-api.temtem.dev" },
  { name: "portal", domain: "shopper.temtem.dev" },
  { name: "admin", domain: "shopper-admin.temtem.dev" },
];

for (const app of apps) {
  test(`${app.name}: mode prod is the production Worker on ${app.domain}`, async () => {
    const worker = await resolve(app.name, "prod");
    expect(worker.name).toBe(`shopper-${app.name}-production`);
    expect(worker.domains).toEqual([app.domain]);
    const named = Object.values(worker.env)
      .map((binding) => binding.name ?? binding.worker)
      .filter((value): value is string => typeof value === "string");
    expect(named.length).toBeGreaterThan(0);
    for (const value of named) expect(value).not.toMatch(/staging|dev$/);
    if (worker.env.SHOPPER_AUTH_URL?.type === "text")
      expect(worker.env.SHOPPER_AUTH_URL.value).toBe(`https://${app.domain}`);
  });

  // `vite build` runs in mode "production" by default; that must stay a dev build, never a release.
  test(`${app.name}: the default build mode is not a release`, async () => {
    expect((await resolve(app.name, "production")).name).toBe(`shopper-${app.name}-dev`);
    expect((await resolve(app.name, "staging")).name).toBe(`shopper-${app.name}-staging`);
  });
}
