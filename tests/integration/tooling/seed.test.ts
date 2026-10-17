/// <reference types="node" />
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { postgresFixture } from "../../fixtures/postgres";

// better-auth is a dependency of @shopper/auth, not of the repo root.
const crypto = createRequire(new URL("../../../packages/auth/package.json", import.meta.url));
const { verifyPassword } = (await import(
  pathToFileURL(crypto.resolve("better-auth/crypto")).href
)) as {
  verifyPassword(input: { hash: string; password: string }): Promise<boolean>;
};
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
beforeAll(async () => {
  fixture = await postgresFixture();
});
afterAll(() => fixture.close());

const cli = (args: string[], url: string, env: Record<string, string> = {}) =>
  spawnSync("vp", ["exec", "tsx", "tooling/database/cli.ts", ...args], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: url, ...env },
  });
const rows = async (sql: string) => (await fixture.client.query(sql)).rows;

test("reset then seed builds role users, branches and a verifiable password; reset twice stays clean", async () => {
  for (let run = 0; run < 2; run++) {
    const result = cli(["reset", "--products", "50"], fixture.connectionString);
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain("Admin@12345");
    // reset dropped the previous connection's tables; the fixture client sees the new ones
    const orgs = await rows("SELECT name, slug FROM org ORDER BY slug");
    expect(orgs.map((org) => org.slug)).toEqual(["dev", "dev-two"]);
    const users = await rows(
      `SELECT u.email, r.name AS role, a.password FROM "user" u
       JOIN member m ON m.user_id = u.id JOIN role r ON r.id = m.role_id
       JOIN account a ON a.user_id = u.id JOIN org o ON o.id = u.org_id WHERE o.slug = 'dev'`,
    );
    expect(users.map((user) => user.role as string).sort((a, b) => a.localeCompare(b))).toEqual([
      "accountant",
      "admin",
      "cashier",
      "inventory",
      "superadmin",
    ]);
    const emails = (await rows(`SELECT email FROM "user"`)).map((user) => user.email as string);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) {
      const n = Number(/^adzamkomla\.dev\+(\d{3,4})@gmail\.com$/.exec(email)?.[1]);
      expect(n).toBeGreaterThanOrEqual(300);
      expect(n).toBeLessThanOrEqual(2000);
    }
    for (const user of users)
      expect(await verifyPassword({ hash: user.password, password: "Admin@12345" })).toBe(true);
    const branches = await rows(
      `SELECT b.name FROM branch b JOIN org o ON o.id = b.org_id WHERE o.slug = 'dev' ORDER BY b.name`,
    );
    expect(branches.map((branch) => branch.name)).toEqual(["Accra Central", "Kumasi Adum", "Osu"]);
    expect(
      await rows(`SELECT 1 FROM product p JOIN org o ON o.id = p.org_id WHERE o.slug='dev'`),
    ).toHaveLength(50);
  }
}, 120_000);

test("reset and seed refuse remote databases unless the exact host is confirmed", () => {
  const remote = "postgresql://u:p@db.example.com:5432/shopper";
  for (const action of ["reset", "seed"]) {
    const refused = cli([action], remote);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("--confirm db.example.com");
    const wrong = cli([action, "--confirm", "other.example.com"], remote);
    expect(wrong.status).toBe(1);
  }
  // pg takes the host from ?host=, so the URL's own hostname must never decide "local".
  const disguised = cli(["reset"], "postgresql://u:p@localhost/shopper?host=db.example.com");
  expect(disguised.status).toBe(1);
  expect(disguised.stderr).toContain("db.example.com");
});

test("anything that looks like production is refused even when confirmed", () => {
  const confirm = ["reset", "--confirm", "db.example.com"];
  const marked = cli(confirm, "postgresql://u:p@db.example.com/shopper", {
    SHOPPER_ENVIRONMENT: "production",
  });
  expect(marked.status).toBe(1);
  expect(marked.stderr).toContain("production");
  const named = cli(confirm, "postgresql://u:p@db.example.com/shopper_prod");
  expect(named.status).toBe(1);
  expect(named.stderr).toContain("production");
});
