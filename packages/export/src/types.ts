/** A file to write into a ZIP: `bytes` and `crc` were measured when it was made, `read` gives it back on demand. */
export type ZipEntry = {
  path: string;
  bytes: number;
  crc: number;
  read: () => Promise<Uint8Array>;
};

/** One file of an archive as measured when it was written, so nothing has to hold the archive to describe it. */
export type FileDescription = {
  path: string;
  bytes: number;
  sha256: string;
  crc: number;
  rows: number;
};
