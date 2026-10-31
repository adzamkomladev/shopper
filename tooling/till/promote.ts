import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feedStore, readLatest, storeFromEnv, type FeedStore } from "./feed/store";

/**
 * Stages a pilot release to stable: copies pilot's current installer, blockmap and latest.yml (last) to stable/, and
 * rewrites the stable download alias the portal links to. Rolling back is promoting a higher patch: electron-updater
 * never downgrades a till.
 */
export async function promoteTill(options: { store: FeedStore }) {
  const feed = feedStore(options.store);
  const latest = readLatest(await feed.read("pilot/latest.yml"));
  await feed.copy(`pilot/${latest.path}`, `stable/${latest.path}`);
  await feed.copy(`pilot/${latest.path}.blockmap`, `stable/${latest.path}.blockmap`);
  await feed.copy(`pilot/${latest.path}`, "stable/Shopper-Setup-x64.exe");
  await feed.copy("pilot/latest.yml", "stable/latest.yml");
  return latest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const latest = await promoteTill({ store: storeFromEnv() });
  console.log(`Promoted ${latest.version} to stable`);
}
