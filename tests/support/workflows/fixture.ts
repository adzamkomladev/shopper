import { expect, vi } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxAuthFlows } from "@shopper/adapters-box";

export function authLauncherFixture(
  connectionString: string,
  options: { linkSecret: string; baseURL: string; now?: () => number },
) {
  const pool = new Pool({ connectionString });
  const database = drizzle(pool, { schema });
  const launcher = boxAuthFlows({ ...options, withDatabase: (run) => run(database) });
  const runs = async () => [
    ...(await database.select().from(schema.registrationWorkflowRun)),
    ...(await database
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.type, "invitation"))),
  ];
  return {
    database,
    launcher,
    async close() {
      const started = await runs();
      for (const row of started)
        if (row.status !== "completed" && row.status !== "failed")
          await launcher.send(row.instanceId, "auth-action", { action: "completed" });
      await vi.waitFor(
        async () =>
          expect(
            (await runs()).every((row) => row.status === "completed" || row.status === "failed"),
          ).toBe(true),
        { timeout: 10000 },
      );
      await pool.end();
    },
  };
}
