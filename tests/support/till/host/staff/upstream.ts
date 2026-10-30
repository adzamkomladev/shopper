import { v7 } from "uuid";
import { startUpstream } from "../../upstream";

export type Staff = {
  userId: string;
  name: string;
  email: string;
  password: string;
  permissions: string[];
};
const hex = (seed: string) => seed.repeat(64).slice(0, 64);
export const ama: Staff = {
  userId: v7(),
  name: "Ama Mensah",
  email: "ama@shop.test",
  password: "correct horse battery",
  permissions: ["sale.create", "report.read", "stock.read", "stock.write", "product.read"],
};
export const kofi: Staff = {
  userId: v7(),
  name: "Kofi Boateng",
  email: "kofi@shop.test",
  password: "kofi password 1",
  permissions: ["sale.create"],
};

/** An upstream that signs staff in. `mode` makes the login 503 (unreachable), 429 (locked) or normal. */
export async function startStaffUpstream(staff: Staff[]) {
  const users = new Map(staff.map((user) => [user.email, { ...user }]));
  const state = {
    mode: "ok" as "ok" | "down" | "locked" | "garbage" | "forbidden",
    issued: [] as { id: string; token: string }[],
    /** The manager PIN the server accepts at /cashiers/unlock, and each unlock it granted. */
    unlockPin: "2468",
    unlocks: [] as { email: string; approverId: string }[],
  };
  const upstream = await startUpstream(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/cashiers/login") {
      if (state.mode === "down") return Response.json({ error: "Unavailable" }, { status: 503 });
      if (state.mode === "garbage") return Response.json({ nonsense: true });
      if (state.mode === "forbidden") return Response.json({ error: "Nope" }, { status: 403 });
      if (state.mode === "locked")
        return Response.json({ error: "Sign-in temporarily locked" }, { status: 429 });
      const body = (await request.json()) as { email: string; password: string };
      const user = users.get(body.email.toLowerCase());
      if (!user || user.password !== body.password)
        return Response.json({ error: "Invalid email or password" }, { status: 401 });
      const session = { id: v7(), token: hex(String(state.issued.length + 1)) };
      state.issued.push(session);
      return Response.json({
        ...session,
        issuedAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
        permissions: user.permissions,
        roleName: "Manager",
        userId: user.userId,
        userName: user.name,
      });
    }
    if (path === "/cashiers/unlock") {
      if (state.mode === "down") return Response.json({ error: "Unavailable" }, { status: 503 });
      const body = (await request.json()) as { email: string; approverId: string; pin: string };
      if (body.pin !== state.unlockPin)
        return Response.json({ error: "Invalid PIN" }, { status: 401 });
      state.unlocks.push({ email: body.email, approverId: body.approverId });
      state.mode = "ok";
      return Response.json({ userId: users.get(body.email)?.userId, lockedUntil: null });
    }
    if (path === "/products")
      return Response.json([], {
        headers: {
          "set-cookie": "upstream=1; Path=/; HttpOnly",
          "access-control-allow-origin": "*",
        },
      });
    if (path === "/sync/stock") {
      const { requestId } = (await request.json()) as { requestId: string };
      return Response.json({ requestId, accepted: { lines: [] } });
    }
    return new Response(null, { status: 404 });
  });
  return { ...upstream, state, users };
}
