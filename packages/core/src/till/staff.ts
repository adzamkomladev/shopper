import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { hostSession, tillStaff, type TillDatabase } from "@shopper/db-sqlite";
import type { TillSession } from "../schemas/till/session";

type Staff = typeof tillStaff.$inferSelect;

/** The cached staff record for a lowercased email, or undefined. */
export function readStaff(db: TillDatabase, orgId: string, email: string) {
  return db.read(async (tx): Promise<Staff | undefined> => {
    const [row] = await tx
      .select()
      .from(tillStaff)
      .where(and(eq(tillStaff.orgId, orgId), eq(tillStaff.email, email)));
    return row;
  });
}

/** A session the till stored earlier (sales and stock documents keep their proof there). */
export function readStoredSession(db: TillDatabase, id: string) {
  return db.read(async (tx) => {
    const [row] = await tx.select().from(hostSession).where(eq(hostSession.id, id));
    return row;
  });
}

type SignIn = {
  userId: string;
  at: Date;
  /** True when the host answered without the server; `sessionId` is the session it resumed or restricted. */
  offline: boolean;
  sessionId: string;
  /** Present for an online sign-in: the server session to keep and the staff record to (re)cache. */
  online?: { session: TillSession; email: string; name: string; verifier: string };
};

/** Records a sign-in. Online it stores the server session and refreshes the verifier; offline it clears the failures. */
export const signInStaff = defineCommand({
  name: "session.sign_in",
  async run(tx, context, input: SignIn) {
    const { online } = input;
    if (!online) {
      await tx
        .update(tillStaff)
        .set({ attempts: 0, lockedUntil: null })
        .where(and(eq(tillStaff.orgId, context.orgId), eq(tillStaff.userId, input.userId)));
      return;
    }
    await tx.insert(hostSession).values(online.session).onConflictDoNothing();
    const row = {
      orgId: context.orgId,
      userId: input.userId,
      email: online.email,
      name: online.name,
      verifier: online.verifier,
      attempts: 0,
      lockedUntil: null,
      verifiedAt: input.at.toISOString(),
      lastSessionId: input.sessionId,
    };
    await tx
      .insert(tillStaff)
      .values(row)
      .onConflictDoUpdate({ target: [tillStaff.orgId, tillStaff.userId], set: row });
  },
  audit: (input) => ({ userId: input.userId, offline: input.offline, sessionId: input.sessionId }),
  details: (input) => ({ entity: "session", entityId: input.sessionId }),
});

/** Counts an offline failure; the fifth locks sign-in until `lockedUntil` (epoch ms). */
export const failStaffSignIn = defineCommand({
  name: "session.sign_in.failed",
  async run(tx, context, input: { userId: string; attempts: number; lockedUntil: number | null }) {
    await tx
      .update(tillStaff)
      .set({ attempts: input.attempts, lockedUntil: input.lockedUntil })
      .where(and(eq(tillStaff.orgId, context.orgId), eq(tillStaff.userId, input.userId)));
  },
  audit: (input) => ({
    userId: input.userId,
    attempts: input.attempts,
    locked: !!input.lockedUntil,
  }),
});

/** The session ends on this register; the stored proof stays for queued sales and stock documents. */
export const signOutStaff = defineCommand({
  name: "session.sign_out",
  async run() {},
  audit: (input: { userId: string; sessionId: string }) => input,
  details: (input) => ({ entity: "session", entityId: input.sessionId }),
});
