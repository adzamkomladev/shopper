import type { LinkProblem } from "./types";
export type { LinkProblem, LinkCredentials } from "./types";
import type * as v from "valibot";
import { ApiError, apiFetch } from "../../client";

/** A call to the public onboarding and invitation API: it names no shop, because none is chosen yet. */
export function publicFetch<S extends v.GenericSchema>(
  path: string,
  schema: S,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
) {
  return apiFetch(path, schema, { ...options, shopId: null });
}

/** What a failed public call means to the person, whichever call it was. */
export function linkProblem(error: unknown): LinkProblem {
  if (error instanceof ApiError) {
    if (error.status === 0) return "unreachable";
    if (error.status === 403) return "closed";
    if (error.status === 429) return "busy";
    if (error.status === 503) return "unavailable";
    if (error.status >= 400 && error.status < 500) return "broken";
  }
  return "unavailable";
}

/** The id and secret from an emailed link. */

/** A link missing its id or token cannot be previewed: it is as broken as an expired one. */
export function brokenLink(): never {
  throw new ApiError(410, "This link is invalid or expired");
}
