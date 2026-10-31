// The electron-builder config for the register. `tooling/build/package.ts` writes it next to the staged app.
const signingEnv = [
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "AZURE_TRUSTED_SIGNING_ENDPOINT",
  "AZURE_TRUSTED_SIGNING_ACCOUNT",
  "AZURE_TRUSTED_SIGNING_PROFILE",
  "AZURE_TRUSTED_SIGNING_PUBLISHER",
] as const;

/**
 * NSIS for x64 only: better-sqlite3-multiple-ciphers 13.0.3 ships no win32-ia32 prebuild and nothing is rebuilt for
 * Electron (`npmRebuild: false`), so an ia32 installer could not open its database. One-click and per-user: no UAC
 * prompt, and userData stays `%APPDATA%\Shopper` where till:provision writes. `feed` is SHOPPER_TILL_UPDATE_URL;
 * empty publishes nowhere. Signing reads the Azure app registration from the environment, never from this config.
 */
export function installerConfig(options: {
  channel: "pilot" | "stable";
  sign: boolean;
  feed: string;
  env: Record<string, string | undefined>;
}) {
  const missing = signingEnv.filter((name) => !options.env[name]);
  if (options.sign && missing.length)
    throw new Error(`--sign needs ${missing.join(", ")} in the environment`);
  const signed = missing.length === 0;
  return {
    appId: "com.shopper.register",
    productName: "Shopper",
    asar: true,
    asarUnpack: ["**/*.node", "**/*.wasm"],
    // better-sqlite3-multiple-ciphers and serialport ship prebuilds, so nothing is rebuilt for Electron.
    npmRebuild: false,
    artifactName: "Shopper-Setup-${version}-${arch}.${ext}",
    win: {
      target: [{ target: "nsis", arch: ["x64"] }],
      ...(signed && {
        azureSignOptions: {
          publisherName: options.env.AZURE_TRUSTED_SIGNING_PUBLISHER!,
          endpoint: options.env.AZURE_TRUSTED_SIGNING_ENDPOINT!,
          codeSigningAccountName: options.env.AZURE_TRUSTED_SIGNING_ACCOUNT!,
          certificateProfileName: options.env.AZURE_TRUSTED_SIGNING_PROFILE!,
        },
      }),
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: "Shopper",
    },
    linux: { target: ["dir"], category: "Office" },
    ...(options.feed && {
      publish: [{ provider: "generic", url: `${options.feed}/${options.channel}/` }],
    }),
  };
}
