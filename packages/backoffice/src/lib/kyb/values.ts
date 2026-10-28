import { documentKinds, type KybStatus, type KybValues, type KybView } from "../../schemas/kyb";

export const emptyDirector = { name: "", ghanaCard: "", cardExpiresOn: "", cardAssetId: "" };

/** The owner may change the case unless Shopper is checking or reviewing it. */
export const editable = (status: KybStatus) => status !== "submitted" && status !== "in_review";

export function kybValues(view: KybView): KybValues {
  const document = (kind: (typeof documentKinds)[number]) => {
    const found = view.documents.find((each) => each.kind === kind);
    return { assetId: found?.assetId ?? "", expiresOn: found?.expiresOn ?? "" };
  };
  return {
    businessName: view.businessName ?? "",
    registrationNumber: view.registrationNumber ?? "",
    tin: view.tin ?? "",
    settlementBank: view.settlementBank ?? "",
    settlementAccount: view.settlementAccount ?? "",
    directors: view.directors.length ? view.directors : [emptyDirector],
    registration_certificate: document("registration_certificate"),
    tin_certificate: document("tin_certificate"),
  };
}

/**
 * A draft carries what is filled in: blank fields are left as they were, and a director or document only once
 * it is whole, since the API takes each part in its submitted shape.
 */
export function kybDraftBody(values: KybValues) {
  const filled = (value: string) => value.trim() || undefined;
  const directors = values.directors.filter((director) =>
    Object.values(director).every((value) => value.trim()),
  );
  const documents = documentKinds.flatMap((kind) =>
    values[kind].assetId
      ? [{ kind, assetId: values[kind].assetId, expiresOn: values[kind].expiresOn || null }]
      : [],
  );
  return {
    businessName: filled(values.businessName),
    registrationNumber: filled(values.registrationNumber),
    tin: filled(values.tin),
    settlementBank: filled(values.settlementBank),
    settlementAccount: filled(values.settlementAccount),
    directors: directors.length ? directors : undefined,
    documents: documents.length ? documents : undefined,
  };
}
