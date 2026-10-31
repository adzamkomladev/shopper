import { AwsClient } from "aws4fetch";

/** The R2 bucket the till feed lives in, reached over its S3 API (RustFS in tests). */
export type FeedStore = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

/**
 * Object access for the release scripts. latest.yml and the download alias are never cached, so a promotion or a
 * new release reaches every till and browser at once; versioned installers never change, so they cache forever.
 */
export function feedStore(store: FeedStore) {
  const client = new AwsClient({ ...store, service: "s3" });
  const url = (key: string) => `${store.endpoint}/${store.bucket}/${key}`;
  const cacheControl = (key: string) =>
    /(latest\.yml|Shopper-Setup-x64\.exe)$/.test(key)
      ? "no-cache"
      : "public, max-age=31536000, immutable";
  const check = async (response: Response, what: string) => {
    if (!response.ok) throw new Error(`${what}: ${response.status} ${await response.text()}`);
    return response;
  };
  return {
    async exists(key: string) {
      const response = await client.fetch(url(key), { method: "HEAD" });
      if (response.status === 404) return false;
      await check(response, `HEAD ${key}`);
      return true;
    },
    async read(key: string) {
      return (await check(await client.fetch(url(key)), `GET ${key}`)).text();
    },
    async put(key: string, body: Uint8Array | string) {
      await check(
        await client.fetch(url(key), {
          method: "PUT",
          body,
          headers: { "cache-control": cacheControl(key) },
        }),
        `PUT ${key}`,
      );
    },
    async copy(from: string, to: string) {
      await check(
        await client.fetch(url(to), {
          method: "PUT",
          headers: {
            "x-amz-copy-source": `/${store.bucket}/${from}`,
            "x-amz-metadata-directive": "REPLACE",
            "cache-control": cacheControl(to),
          },
        }),
        `COPY ${from} to ${to}`,
      );
    },
  };
}

/** The version and installer a latest.yml names, read from electron-builder's flat layout. */
export function readLatest(yml: string) {
  const field = (name: string) => {
    const value = new RegExp(`^${name}: '?([^'\n]+)'?$`, "m").exec(yml)?.[1];
    if (!value) throw new Error(`latest.yml has no ${name}`);
    return value;
  };
  return { version: field("version"), path: field("path"), sha512: field("sha512") };
}

/** The bucket from the environment: R2's S3 endpoint and a token scoped to the releases bucket. */
export function storeFromEnv(env = process.env): FeedStore {
  const missing = [
    "SHOPPER_TILL_RELEASE_ENDPOINT",
    "SHOPPER_TILL_RELEASE_ACCESS_KEY_ID",
    "SHOPPER_TILL_RELEASE_SECRET_ACCESS_KEY",
  ].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Set ${missing.join(", ")}`);
  return {
    endpoint: env.SHOPPER_TILL_RELEASE_ENDPOINT!,
    bucket: env.SHOPPER_TILL_RELEASE_BUCKET ?? "shopper-till-releases",
    accessKeyId: env.SHOPPER_TILL_RELEASE_ACCESS_KEY_ID!,
    secretAccessKey: env.SHOPPER_TILL_RELEASE_SECRET_ACCESS_KEY!,
    region: "auto",
  };
}
