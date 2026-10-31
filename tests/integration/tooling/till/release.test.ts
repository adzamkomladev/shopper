// The till release feed against local RustFS (the same S3 API R2 speaks): till:release puts a build on pilot/, refuses
// a version already there, and till:promote copies pilot's current release to stable/ with the download alias the
// portal links to. The feed's latest.yml must describe the bytes actually uploaded.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { dropBucket, rustfs, testBucket } from "../../../support/assets/rustfs";
import { releaseTill } from "../../../../tooling/till/release";
import { promoteTill } from "../../../../tooling/till/promote";

let bucket = "";
let directory = "";
const client = new AwsClient({ ...rustfs, service: "s3" });
const store = () => ({ ...rustfs, bucket });
const read = async (key: string) => {
  const response = await client.fetch(`${rustfs.endpoint}/${bucket}/${key}`);
  return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
};
beforeAll(async () => {
  bucket = await testBucket();
  directory = await mkdtemp(join(tmpdir(), "shopper-release-"));
});
afterAll(async () => {
  await dropBucket(bucket);
  await rm(directory, { recursive: true, force: true });
});

/** What electron-builder leaves in release/: the installer, its blockmap and latest.yml naming both. */
async function build(version: string, digestOf = (bytes: Buffer) => bytes) {
  const installer = Buffer.from(`installer ${version} ${crypto.randomUUID()}`);
  const name = `Shopper-Setup-${version}-x64.exe`;
  const sha512 = createHash("sha512").update(digestOf(installer)).digest("base64");
  const out = join(directory, version);
  await rm(out, { recursive: true, force: true });
  await mkdir(out);
  await writeFile(join(out, name), installer);
  await writeFile(join(out, `${name}.blockmap`), `blockmap ${version}`);
  await writeFile(
    join(out, "latest.yml"),
    `version: ${version}\nfiles:\n  - url: ${name}\n    sha512: ${sha512}\n    size: ${installer.length}\npath: ${name}\nsha512: ${sha512}\nreleaseDate: '2026-10-31T00:00:00.000Z'\n`,
  );
  return { out, name, installer };
}

test("a release lands on pilot with a latest.yml whose sha512 matches the uploaded installer", async () => {
  const { out, name, installer } = await build("0.1.0");
  await releaseTill({ store: store(), channel: "pilot", dir: out });
  const uploaded = await read(`pilot/${name}`);
  expect(uploaded).toEqual(installer);
  expect((await read(`pilot/${name}.blockmap`))?.toString()).toBe("blockmap 0.1.0");
  const yml = (await read("pilot/latest.yml"))!.toString();
  expect(yml).toContain("version: 0.1.0");
  expect(yml).toContain(`sha512: ${createHash("sha512").update(uploaded!).digest("base64")}`);
  expect(await read("stable/latest.yml")).toBeNull();
});

test("a version already on the channel is refused and the feed is unchanged", async () => {
  const before = await read("pilot/latest.yml");
  const { out } = await build("0.1.0");
  await expect(releaseTill({ store: store(), channel: "pilot", dir: out })).rejects.toThrow(
    /0\.1\.0 is already on pilot/,
  );
  expect(await read("pilot/latest.yml")).toEqual(before);
});

test("a latest.yml that does not describe the installer is refused before anything uploads", async () => {
  const { out, name } = await build("0.1.9", (bytes) => Buffer.concat([bytes, Buffer.from("x")]));
  await expect(releaseTill({ store: store(), channel: "pilot", dir: out })).rejects.toThrow(
    /sha512/,
  );
  expect(await read(`pilot/${name}`)).toBeNull();
});

test("promote copies pilot's current release to stable and points the download alias at it", async () => {
  const { out, name, installer } = await build("0.1.1");
  await releaseTill({ store: store(), channel: "pilot", dir: out });
  await promoteTill({ store: store() });
  expect(await read(`stable/${name}`)).toEqual(installer);
  expect(await read(`stable/${name}.blockmap`)).toEqual(await read(`pilot/${name}.blockmap`));
  expect(await read("stable/latest.yml")).toEqual(await read("pilot/latest.yml"));
  expect(await read("stable/Shopper-Setup-x64.exe")).toEqual(installer);
});
