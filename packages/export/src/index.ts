export { buildManifest, describeFile, signManifest } from "./manifest";
export { ARCHIVE_FORMAT, type Manifest } from "./schemas/manifest";
export type { FileDescription, ZipEntry } from "./types";
export { verifyArchive } from "./verify";
export { crc32, readZip, zipBytes, zipLength, zipStream } from "./zip";
