import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

type Options = {
  upstream: string;
  org: string;
  code: string;
  name: string;
  store: string;
  shop: string;
  out: string;
  port?: number;
  fetch?: (url: string, init: RequestInit) => Response | Promise<Response>;
};

/** Redeems an enrollment code and writes the private register.json; Electron seals the token on its first start. */
export async function provision(options: Options) {
  const response = await (options.fetch ?? fetch)(`${options.upstream}/devices/enroll`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId: options.org, code: options.code, name: options.name }),
  });
  if (!response.ok) throw new Error(`Enrollment failed (${response.status})`);
  const enrolled = (await response.json()) as {
    deviceId: string;
    branchId: string;
    deviceToken: string;
    receiptCodes: unknown;
  };
  const config = {
    identity: {
      orgId: options.org,
      deviceId: enrolled.deviceId,
      storeId: options.store,
      branchId: enrolled.branchId,
      shopName: options.shop,
      registerName: options.name,
    },
    upstream: options.upstream,
    deviceToken: enrolled.deviceToken,
    receiptCodes: enrolled.receiptCodes,
    session: null,
    sqlitePath: join(dirname(options.out), "register.sqlite"),
    origins: [],
    port: options.port ?? 0,
  };
  await mkdir(dirname(options.out), { recursive: true });
  await writeFile(options.out, JSON.stringify(config, null, 2), { mode: 0o600 });
  return config;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      upstream: { type: "string" },
      org: { type: "string" },
      code: { type: "string" },
      name: { type: "string", default: "Register 1" },
      store: { type: "string" },
      shop: { type: "string" },
      out: { type: "string" },
    },
  });
  const { upstream, org, code, store, shop } = values;
  if (!upstream || !org || !code || !store || !shop)
    throw new Error(
      "Usage: till:provision --upstream <api url> --org <id> --code <6 digits> --store <id> --shop <name> [--name <register>] [--out <register.json>]",
    );
  // Electron's userData for productName "Shopper" (Windows: %APPDATA%\Shopper).
  const userData =
    process.platform === "win32"
      ? join(process.env.APPDATA ?? homedir(), "Shopper")
      : process.platform === "darwin"
        ? join(homedir(), "Library/Application Support/Shopper")
        : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "Shopper");
  const out = values.out ?? join(userData, "register.json");
  await provision({ upstream, org, code, store, shop, name: values.name!, out });
  console.log(`Wrote ${out}`);
}
