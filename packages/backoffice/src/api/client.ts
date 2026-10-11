import * as v from "valibot";
import { currentShop } from "../shops/shop-store";

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

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
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (shopId) headers.set("X-Shopper-Org", shopId);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = v.safeParse(problem, payload);
    const details = failure.success ? failure.output : {};
    throw new ApiError(
      response.status,
      details.message ?? details.error ?? `Request failed (${response.status})`,
      details.field,
    );
  }
  return v.parse(schema, payload);
}
