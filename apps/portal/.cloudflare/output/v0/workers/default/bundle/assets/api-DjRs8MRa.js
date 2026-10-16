import { n as ApiError, r as apiFetch } from "./createLucideIcon-DmKyVZgg.js";
//#region ../../packages/backoffice/src/api/auth/public/api.ts
/** A call to the public onboarding and invitation API: it names no shop, because none is chosen yet. */
function publicFetch(path, schema, options = {}) {
  return apiFetch(path, schema, {
    ...options,
    shopId: null,
  });
}
/** What a failed public call means to the person, whichever call it was. */
function linkProblem(error) {
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
function brokenLink() {
  throw new ApiError(410, "This link is invalid or expired");
}
//#endregion
export { linkProblem as n, publicFetch as r, brokenLink as t };
