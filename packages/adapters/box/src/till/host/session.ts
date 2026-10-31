import * as v from "valibot";
import { v7 } from "uuid";
import { invalidDeviceCredential } from "@shopper/auth/devices";
import { buildInfo } from "@shopper/config";
import {
  failStaffSignIn,
  hostTime,
  LOCK_MS,
  MAX_FAILURES,
  readStaff,
  readStoredSession,
  signInStaff,
  signOutStaff,
  TillError,
} from "@shopper/core/till";
import { offlineWithheld, tillSession, type TillSession } from "@shopper/core/schemas";
import type { TillDatabase } from "@shopper/db-sqlite";
import { cashierLogin } from "../../schemas/till/host/session";
import type { HostConfiguration } from "./config";
import { checkVerifier, hashVerifier } from "./session/verifier";
import { createUnlock } from "./session/unlock";

// ponytail: offline sign-in knobs; make them register settings if a shop needs different ones.
const VERIFIER_DAYS = 7;
const OFFLINE_SESSION_MS = 8 * 3_600_000;
/**
 * Past its server session, an offline sign-in starts an offline session: its own id, the server session as
 * parent (whose proof prefixes its own), eight hours, and the parent's permissions without the manager
 * ones. The server adopts it when its sales upload. Accepted limit: a role change, a revoked user or a new
 * password is not seen offline until the verifier is refreshed (at most 7 days).
 */
const decoy = hashVerifier("decoy password");
const unavailable = () =>
  new TillError("SIGN_IN_UNAVAILABLE", "Sign-in is unavailable. Try again.");

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
  let queue: Promise<unknown> = Promise.resolve();
  const signedOut: (() => void)[] = [];
  const set = (session: TillSession | null, next: User | null) => {
    config.session = session;
    user = next;
  };

  /** The login answer, a refusal to throw, or undefined when the server could not be reached. */
  async function attempt(email: string, password: string) {
    let response: Response;
    try {
      response = await fetch(new URL("/cashiers/login", config.upstream), {
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
    } catch {
      return undefined;
    }
    if (response.status >= 500) return undefined;
    const body: unknown = await response.json().catch(() => null);
    // The limiter's 429 carries Retry-After and is the shop's budget, not this account: no lock to unlock.
    const retry = response.headers.get("Retry-After");
    if (response.status === 429 && retry)
      return new TillError(
        "SIGN_IN_UNAVAILABLE",
        `Too many sign-ins from this shop. Try again in ${retry} seconds.`,
      );
    if (response.status === 429) {
      const until = (body as { lockedUntil?: unknown } | null)?.lockedUntil;
      return locked(typeof until === "string" ? Date.parse(until) : undefined);
    }
    if (response.ok) {
      const login = v.safeParse(cashierLogin, body);
      return login.success ? login.output : unavailable();
    }
    if (response.status !== 401) return unavailable();
    return (body as { error?: string } | null)?.error === invalidDeviceCredential
      ? new TillError("DEVICE_REJECTED", "This register is no longer enrolled. Enroll it again.")
      : new TillError("INVALID_CREDENTIALS", "Wrong email or password");
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
    if (!staff) {
      // Same scrypt cost as a real check, so an unknown email is not told apart by timing.
      await checkVerifier(await decoy, password);
      throw new TillError("OFFLINE_UNAVAILABLE", "Connect to the internet to sign in");
    }
    if (now - Date.parse(staff.verifiedAt) > VERIFIER_DAYS * 86_400_000)
      throw new TillError("OFFLINE_UNAVAILABLE", "Connect to the internet to sign in");
    if (staff.lockedUntil && staff.lockedUntil > now) throw locked(staff.lockedUntil);
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
    const id = v7();
    const session: TillSession =
      at.valueOf() < Date.parse(stored.expiresAt)
        ? stored
        : {
            ...stored,
            id,
            parentSessionId: stored.id,
            proof: `${stored.proof}.${id}`,
            issuedAt: new Date(at.valueOf() - 1_000).toISOString(),
            // Exactly the eight hours the server adopts, counted from the backdated start.
            expiresAt: new Date(at.valueOf() - 1_000 + OFFLINE_SESSION_MS).toISOString(),
            permissions: stored.permissions.filter((code) => !offlineWithheld.includes(code)),
          };
    await signInStaff(database, audit(staff.userId, session.roleName), {
      userId: staff.userId,
      at: new Date(now),
      offline: true,
      sessionId: session.id,
    });
    set(session, { userId: staff.userId, name: staff.name, email, offline: true });
  }

  async function signInNow(rawEmail: string, password: string) {
    const email = rawEmail.trim().toLowerCase();
    const login = await attempt(rawEmail.trim(), password);
    if (login instanceof TillError) throw login;
    if (login) await signInOnline(email, password, login);
    else await signInOffline(email, password);
  }

  return {
    /** Signs in with the server when it answers; only an unreachable server falls back to the cached verifier. */
    signIn(rawEmail: string, password: string) {
      // One at a time, so parallel offline guesses cannot read the same failure count.
      const run = queue.then(() => signInNow(rawEmail, password));
      queue = run.catch(() => undefined);
      return run;
    },
    async signOut() {
      const session = config.session;
      if (!session) return;
      await signOutStaff(database, audit(session.userId, session.roleName), {
        userId: session.userId,
        sessionId: session.id,
      });
      set(null, null);
      for (const hook of signedOut) hook();
    },
    unlock: createUnlock(host),
    /** Runs after every sign-out; the desktop cookie rotates here. */
    onSignOut: (hook: () => void) => void signedOut.push(hook),
    /** The signed-in user as the status and the back office see them, or null. */
    current() {
      return user && config.session ? { ...user, permissions: config.session.permissions } : null;
    },
  };
}

/** The lockout refusal, naming the time sign-in opens again when it is known. */
function locked(until?: number) {
  const when = until
    ? `at ${new Date(until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : "in a few minutes";
  return new TillError("SIGN_IN_LOCKED", `Too many attempts. Try again ${when}.`);
}
