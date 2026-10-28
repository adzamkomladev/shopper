import type { KybCheck, KybDirector, KybDocument } from "@shopper/db-pg";
import type { KybEvidence } from "./types";

type Submitted = {
  tin: string | null;
  settlementBank: string | null;
  directors: KybDirector[];
  documents: KybDocument[];
};

/** GRA TINs: a P, C, G, Q or V and ten digits. */
const TIN = /^[PCGQV]\d{10}$/;
const GHANA_CARD = /^GHA-\d{9}-\d$/;
const REQUIRED = ["registration_certificate", "tin_certificate"] as const;

/**
 * The automated checks on one submission, every one run so the owner sees every reason at once. There is no NIA or
 * ORC API, so these are formats, dates and the documents themselves; a reviewer compares the scans by eye.
 */
export async function runKybChecks(
  submitted: Submitted,
  evidence: KybEvidence,
): Promise<KybCheck[]> {
  const cards = submitted.directors.map((director) => director.ghanaCard);
  const assets = [
    ...submitted.directors.map((director) => director.cardAssetId),
    ...submitted.documents.map((document) => document.assetId),
  ];
  const unverified = (
    await Promise.all(assets.map(async (id) => ((await evidence.verified(id)) ? [] : [id])))
  ).flat();
  const missing = REQUIRED.filter((kind) => !submitted.documents.some((d) => d.kind === kind));
  const lapsed = [
    ...submitted.directors.map((d) => d.cardExpiresOn),
    ...submitted.documents.flatMap((d) => (d.expiresOn ? [d.expiresOn] : [])),
  ].filter((day) => day <= evidence.today);
  return [
    result(
      "tin",
      TIN.test(submitted.tin ?? ""),
      "The TIN must be a letter and ten digits, as GRA issues it.",
    ),
    result("directors", submitted.directors.length > 0, "Add at least one director."),
    result(
      "ghana_card",
      cards.every((card) => GHANA_CARD.test(card)),
      "Each Ghana Card number must read GHA-123456789-0.",
    ),
    result(
      "card_expiry",
      lapsed.length === 0,
      "A Ghana Card or document has expired. Upload a current one.",
    ),
    result(
      "documents",
      missing.length === 0 && unverified.length === 0,
      missing.length
        ? `Upload the ${missing.map((kind) => kind.replace("_", " ")).join(" and ")}.`
        : "A document could not be read or changed after upload. Upload it again.",
    ),
    result(
      "settlement_bank",
      evidence.banks.has(submitted.settlementBank ?? ""),
      "Choose a bank or mobile money provider Paystack can pay out to.",
    ),
  ];
}

const result = (check: string, ok: boolean, reason: string): KybCheck =>
  ok ? { check, ok } : { check, ok, reason };

/** The day the approval lapses: the earliest card or document expiry. */
export const earliestExpiry = (submitted: Submitted) =>
  [
    ...submitted.directors.map((d) => d.cardExpiresOn),
    ...submitted.documents.flatMap((d) => (d.expiresOn ? [d.expiresOn] : [])),
  ].sort()[0] ?? null;
