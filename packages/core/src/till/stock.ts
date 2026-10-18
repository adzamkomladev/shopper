import * as v from "valibot";
import { and, desc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { hostSession, stockDocument, type TillDatabase } from "@shopper/db-sqlite";
import { stockDocumentSchema } from "../schemas/stock/document";
import type { TillSession } from "../schemas/till/session";
import { checkSession } from "./session";

type Scope = { orgId: string; deviceId: string; branchId: string };
type Draft = { kind: "count" | "receipt"; [field: string]: unknown };

/**
 * Validates a count or receipt, stamps its identity from the cashier session and queues it for the upload
 * worker. The session is saved with it (as a sale does) so the proof outlives the login.
 */
export async function queueStockDocument(
  db: TillDatabase,
  context: CommandContext,
  input: { scope: Scope; session: TillSession; at: Date; document: Draft },
) {
  const { scope, session } = input;
  checkSession(session, scope, "stock.write", input.at);
  const document = v.parse(stockDocumentSchema, {
    ...input.document,
    v: 1,
    id: v7(),
    actorId: session.userId,
    sessionId: session.id,
  });
  return queue(db, context, { scope, session, document, at: input.at });
}

const queue = defineCommand({
  name: "stock.document.queue",
  async run(
    tx,
    _context,
    input: {
      scope: Scope;
      session: TillSession;
      document: v.InferOutput<typeof stockDocumentSchema>;
      at: Date;
    },
  ) {
    const { scope, session, document } = input;
    await tx.insert(hostSession).values(session).onConflictDoNothing();
    const [row] = await tx
      .insert(stockDocument)
      .values({
        id: document.id,
        orgId: scope.orgId,
        deviceId: scope.deviceId,
        kind: document.kind,
        payload: document,
        sessionId: session.id,
        createdAt: input.at.toISOString(),
      })
      .returning();
    return row!;
  },
  audit: (input) => ({
    documentId: input.document.id,
    kind: input.document.kind,
    lines: input.document.lines.length,
  }),
  details: (input) => ({ entity: "stock_document", entityId: input.document.id }),
});

/** Newest first, each with the state the queue screen shows: queued, sent or rejected (with its reason). */
export function listStockDocuments(db: TillDatabase, input: { orgId: string; limit: number }) {
  return db.read(async (tx) =>
    (
      await tx
        .select()
        .from(stockDocument)
        .where(eq(stockDocument.orgId, input.orgId))
        .orderBy(desc(stockDocument.id))
        .limit(input.limit)
    ).map((row) => ({
      ...row,
      status: row.acceptedAt
        ? ("sent" as const)
        : row.blockedCode
          ? ("rejected" as const)
          : ("queued" as const),
    })),
  );
}

type Mark = { id: string };
const document = (input: Mark) => ({ entity: "stock_document", entityId: input.id });

/** The server applied the document; `result` is its per-line outcome. */
export const markStockDocumentAccepted = defineCommand({
  name: "stock.document.accept",
  async run(tx, _context, input: Mark & { result: Record<string, unknown>; at: Date }) {
    await tx
      .update(stockDocument)
      .set({ acceptedAt: input.at.toISOString(), result: input.result, nextAttemptAt: null })
      .where(eq(stockDocument.id, input.id));
  },
  audit: (input) => ({ documentId: input.id }),
  details: document,
});

/** Terminal: the server refused the document; it stays listed with the reason and is never retried. */
export const markStockDocumentRejected = defineCommand({
  name: "stock.document.reject",
  async run(tx, _context, input: Mark & { code: string; reason: string }) {
    await tx
      .update(stockDocument)
      .set({ blockedCode: input.code, blockedReason: input.reason, nextAttemptAt: null })
      .where(eq(stockDocument.id, input.id));
  },
  audit: (input) => ({ documentId: input.id, code: input.code, reason: input.reason }),
  details: document,
});

/** Counts a failed attempt and defers the next one to `nextAttemptAt` (epoch ms). */
export const markStockDocumentFailed = defineCommand({
  name: "stock.document.upload.failed",
  async run(tx, _context, input: Mark & { nextAttemptAt: number; reason: string }) {
    await tx
      .update(stockDocument)
      .set({ attempts: sql`${stockDocument.attempts} + 1`, nextAttemptAt: input.nextAttemptAt })
      .where(eq(stockDocument.id, input.id));
  },
  audit: (input) => ({ documentId: input.id, reason: input.reason }),
  details: document,
});
