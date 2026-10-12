import * as v from "valibot";
import { currentShop } from "../shops/shop-store";

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
const FILE_NOT_SENT_MESSAGE =
  "Couldn't send the file. If you changed it after choosing it, choose it again; otherwise check your connection.";
const UNREADABLE_WRITE_MESSAGE =
  "The server's reply couldn't be read. Refresh to see whether your change was saved.";
const UNREADABLE_READ_MESSAGE = "The server's reply couldn't be read. Refresh and try again.";
const LOGGED_BODY_CHARS = 200;

// `shopId` pins the tenant for this call (null sends none); left out, it follows the current shop.
type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  shopId?: string | null;
};

// The API reports problems as `{ error, field? }`; Better Auth uses `{ message }`.
const problem = v.object({
  error: v.optional(v.string()),
  message: v.optional(v.string()),
  field: v.optional(v.string()),
});

/** Same-origin call to the API with the session cookie and the selected shop, parsed with `schema`. */
export async function apiFetch<S extends v.GenericSchema>(
  path: string,
  schema: S,
  { method = "GET", body, shopId = currentShop()?.id }: Options = {},
): Promise<v.InferOutput<S>> {
  const headers = new Headers();
  // A FormData body sets its own multipart Content-Type, with the boundary.
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers.set("Content-Type", "application/json");
  if (shopId) headers.set("X-Shopper-Org", shopId);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined || isForm ? body : JSON.stringify(body),
  }).catch((cause: unknown) => {
    console.error(`[api] ${method} ${path} was not sent`, cause);
    throw new ApiError(0, isForm ? FILE_NOT_SENT_MESSAGE : OFFLINE_MESSAGE, undefined, { cause });
  });
  const copy = response.clone();
  const payload: unknown = await response.json().catch(async () => {
    if (!response.ok)
      console.error(
        `[api] ${method} ${path} failed with ${response.status} and a body that is not JSON`,
        (await copy.text().catch(() => "")).slice(0, LOGGED_BODY_CHARS),
      );
    return null;
  });
  if (!response.ok) {
    const failure = v.safeParse(problem, payload);
    const details = failure.success ? failure.output : {};
    throw new ApiError(
      response.status,
      details.message ?? details.error ?? `Request failed (${response.status})`,
      details.field,
    );
  }
  const parsed = v.safeParse(schema, payload);
  if (!parsed.success) {
    console.error(
      `[api] ${method} ${path} replied ${response.status} with an unexpected shape`,
      v.flatten(parsed.issues),
    );
    throw new ApiError(
      response.status,
      method === "GET" ? UNREADABLE_READ_MESSAGE : UNREADABLE_WRITE_MESSAGE,
    );
  }
  return parsed.output;
}
