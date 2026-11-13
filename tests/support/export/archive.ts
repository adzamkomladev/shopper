import { generateKey } from "@shopper/core/licence";
import { buildManifest, describeFile, signManifest, zipBytes } from "@shopper/export";

const encoder = new TextEncoder();

/** A small archive of in-memory files, sealed the way the export workflow seals the parts it wrote. */
export async function sealedArchive(
  options: { format?: number; key?: Awaited<ReturnType<typeof generateKey>> } = {},
) {
  const key = options.key ?? (await generateKey());
  const files = {
    "tables/product/0001.ndjson": encoder.encode(
      '{"id":"a","name":"Rice"}\n{"id":"b","name":"Oil"}\n',
    ),
    "tables/product/0002.ndjson": encoder.encode('{"id":"c","name":"Sugar"}\n'),
    "tables/sale/0001.ndjson": encoder.encode('{"id":"s1","total":123400}\n'),
    "blobs/products/a.png": Uint8Array.from([137, 80, 78, 71, 0, 1, 2, 3]),
  };
  const described = await Promise.all(
    Object.entries(files).map(([path, bytes]) => describeFile(path, bytes)),
  );
  const manifest = buildManifest(
    {
      productVersion: "1.0.0",
      schemaVersion: 43,
      org: { id: "0197a000-0000-7000-8000-000000000001", name: "Kofi Mart", slug: "kofi-mart" },
      createdAt: "2026-11-14T08:00:00.000Z",
      publicKey: key.publicKey,
    },
    described,
  );
  if (options.format) (manifest as { archive_format: number }).archive_format = options.format;
  const signed = await signManifest(manifest, key.privateKey);
  const entries = [
    ...described.map((file) => ({
      ...file,
      read: async () => files[file.path as keyof typeof files]!,
    })),
    { ...(await describeFile("manifest.json", signed.json)), read: async () => signed.json },
    {
      ...(await describeFile("manifest.sig", encoder.encode(signed.signature))),
      read: async () => encoder.encode(signed.signature),
    },
  ];
  return { bytes: await zipBytes(entries), key, manifest, files };
}
