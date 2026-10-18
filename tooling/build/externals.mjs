// The only packages the till bundles leave out: native addons and wasm that read their own files, so the packaged app installs them.
export const runtimeExternals = [
  "satori",
  "@resvg/resvg-wasm",
  "better-sqlite3-multiple-ciphers",
  "serialport",
];
