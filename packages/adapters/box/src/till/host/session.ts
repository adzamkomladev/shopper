import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import {
  failStaffSignIn,
  hostTime,
  readStaff,
  readStoredSession,
  signInStaff,
  signOutStaff,
  TillError,
} from "@shopper/core/till";
import { tillSession, type TillSession } from "@shopper/core/schemas";
import type { TillDatabase } from "@shopper/db-sqlite";
import { cashierLogin } from "../../schemas/till/host/session";
import type { HostConfiguration } from "./config";
import { checkVerifier, hashVerifier } from "./session/verifier";

// ponytail: offline sign-in knobs; make them register settings if a shop needs different ones.
const VERIFIER_DAYS = 7;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const OFFLINE_SESSION_MS = 8 * 3_600_000;
/** What an offline sign-in without a valid server session may do. */
const OFFLINE_PERMISSIONS = ["report.read", "stock.read", "stock.write"];

type User = { userId: string; name: string; email: string; offline: boolean };

/** The one holder of the signed-in staff member: `config.session` is what every till command reads. */
export function createHostSession(host: { database: TillDatabase; config: HostConfiguration }) {
  const { database, config } = host;
  const { identity } = config;
  let user: User | null = config.session
    ? {
        userId: config.session.userId,
        name: config.receiptReference?.cashierName ?? "",
        email: "",
        offline: false,
      }
    : null;
  const audit = (userId: string, role: string) => ({
    orgId: identity.orgId,
    deviceId: identity.deviceId,
    branchId: identity.branchId,
    actorId: userId,
    role,
    appVersion: buildInfo.version,
  });
  const set = (session: TillSession | null, next: User | null) => {
    config.session = session;
    user = next;
  };

  /** The login answer, a refusal to throw, or undefined when the server could not be reached. */
  async function attempt(email: string, password: string) {
    try {
      const response = await fetch(new URL("/cashiers/login", config.upstream), {
        method: "POST",
        headers: { "content-type": "application/json", "X-Shopper-Org": identity.orgId },
        body: JSON.stringify({
          deviceId: identity.deviceId,
          deviceToken: config.deviceToken,
          email,
          password,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status >= 500) return undefined;
      if (response.status === 429)
        return new TillError("SIGN_IN_LOCKED", "Too many attempts. Try again in 15 minutes.");
      if (response.ok) return v.parse(cashierLogin, await response.json());
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return body?.error === "Invalid device credential"
        ? new TillError("DEVICE_REJECTED", "This register is no longer enrolled. Enroll it again.")
        : new TillError("INVALID_CREDENTIALS", "Wrong email or password");
    } catch {
      return undefined;
    }
  }

  async function signInOnline(
    email: string,
    password: string,
    login: v.InferOutput<typeof cashierLogin>,
  ) {
    const session: TillSession = {
      id: login.id,
      orgId: identity.orgId,
      deviceId: identity.deviceId,
      branchId: identity.branchId,
      userId: login.userId,
      roleName: login.roleName,
      issuedAt: login.issuedAt,
      expiresAt: login.expiresAt,
      permissions: login.permissions,
      proof: login.token,
    };
    await signInStaff(database, audit(session.userId, session.roleName), {
      userId: session.userId,
      at: new Date(),
      offline: false,
      sessionId: session.id,
      online: { session, email, name: login.userName, verifier: await hashVerifier(password) },
    });
    set(session, { userId: session.userId, name: login.userName, email, offline: false });
  }

  /** The server is unreachable: check the cached verifier, then resume the user's last session or restrict it. */
  async function signInOffline(email: string, password: string) {
    const staff = await readStaff(database, identity.orgId, email);
    const now = Date.now();
    if (!staff || now - Date.parse(staff.verifiedAt) > VERIFIER_DAYS * 86_400_000)
      throw new TillError("OFFLINE_UNAVAILABLE", "Connect to the internet to sign in");
    if (staff.lockedUntil && staff.lockedUntil > now)
      throw new TillError("SIGN_IN_LOCKED", "Too many attempts. Try again in 15 minutes.");
    const last = staff.lastSessionId
      ? await readStoredSession(database, staff.lastSessionId)
      : undefined;
    if (!last) throw new TillError("OFFLINE_UNAVAILABLE", "Connect to the internet to sign in");
    const stored = v.parse(tillSession, last);
    if (!(await checkVerifier(staff.verifier, password))) {
      const failures = (staff.lockedUntil ? 0 : staff.attempts) + 1;
      await failStaffSignIn(database, audit(staff.userId, stored.roleName), {
        userId: staff.userId,
        attempts: failures,
        lockedUntil: failures >= MAX_FAILURES ? now + LOCK_MS : null,
      });
      throw new TillError("INVALID_CREDENTIALS", "Wrong email or password");
    }
    const at = await hostTime(database, identity, new Date(now));
    const session: TillSession =
      at.valueOf() < Date.parse(stored.expiresAt)
        ? stored
        : {
            ...stored,
            issuedAt: new Date(at.valueOf() - 1_000).toISOString(),
            expiresAt: new Date(at.valueOf() + OFFLINE_SESSION_MS).toISOString(),
            permissions: stored.permissions.filter((code) => OFFLINE_PERMISSIONS.includes(code)),
          };
    await signInStaff(database, audit(staff.userId, session.roleName), {
      userId: staff.userId,
      at: new Date(now),
      offline: true,
      sessionId: stored.id,
    });
    set(session, { userId: staff.userId, name: staff.name, email, offline: true });
  }

  return {
    /** Signs in with the server when it answers; only an unreachable server falls back to the cached verifier. */
    async signIn(rawEmail: string, password: string) {
      const email = rawEmail.trim().toLowerCase();
      const login = await attempt(rawEmail.trim(), password);
      if (login instanceof TillError) throw login;
      if (login) await signInOnline(email, password, login);
      else await signInOffline(email, password);
    },
    async signOut() {
      const session = config.session;
      if (!session) return;
      await signOutStaff(database, audit(session.userId, session.roleName), {
        userId: session.userId,
        sessionId: session.id,
      });
      set(null, null);
    },
    /** The signed-in user as the status and the back office see them, or null. */
    current() {
      return user && config.session ? { ...user, permissions: config.session.permissions } : null;
    },
  };
}
