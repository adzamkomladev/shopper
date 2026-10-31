// The only packages the till bundles leave out: native addons and wasm that read their own files, and the updater, which
// electron-builder expects installed beside the app. The packaged app installs them.
export const runtimeExternals = [
  "electron-updater",
  "satori",
  "@resvg/resvg-wasm",
  "better-sqlite3-multiple-ciphers",
  "serialport",
];
