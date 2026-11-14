import { and, eq, isNotNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { v7 } from "uuid";
import {
  account,
  cashierPin,
  cloudMove,
  sessionKey,
  type MoveCredentials,
  type ShopperDatabase,
} from "@shopper/db-pg";
import type { Workflow } from "@shopper/ports";
import { exportArchiveId, exportPrefix } from "../archive/ids";
import { startArchiveExport } from "../archive/start";
import { cloudMoveId, failCloudMove, finishCloudMove, stallCloudMove } from "../move/box";
import { dumpResult } from "../schemas/archive";
import { cloudMoveParams } from "../schemas/move";
import type { CloudMoveDeps } from "../types";
import { runArchiveExport } from "./archive";

const policy = { maxAttempts: 3, delayMs: 2000, backoff: "exponential" } as const;

/**
 * The box moving into the cloud: seal an archive (Day 41's export, run inside this move), send it file by file (a
 * retry asks the cloud what it still lacks and sends only that), then commit with the credentials the archive leaves
 * out. The relocations the cloud signs wait for each register's next handshake.
 */
export async function runCloudMove(
  flow: Pick<Workflow, "instanceId" | "step">,
  deps: CloudMoveDeps,
  raw: unknown,
) {
  const input = v.parse(cloudMoveParams, raw);
  if (flow.instanceId !== cloudMoveId(input.moveId))
    throw new Error("Cloud move instance must be its move key");
  const context = { orgId: input.orgId, appVersion: deps.appVersion };
  // Set before the commit step (never inside it), so a replay takes the same branch below.
  let committing = false;
  try {
    const { jobId } = await flow.step("begin", policy, () =>
      deps.withDatabase(async (db) => {
        const move = await read(db, input.moveId);
        if (move.exportJobId) return { jobId: move.exportJobId };
        const jobId = v7();
        await startArchiveExport(
          db,
          { ...context, actorId: move.requestedBy ?? undefined },
          { jobId },
        );
        await db.update(cloudMove).set({ exportJobId: jobId }).where(eq(cloudMove.id, move.id));
        return { jobId };
      }),
    );
    await runArchiveExport(
      { instanceId: exportArchiveId(input.orgId, jobId), step: flow.step },
      deps,
      { orgId: input.orgId, jobId },
    );
    const { importId } = await flow.step("upload", policy, () =>
      deps.withDatabase((db) => upload(db, deps, input, jobId)),
    );
    committing = true;
    await flow.step("commit", policy, () =>
      deps.withDatabase(async (db) => {
        const move = await read(db, input.moveId);
        const committed = await answer<{ relocations: unknown[] }>(
          await deps.cloud(`${move.cloudUrl}/migration/imports/${importId}/commit`, {
            method: "POST",
            body: JSON.stringify({ credentials: await credentials(db, input.orgId) }),
          }),
        );
        return finishCloudMove(db, context, {
          moveId: move.id,
          importId,
          relocations: committed.relocations,
        });
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Once the commit may have reached the cloud, reopening the box could split the shop in two.
    await flow.step(committing ? "stall" : "fail", policy, () =>
      deps.withDatabase((db) =>
        (committing ? stallCloudMove : failCloudMove)(db, context, {
          moveId: input.moveId,
          reason,
        }),
      ),
    );
    throw error;
  }
}

/** Opens the import (or finds it again) and sends every file the cloud does not hold yet. */
async function upload(
  db: ShopperDatabase,
  deps: CloudMoveDeps,
  input: { orgId: string; moveId: string },
  jobId: string,
) {
  const move = await read(db, input.moveId);
  await db.update(cloudMove).set({ status: "uploading" }).where(eq(cloudMove.id, move.id));
  const prefix = exportPrefix(jobId);
  const file = async (path: string) => (await deps.blobs.get(input.orgId, `${prefix}/${path}`))!;
  const opened = await answer<{ id: string; missing: string[] }>(
    await deps.cloud(`${move.cloudUrl}/migration/imports`, {
      method: "POST",
      body: JSON.stringify({
        manifest: new TextDecoder().decode(await file("manifest.json")),
        signature: new TextDecoder().decode(await file("manifest.sig")),
      }),
    }),
  );
  const keys = new Map(
    v
      .parse(dumpResult, JSON.parse(new TextDecoder().decode(await file("files.json"))))
      .files.map((each) => [each.path, each.key]),
  );
  for (const path of opened.missing)
    await answer(
      await deps.cloud(`${move.cloudUrl}/migration/imports/${opened.id}/files/${path}`, {
        method: "PUT",
        body: (await deps.blobs.get(input.orgId, keys.get(path)!))!,
      }),
    );
  await db
    .update(cloudMove)
    .set({ status: "importing", importId: opened.id, updatedAt: sql`now()` })
    .where(eq(cloudMove.id, move.id));
  return { importId: opened.id };
}

async function read(db: ShopperDatabase, moveId: string) {
  const [move] = await db.select().from(cloudMove).where(eq(cloudMove.id, moveId));
  if (!move) throw new Error("The move is gone");
  return move;
}

/** What the archive leaves out so that people can sign in, unlock and prove sessions in the cloud as before. */
async function credentials(db: ShopperDatabase, orgId: string): Promise<MoveCredentials> {
  const passwords = await db
    .select({ userId: account.userId, password: account.password })
    .from(account)
    .where(
      and(
        eq(account.orgId, orgId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    );
  const pins = await db
    .select({ userId: cashierPin.userId, pinHash: cashierPin.pinHash })
    .from(cashierPin)
    .where(eq(cashierPin.orgId, orgId));
  const [key] = await db.select().from(sessionKey).where(eq(sessionKey.orgId, orgId));
  return {
    passwords: passwords.map((row) => ({ userId: row.userId, password: row.password! })),
    pins,
    sessionKey: key?.key ?? null,
  };
}

/** The cloud's answer, or its own words as the failure the owner reads. */
async function answer<T>(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    const message = (JSON.parse(text || "{}") as { error?: string }).error;
    throw new Error(message ?? `The cloud answered ${response.status}.`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
