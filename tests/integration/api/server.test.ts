import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { postgresFixture } from "../../fixtures/postgres";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";

const exec = promisify(execFile);
const root = new URL("../../../", import.meta.url);

test("the built Bun entry serves health and fails closed without runtime configuration", async () => {
  const { stdout } = await exec(
    "bun",
    [
      "-e",
      `
    import configuration from "./apps/box/dist/index.js";
    const server = Bun.serve({ ...configuration, port: 0 });
    try {
      const health = await fetch(new URL("/health", server.url));
      const stores = await fetch(new URL("/stores", server.url));
      console.log(JSON.stringify([health.status, stores.status, configuration.idleTimeout]));
    } finally { server.stop(true); }
  `,
    ],
    { cwd: root, env: { ...process.env, DATABASE_URL: "", SHOPPER_AUTH_SECRET: "" } },
  );
  expect(JSON.parse(stdout)).toEqual([200, 503, 30]);
});

test("Bun socket peers determine authentication limits despite forwarded headers", async () => {
  const fixture = await postgresFixture();
  try {
    const db = drizzle(fixture.client, { schema });
    await migrateDatabase(db);
    const tenant = provisioningContext();
    await provisionOrg(db, tenant, { name: "Bun socket test" });
    const { stdout } = await exec(
      "bun",
      [
        "-e",
        `
      import configuration from "./apps/box/dist/index.js";
      const server = Bun.serve({ ...configuration, hostname: "::", port: 0 });
      const statuses = [];
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const peer = attempt === 4 ? "[::1]" : "127.0.0.1";
          const response = await fetch("http://" + peer + ":" + server.port + "/api/auth/sign-in/email", {
            method: "POST",
            headers: { "content-type": "application/json", "X-Forwarded-For": "203.0.113." + attempt,
              "X-Shopper-Client-IP": "203.0.113." + attempt },
            body: JSON.stringify({ email: "missing@socket.invalid", password: "wrong-password" }),
          });
          statuses.push(response.status);
        }
        console.log(JSON.stringify(statuses));
      } finally { server.stop(true); }
      process.exit(0);
    `,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          DATABASE_URL: fixture.connectionString,
          SHOPPER_AUTH_SECRET: "socket-integration-secret-more-than-32-chars",
          SHOPPER_AUTH_URL: "http://localhost",
          SHOPPER_ORG_ID: tenant.orgId,
          SHOPPER_CACHE_PATH: ":memory:",
        },
        timeout: 30000,
      },
    );
    expect(JSON.parse(stdout)).toEqual([401, 401, 401, 429, 401]);
  } finally {
    await fixture.close();
  }
});
