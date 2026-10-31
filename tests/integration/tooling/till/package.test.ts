// The electron-builder config the packaging script generates: an NSIS installer per architecture, a generic publish
// feed per channel, the artifact name the release script uploads, and Azure Trusted Signing only when its
// environment is there (asking to sign without it fails loudly rather than shipping an unsigned installer).
import { expect, test } from "vite-plus/test";
import { installerConfig } from "../../../../tooling/build/installer";

const signing = {
  AZURE_TENANT_ID: "tenant",
  AZURE_CLIENT_ID: "client",
  AZURE_CLIENT_SECRET: "secret",
  AZURE_TRUSTED_SIGNING_ENDPOINT: "https://weu.codesigning.azure.net/",
  AZURE_TRUSTED_SIGNING_ACCOUNT: "shopper",
  AZURE_TRUSTED_SIGNING_PROFILE: "shopper-public",
  AZURE_TRUSTED_SIGNING_PUBLISHER: "CN=Shopper Ltd, O=Shopper Ltd, C=GH",
};
const feed = "https://releases.shopper.example";

test("an unsigned pilot build: NSIS x64, the pilot feed, and the release artifact name", () => {
  const config = installerConfig({ channel: "pilot", sign: false, feed, env: {} });
  // better-sqlite3-multiple-ciphers 13.0.3 ships no win32-ia32 prebuild, so ia32 is not built.
  expect(config.win.target).toEqual([{ target: "nsis", arch: ["x64"] }]);
  expect(config.artifactName).toBe("Shopper-Setup-${version}-${arch}.${ext}");
  expect(config.publish).toEqual([{ provider: "generic", url: `${feed}/pilot/` }]);
  expect(config.nsis).toMatchObject({ oneClick: true, perMachine: false });
  expect(config.win).not.toHaveProperty("azureSignOptions");
});

test("the stable channel publishes to the stable feed", () => {
  expect(installerConfig({ channel: "stable", sign: false, feed, env: {} }).publish).toEqual([
    { provider: "generic", url: `${feed}/stable/` },
  ]);
});

test("the signing environment adds Azure Trusted Signing; its secrets stay in the environment", () => {
  const config = installerConfig({ channel: "pilot", sign: false, feed, env: signing });
  expect(config.win.azureSignOptions).toEqual({
    publisherName: signing.AZURE_TRUSTED_SIGNING_PUBLISHER,
    endpoint: signing.AZURE_TRUSTED_SIGNING_ENDPOINT,
    codeSigningAccountName: signing.AZURE_TRUSTED_SIGNING_ACCOUNT,
    certificateProfileName: signing.AZURE_TRUSTED_SIGNING_PROFILE,
  });
  expect(JSON.stringify(config)).not.toContain(signing.AZURE_CLIENT_SECRET);
});

test("--sign without the signing environment fails, naming what is missing", () => {
  const { AZURE_CLIENT_SECRET: _secret, ...partial } = signing;
  expect(() => installerConfig({ channel: "pilot", sign: true, feed, env: partial })).toThrow(
    /AZURE_CLIENT_SECRET/,
  );
});

test("a build with no feed configured publishes nowhere", () => {
  expect(installerConfig({ channel: "stable", sign: false, feed: "", env: {} })).not.toHaveProperty(
    "publish",
  );
});
