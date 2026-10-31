/**
 * Every rate-limit policy: requests per key per window. Cloudflare's Rate Limiting binding only counts in
 * 10 s or 60 s windows, so every period is one of those; the edge config builds its bindings from this table.
 */
export const ratePolicies = {
  /** Sign-in, sign-up, password reset, onboarding and invitation acceptance: per client IP and per email. */
  auth: { limit: 5, period: 10 },
  /** Unauthenticated links and lookups (statements, the shop-code lookup, onboarding), per client IP. */
  public: { limit: 30, period: 10 },
  /** Till self-enrolment guesses, per client IP across every shop. */
  enrol: { limit: 10, period: 60 },
  /** Cashier sign-in from a register, per shop and client IP. Lockout per user still applies. */
  cashier: { limit: 20, period: 60 },
} as const satisfies Record<string, { limit: number; period: 10 | 60 }>;
