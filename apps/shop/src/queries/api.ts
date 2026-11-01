import * as v from "valibot";
import { redirect } from "@tanstack/react-router";
import { refusalReply } from "../schemas/shop";

/** A refused shopper request: the status, the message to show and, for a wrong code, the tries left. */
export class ShopApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly attemptsLeft?: number,
  ) {
    super(message);
    this.name = "ShopApiError";
  }
}

/** Calls the shopper API at this origin and validates the reply; a refusal throws `ShopApiError`. */
export async function shopFetch<T extends v.GenericSchema>(
  path: string,
  schema: T,
  init: { method?: string; body?: unknown } = {},
): Promise<v.InferOutput<T>> {
  const response = await fetch(`/api/shop${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw refusal(response.status, body);
  return v.parse(schema, body);
}

function refusal(status: number, body: unknown) {
  const reply = v.safeParse(refusalReply, body);
  if (reply.success) return new ShopApiError(reply.output.error, status, reply.output.attemptsLeft);
  return new ShopApiError("Something went wrong. Check your connection and try again.", status);
}

/** For a loader's `.catch`: a refused session goes to sign in, anything else reaches the error page. */
export const signInWhenRefused = (shop: string) => (error: unknown) => {
  if (error instanceof ShopApiError && error.status === 401)
    throw redirect({ to: "/$shop/signin", params: { shop } });
  throw error;
};
