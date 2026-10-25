import { DurableObject } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import {
  createSdc,
  laneBackoff,
  strandedFiscalDocs,
  submitFiscalDoc,
  STRANDED_AFTER_MS,
} from "@shopper/core/fiscal";
import { scopedKey, type Lane } from "@shopper/ports";
import { cloudflareDatabase } from "./database";
import { cloudflareLauncher } from "./launcher";

interface LaneEnvironment {
  HYPERDRIVE: Hyperdrive;
  SHOPPER_SDC_URL?: string;
  SHOPPER_SDC_KEY?: string;
  FISCAL_ARCHIVE?: Parameters<typeof cloudflareLauncher>[0];
}

/** Documents a lane submits per alarm before it yields and sets the next one. */
const batch = 50;

/**
 * One store's ordered lane to the GRA SDC. The queue lives in this object's SQLite and an alarm drains it: the head is
 * retried with backoff before anything behind it, until it is settled. PostgreSQL stays the record of each document.
 */
export class FiscalLane extends DurableObject<LaneEnvironment> {
  #draining?: Promise<void>;
  constructor(ctx: DurableObjectState, env: LaneEnvironment) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS queue (position INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS scope (id INTEGER PRIMARY KEY CHECK (id = 1), org_id TEXT NOT NULL, store_id TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
    `);
  }
  async enqueue(orgId: string, storeId: string, docId: string) {
    scopedKey(orgId, storeId);
    const sql = this.ctx.storage.sql;
    sql.exec(
      "INSERT INTO scope (id, org_id, store_id) VALUES (1, ?, ?) ON CONFLICT (id) DO NOTHING",
      orgId,
      storeId,
    );
    sql.exec("INSERT OR IGNORE INTO queue (doc_id) VALUES (?)", docId);
    // A head waiting out its backoff keeps its alarm; anything else (no alarm, or a later look for stranded
    // documents) starts now.
    const failing = sql.exec<{ attempts: number }>("SELECT attempts FROM scope").one().attempts > 0;
    if (!failing || (await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now());
  }
  /** Resolves once a drain in progress has stopped; an operator or a test waits on it before looking. */
  async settled() {
    while (this.#draining) await this.#draining;
  }
  async alarm() {
    // Two alarm runs (one forced) must never submit the same head twice. One that waited for another run respects the
    // backoff that run set, instead of trying the head again at once.
    if (this.#draining) {
      while (this.#draining) await this.#draining;
      const next = await this.ctx.storage.getAlarm();
      if (next !== null && next > Date.now()) return;
    }
    this.#draining = this.#drain().finally(() => (this.#draining = undefined));
    await this.#draining;
  }
  async #drain() {
    const sql = this.ctx.storage.sql;
    const [scope] = sql
      .exec<{ org_id: string; store_id: string; attempts: number }>("SELECT * FROM scope")
      .toArray();
    if (!scope || !this.env.SHOPPER_SDC_URL || !this.env.SHOPPER_SDC_KEY) return;
    const sdc = createSdc({ url: this.env.SHOPPER_SDC_URL, apiKey: this.env.SHOPPER_SDC_KEY });
    const context = { orgId: scope.org_id, appVersion: buildInfo.version };
    const archive = this.env.FISCAL_ARCHIVE && cloudflareLauncher(this.env.FISCAL_ARCHIVE);
    let connection: Awaited<ReturnType<typeof cloudflareDatabase>> | undefined;
    try {
      connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
      for (let done = 0; done < batch; done++) {
        const [head] = sql
          .exec<{ doc_id: string }>("SELECT doc_id FROM queue ORDER BY position LIMIT 1")
          .toArray();
        if (!head) {
          const queued = sql.exec<{ doc_id: string }>("SELECT doc_id FROM queue").toArray();
          const stranded = await strandedFiscalDocs(
            connection.db,
            { orgId: scope.org_id, storeId: scope.store_id },
            new Date(Date.now() - STRANDED_AFTER_MS),
            queued.map((row) => row.doc_id),
          );
          for (const id of stranded.ready)
            sql.exec("INSERT OR IGNORE INTO queue (doc_id) VALUES (?)", id);
          if (stranded.ready.length) continue;
          if (stranded.later) await this.ctx.storage.setAlarm(Date.now() + STRANDED_AFTER_MS);
          return;
        }
        const outcome = await submitFiscalDoc(
          connection.db,
          context,
          sdc,
          head.doc_id,
          archive || undefined,
        );
        if (outcome === "retry") {
          const attempts = scope.attempts + 1;
          sql.exec("UPDATE scope SET attempts = ?", attempts);
          await this.ctx.storage.setAlarm(Date.now() + laneBackoff(attempts));
          return;
        }
        sql.exec("DELETE FROM queue WHERE doc_id = ?", head.doc_id);
        sql.exec("UPDATE scope SET attempts = 0");
        scope.attempts = 0;
      }
      await this.ctx.storage.setAlarm(Date.now());
    } catch (error) {
      // PostgreSQL itself failed or could not be reached: keep the head and look again later, never lose the alarm.
      console.error({ event: "fiscal.lane_failed", orgId: scope.org_id, error });
      await this.ctx.storage.setAlarm(Date.now() + laneBackoff(1));
    } finally {
      await connection?.close();
    }
  }
}

export function cloudflareLane(binding: DurableObjectNamespace<FiscalLane>): Lane {
  return {
    enqueue: (orgId, storeId, docId) =>
      binding.getByName(`${orgId}/${storeId}`).enqueue(orgId, storeId, docId),
  };
}
