import { problem } from "../schemas/api/client";
import * as v from "valibot";
import { currentShop } from "../stores/shops";

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
const UNREADABLE_WRITE_MESSAGE =
  "The server's reply couldn't be read. Refresh to see whether your change was saved.";
const UNREADABLE_READ_MESSAGE = "The server's reply couldn't be read. Refresh and try again.";
const LOGGED_BODY_CHARS = 200;
// Credentials may be in links or request bodies; neither belongs in diagnostics.
const CREDENTIAL_KEYS = ["token", "resendToken", "password", "pin"];

/** The path for the console: secret query values are replaced, everything else stays for diagnosis. */
function loggablePath(path: string) {
  const url = new URL(path, "http://shopper.invalid");
  for (const name of CREDENTIAL_KEYS)
    if (url.searchParams.has(name)) url.searchParams.set(name, "redacted");
  return `${url.pathname}${url.search}`;
}

// `shopId` pins the tenant for this call (null sends none); left out, it follows the current shop.
type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  shopId?: string | null;
};

/** Same-origin call to the API with the session cookie and the selected shop, parsed with `schema`. */
export async function apiFetch<S extends v.GenericSchema>(
  path: string,
  schema: S,
  { method = "GET", body, shopId = currentShop()?.id }: Options = {},
): Promise<v.InferOutput<S>> {
  const params = new URL(path, "http://shopper.invalid").searchParams;
  const sensitive =
    /^\/(onboarding|invitations|auth)(?:\/|$)/.test(path) ||
    path.split("?")[0] === "/catalogue/imports/uploads" ||
    CREDENTIAL_KEYS.some(
      (name) => params.has(name) || (body !== null && typeof body === "object" && name in body),
    );
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (shopId) headers.set("X-Shopper-Org", shopId);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((cause: unknown) => {
    console.error(
      `[api] ${method} ${loggablePath(path)} was not sent`,
      sensitive ? "Request details withheld" : cause,
    );
    throw new ApiError(0, OFFLINE_MESSAGE, undefined, sensitive ? undefined : { cause });
  });
  const copy = response.clone();
  const payload: unknown = await response.json().catch(async () => {
    if (!response.ok)
      console.error(
        `[api] ${method} ${loggablePath(path)} failed with ${response.status} and a body that is not JSON`,
        sensitive
          ? "Response details withheld"
          : (await copy.text().catch(() => "")).slice(0, LOGGED_BODY_CHARS),
      );
    return null;
  });
  if (!response.ok) {
    const failure = v.safeParse(problem, payload);
    const details = failure.success ? failure.output : {};
    throw new ApiError(
      response.status,
      safeMessage(
        details.message ?? details.error ?? `Request failed (${response.status})`,
        path,
        body,
      ),
      details.field,
    );
  }
  const parsed = v.safeParse(schema, payload);
  if (!parsed.success) {
    console.error(
      `[api] ${method} ${loggablePath(path)} replied ${response.status} with an unexpected shape`,
      sensitive ? "Response details withheld" : v.flatten(parsed.issues),
    );
    throw new ApiError(
      response.status,
      method === "GET" ? UNREADABLE_READ_MESSAGE : UNREADABLE_WRITE_MESSAGE,
    );
  }
  return parsed.output;
}

// Upstream error messages can echo a credential from the request, even when their JSON is valid.
function safeMessage(message: string, path: string, body: unknown) {
  const url = new URL(path, "http://shopper.invalid");
  for (const name of CREDENTIAL_KEYS) {
    const queryValue = url.searchParams.get(name);
    if (queryValue) message = message.replaceAll(queryValue, "[redacted]");
    if (body && typeof body === "object" && name in body) {
      const value = (body as Record<string, unknown>)[name];
      if (typeof value === "string" && value) message = message.replaceAll(value, "[redacted]");
    }
  }
  return message;
}
