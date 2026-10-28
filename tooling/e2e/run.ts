/**
 * Where one e2e run lives on the shared dev containers. `SHOPPER_RUN_ID` names the run and gives it
 * its own database, bucket, ports and build folders, so several sessions can run e2e at once.
 * Unset, every value is the fixed default the suite has always used.
 */
const id = process.env.SHOPPER_RUN_ID || undefined;
if (id && !/^[a-z0-9]{1,20}$/.test(id))
  throw new Error(`SHOPPER_RUN_ID "${id}" must be 1-20 lowercase letters or digits`);

/** Every run's folders live under here; teardown and `vp run services:clean` remove them. */
export const RUNS = ".shopper/runs";
/** Apps a run builds into `<app>/.runs/<id>`. */
export const BUILT_APPS = [
  "apps/box",
  "apps/portal",
  "apps/admin",
  "apps/till/host",
  "apps/till/electron",
];

// One of 90 port blocks, 10 apart: the run's 3101-3105 and 5183-5187 ports shift together and stay below
// Rivet (6420). Two ids share a block about once in 90; pick another id if the ports are taken.
const offset = id ? ((fnv(id) % 90) + 1) * 10 : 0;
/** The run's own copy of a path under `.shopper/runs/<id>`; the default path when unset. */
const path = (fallback: string, name: string) => (id ? `${RUNS}/${id}/${name}` : fallback);

export const e2eRun = {
  id,
  port: (base: number) => base + offset,
  url: (base: number) => `http://localhost:${base + offset}`,
  database: id ? `shopper_${id}_e2e` : "shopper_e2e",
  bucket: id ? `shopper-e2e-${id}` : "shopper-imports-dev",
  path,
  /** Bundles of the e2e portal, admin and public API hosts (tests/support). */
  portalHost: path(".shopper/portal/e2e", "portal/build"),
  adminHost: path(".shopper/admin/e2e", "admin/build"),
  publicHost: path(".shopper/public-e2e", "public/build"),
  ownerState: path("tests/e2e/.auth/owner.json", "auth/owner.json"),
  /**
   * An app's build folder, relative to the app. A run builds into `<app>/.runs/<id>` rather than
   * under `.shopper/`, so its bundles still resolve the app's own node_modules.
   */
  outDir: id ? `.runs/${id}` : "dist",
};

function fnv(text: string) {
  const bytes = new TextEncoder().encode(text);
  return bytes.reduce((hash, byte) => Math.imul(hash ^ byte, 16777619), 2166136261) >>> 0;
}
