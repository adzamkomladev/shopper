# Day 30 verification

Done when an in-store customer can see their receipts online: `tests/integration/shop/account.test.ts`
rings up a till sale to a customer's phone, signs that phone in with the texted code, and reads the
receipt and its points through the shop API.

## Tests

| Suite                                                                                         | What it proves                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/shop/signin.test.ts`, `otp.test.ts`, `routes.test.ts`, `turnstile.test.ts` | code verifies once; 5 wrong codes lock; expiry; 3 sends; the SMS carries a derived code that is never stored or queued; rate limits; Turnstile                                                             |
| `tests/integration/shop/account.test.ts`                                                      | receipts and points of the phone's customer rows (merged rows too), never another phone's; PDF only once linked and verified; the renderer is never called on view; another shop sees nothing              |
| `tests/integration/shop/profile.test.ts`                                                      | name and email on the online account only; addresses with one default (the first is always it); audited, phones masked                                                                                     |
| `tests/integration/receipts/render.test.ts`                                                   | render-once: first call renders, stores and links a verified asset; later calls and till-linked receipts render nothing                                                                                    |
| `tests/integration/security/tenant/sweep.test.ts`                                             | every shop route is in the tenant sweep                                                                                                                                                                    |
| `tests/e2e/shop/*.spec.ts` (14)                                                               | sign-in with the code from the Arkesel fake, wrong code, lock and restart, resend countdown, unknown shop, account, receipt and PDF, not found, loyalty off, the You sheet, motion and reduced motion, axe |

Break-it checks: dropping the customer filter failed 3 account tests; removing the verified-asset check
failed the render-once suite; an unticked default checkbox on the first address failed the profile test
before the fix.

## Browser checks (`/ui-verify`, `/skeleton-audit`)

- Sign-in, account (busy, empty, loyalty off), receipt (PDF, no PDF, not found) and the You sheet at
  1920×1080, 1440×900, 768×1024, 390×844 and 1366×768, light and dark: no horizontal overflow, no
  console errors.
- Fixed while checking: the sign-in glow was a band the width of the card; the receipt paper grew to
  printer size on tablets (capped at three quarters); the points balance had no thousands separator.
- Skeletons sized from the loaded boxes at mobile, tablet and desktop. Layout shift on the swap:
  account 0.0000–0.0002, receipt 0.0010–0.0012 (was 0.11 on tablet before the paper started at its
  final zoom).

## Left for later

- Production deploy of the shop Worker and its domains waits for Day 29 (live setup).
- Per-stage secrets: `TURNSTILE_SECRET_KEY` on the API Worker, `TURNSTILE_SITEKEY` on the shop Worker,
  the Arkesel sender.
- `renderSaleReceipt` gets its caller when online orders are paid (Day 33).
- The receipt list shows the newest 100; a cursor comes when a shopper's history outgrows it.
