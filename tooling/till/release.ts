import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { feedStore, readLatest, storeFromEnv, type FeedStore } from "./feed/store";

/**
 * Puts the build in `dir` (electron-builder's release/) on a channel: the installer and its blockmap, then
 * latest.yml last, so the feed never names a file that is not there yet. A version already on the channel is
 * refused (tills never re-download the same version; publish a higher patch), and so is a latest.yml whose
 * sha512 does not match the installer beside it.
 */
export async function releaseTill(options: {
  store: FeedStore;
  channel: "pilot" | "stable";
  dir: string;
}) {
  const feed = feedStore(options.store);
  const yml = await readFile(join(options.dir, "latest.yml"), "utf8");
  const latest = readLatest(yml);
  const installer = await readFile(join(options.dir, latest.path));
  if (createHash("sha512").update(installer).digest("base64") !== latest.sha512)
    throw new Error(`latest.yml's sha512 does not match ${latest.path}`);
  if (await feed.exists(`${options.channel}/${latest.path}`))
    throw new Error(`${latest.version} is already on ${options.channel}`);
  await feed.put(`${options.channel}/${latest.path}`, installer);
  await feed.put(
    `${options.channel}/${latest.path}.blockmap`,
    await readFile(join(options.dir, `${latest.path}.blockmap`)),
  );
  await feed.put(`${options.channel}/latest.yml`, yml);
  return latest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: {
      channel: { type: "string", default: "pilot" },
      dir: { type: "string", default: "apps/till/electron/release" },
    },
  });
  if (values.channel !== "pilot" && values.channel !== "stable")
    throw new Error("Usage: till:release [--channel pilot|stable] [--dir <release folder>]");
  const latest = await releaseTill({
    store: storeFromEnv(),
    channel: values.channel,
    dir: values.dir,
  });
  console.log(`Released ${latest.version} to ${values.channel}`);
}
