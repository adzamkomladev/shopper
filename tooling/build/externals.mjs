// The only packages the till bundles leave out: native addons and wasm that read their own files, and the updater and
// Sentry, which load their own files beside the app. The packaged app installs them.
export const runtimeExternals = [
  "electron-updater",
  "@sentry/electron",
  "satori",
  "@resvg/resvg-wasm",
  "better-sqlite3-multiple-ciphers",
  "serialport",
];
