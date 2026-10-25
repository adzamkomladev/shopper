import { DurableObject } from "cloudflare:workers";
import { assignSaleSequence, nextStoreSequence } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import * as v from "valibot";
import {
  messageBody,
  scopedKey,
  sequenceSchema,
  uuidV7Schema,
  type Envelope,
} from "@shopper/ports";
import { cloudflareDatabase } from "./database";

export { FiscalLane } from "./lane";

// PG is the durable record. The DO provides one hot coordination address per store;
// it keeps no second cursor that could disagree with a committed PG transaction.
export class StoreSequencer extends DurableObject<{ HYPERDRIVE: Hyperdrive }> {
  async assignSale(
    orgId: string,
    storeId: string,
    deviceId: string,
    localId: string,
  ): Promise<string> {
    scopedKey(orgId, storeId);
    const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
    try {
      return (
        await assignSaleSequence(
          connection.db,
          { orgId, appVersion: buildInfo.version },
          storeId,
          deviceId,
          localId,
        )
      ).toString();
    } finally {
      await connection.close();
    }
  }
  async next(orgId: string, storeId: string, floor = "0"): Promise<string> {
    scopedKey(orgId, storeId);
    if (!/^\d+$/.test(floor)) throw new RangeError("Invalid sequence floor");
    const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
    try {
      const sequence = await nextStoreSequence(
        connection.db,
        { orgId, appVersion: buildInfo.version },
        storeId,
        BigInt(floor),
      );
      return sequence.toString();
    } finally {
      await connection.close();
    }
  }
}

const replayLimit = 500;
// Live fan-out to one store's devices over hibernating WebSockets. PG stays the record;
// the short replay log only lets a reconnecting device catch up from its cursor.
export class StoreHub extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS message (sequence TEXT PRIMARY KEY, body TEXT NOT NULL)",
    );
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const device = v.safeParse(uuidV7Schema, url.searchParams.get("device"));
    const cursor = v.safeParse(sequenceSchema, url.searchParams.get("cursor"));
    if (request.headers.get("Upgrade") !== "websocket" || !device.success || !cursor.success)
      return new Response("Expected a device WebSocket with a numeric cursor", { status: 400 });
    // One socket per device: a reconnect replaces the old connection.
    for (const old of this.ctx.getWebSockets(device.output))
      old.close(4000, "Replaced by a new connection");
    const [client, server] = Object.values(new WebSocketPair());
    // No close handler: compatibility dates from 2026-04-07 auto-reply to close frames.
    this.ctx.acceptWebSocket(server, [device.output]);
    const nudges = url.searchParams.get("nudges") === "1";
    server.serializeAttachment({ nudges });
    const missed = this.ctx.storage.sql.exec<{ body: string }>(
      "SELECT body FROM message WHERE sequence > ? ORDER BY sequence",
      padded(cursor.output),
    );
    for (const { body } of missed) server.send(nudges ? nudgeBody(body) : body);
    return new Response(null, { status: 101, webSocket: client });
  }
  async broadcast(message: Envelope): Promise<void> {
    const body = messageBody(message);
    const sql = this.ctx.storage.sql;
    sql.exec(
      "INSERT OR REPLACE INTO message (sequence, body) VALUES (?, ?)",
      padded(message.sequence),
      body,
    );
    sql.exec(
      "DELETE FROM message WHERE sequence NOT IN (SELECT sequence FROM message ORDER BY sequence DESC LIMIT ?)",
      replayLimit,
    );
    for (const socket of this.ctx.getWebSockets()) {
      // One closing socket must not stop the fan-out; that device catches up from its cursor.
      try {
        const attachment = socket.deserializeAttachment() as { nudges?: boolean } | null;
        socket.send(attachment?.nudges ? nudgeBody(body) : body);
      } catch (error) {
        console.error({ event: "realtime.send_failed", orgId: message.orgId, error });
        socket.close(1011, "Send failed");
      }
    }
  }
}
// Sequences are decimal bigints; fixed-width text keeps SQLite ordering exact past 2^53.
const padded = (sequence: string) => sequence.padStart(20, "0");

function nudgeBody(body: string) {
  const message = JSON.parse(body) as Envelope;
  return JSON.stringify({ type: "store.changed", sequence: message.sequence });
}
