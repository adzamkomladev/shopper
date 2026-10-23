export type IdType = "ghana_card" | "passport" | "voter_id" | "drivers_licence";

/** The queue's three views. */
export type Segment = "review" | "open" | "closed";

/** Who an identity check is for. A customer is a credit check; a member is a role check. */
export type KycSubject =
  | { kind: "customer"; id: string; phone?: string }
  | { kind: "member"; id: string; phone?: string };
