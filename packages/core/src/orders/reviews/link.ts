import * as v from "valibot";
import { assertLinkSecret, hmacHex, hmacVerify } from "@shopper/utils";
import { reviewTokenPayload, type ReviewTokenPayload } from "../../schemas/orders/review";

const base64url = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromBase64url = (text: string) => atob(text.replaceAll("-", "+").replaceAll("_", "/"));

/**
 * The token in a review text's link: the payload, then its HMAC. It stands in for the checkout key on that one order's
 * page until the review window closes; the order itself takes only one review, so no link row is kept.
 */
export async function signReviewToken(secret: string, payload: ReviewTokenPayload) {
  assertLinkSecret(secret);
  const body = base64url(JSON.stringify(payload));
  return `${body}.${await hmacHex(secret, body)}`;
}

/** Whether `token` is a live review link to order `orderId` of shop `orgId`. */
export async function reviewTokenOpens(
  secret: string,
  token: string,
  target: { orgId: string; orderId: string },
  now = Date.now(),
) {
  const [body, signature, ...extra] = token.split(".");
  if (!body || !signature || extra.length || !(await hmacVerify(secret, body, signature)))
    return false;
  const payload = v.safeParse(reviewTokenPayload, decode(body));
  return (
    payload.success &&
    payload.output.exp > now &&
    payload.output.orgId === target.orgId &&
    payload.output.orderId === target.orderId
  );
}

/** Where a review text sends the shopper: their order's page on the shop. */
export const reviewLinkUrl = (shopUrl: string, code: string, orderId: string, token: string) =>
  `${shopUrl}/${code}/orders/${orderId}?r=${token}`;

/** The payload a signed body holds; anything unreadable is nothing. */
function decode(body: string): unknown {
  try {
    return JSON.parse(fromBase64url(body));
  } catch {
    return null;
  }
}
