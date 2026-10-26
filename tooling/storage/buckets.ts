import { AwsClient } from "aws4fetch";

// Development-only credentials match the RustFS service in tooling/docker/compose.dev.yml and CI.
export const rustfs = {
  endpoint: "http://127.0.0.1:9200",
  accessKeyId: "shopper_dev_access",
  secretAccessKey: "shopper_dev_secret_at_least_32_chars",
  region: "us-east-1",
};
const client = new AwsClient({ ...rustfs, service: "s3" });

/** Per-task bucket prefixes; `vp run services:clean` drops leftovers that carry them. */
export const TASK_BUCKET = /^shopper-(?:test|e2e)-[a-z0-9-]+$/;

/** A fresh bucket for one test file, named so the cleanup script recognises it. */
export async function testBucket() {
  const name = `shopper-test-${crypto.randomUUID().replaceAll("-", "")}`;
  await createBucket(name);
  return name;
}

/** Creates the bucket (an existing one is kept) and lets the given browser origins PUT into it. */
export async function createBucket(name: string, origins: string[] = []) {
  const created = await client.fetch(`${rustfs.endpoint}/${name}`, { method: "PUT" });
  if (!created.ok && created.status !== 409)
    throw new Error(`RustFS bucket ${name}: ${created.status} ${await created.text()}`);
  if (!origins.length) return;
  const allowed = origins.map((origin) => `<AllowedOrigin>${origin}</AllowedOrigin>`).join("");
  const cors = await client.fetch(`${rustfs.endpoint}/${name}?cors`, {
    method: "PUT",
    headers: { "content-type": "application/xml" },
    body: `<CORSConfiguration><CORSRule>${allowed}<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>Content-Type</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`,
  });
  if (!cors.ok) throw new Error(`RustFS CORS on ${name}: ${cors.status} ${await cors.text()}`);
}

/** Empties and deletes a bucket; a missing one is already dropped. */
export async function dropBucket(name: string) {
  for (let keys = await listKeys(name); keys.length; keys = await listKeys(name))
    await Promise.all(
      keys.map((key) =>
        client.fetch(`${rustfs.endpoint}/${name}/${encodeKey(key)}`, { method: "DELETE" }),
      ),
    );
  const deleted = await client.fetch(`${rustfs.endpoint}/${name}`, { method: "DELETE" });
  if (!deleted.ok && deleted.status !== 404)
    throw new Error(`RustFS drop ${name}: ${deleted.status} ${await deleted.text()}`);
}

/** Every bucket with its creation time. */
export async function listBuckets() {
  const response = await client.fetch(`${rustfs.endpoint}/`);
  if (!response.ok) throw new Error(`RustFS list: ${response.status} ${await response.text()}`);
  return [...(await response.text()).matchAll(/<Bucket>(.*?)<\/Bucket>/g)].map((bucket) => ({
    name: xmlText(bucket[1]!, "Name"),
    created: new Date(xmlText(bucket[1]!, "CreationDate")),
  }));
}

async function listKeys(name: string) {
  const response = await client.fetch(`${rustfs.endpoint}/${name}?list-type=2`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`RustFS list ${name}: ${response.status}`);
  return [...(await response.text()).matchAll(/<Key>(.*?)<\/Key>/g)].map((key) => decode(key[1]!));
}

const xmlText = (xml: string, tag: string) =>
  decode(xml.match(`<${tag}>(.*?)</${tag}>`)?.[1] ?? "");
const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => entities[name]!);
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
