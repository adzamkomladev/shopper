import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Packs every file under each folder, named `<prefix>/<path inside the folder>`, into one blob: a 4-byte header
 * length, a JSON index of `[offset, length]`, then the bytes.
 */
export async function packFolders(folders: Record<string, string>) {
  const files = (
    await Promise.all(
      Object.entries(folders).map(async ([prefix, folder]) =>
        (await readdir(folder, { recursive: true, withFileTypes: true }))
          .filter((entry) => entry.isFile())
          .map((entry) => ({
            name: `${prefix}/${join(entry.parentPath, entry.name).slice(folder.length + 1)}`.replaceAll(
              "\\",
              "/",
            ),
            path: join(entry.parentPath, entry.name),
          })),
      ),
    )
  ).flat();
  const bodies = await Promise.all(files.map((file) => readFile(file.path)));
  let offset = 0;
  const index = Object.fromEntries(
    files.map((file, position) => {
      const entry = [offset, bodies[position]!.length];
      offset += bodies[position]!.length;
      return [file.name, entry];
    }),
  );
  const header = new TextEncoder().encode(JSON.stringify(index));
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, header.length);
  return Buffer.concat([prefix, header, ...bodies]);
}

export async function openPack(blob: Blob) {
  const length = new DataView(await blob.slice(0, 4).arrayBuffer()).getUint32(0);
  const index = JSON.parse(await blob.slice(4, 4 + length).text()) as Record<
    string,
    [number, number]
  >;
  const base = 4 + length;
  return {
    names: Object.keys(index),
    /** The file's bytes, or undefined when the pack does not hold it. Lookups are exact: there is no path to escape. */
    file: (name: string) =>
      Object.hasOwn(index, name)
        ? blob.slice(base + index[name]![0], base + index[name]![0] + index[name]![1])
        : undefined,
  };
}

/** The pack `bun build --compile` embedded as `payload.bin`; undefined when running from source. */
export function embeddedPack() {
  const bun = (globalThis as { Bun?: { embeddedFiles: Blob[] } }).Bun;
  const blob = bun?.embeddedFiles.find((file) => (file as File).name === "payload.bin");
  return blob && openPack(blob);
}
