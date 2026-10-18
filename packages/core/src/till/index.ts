export { recordLocalSale } from "./record";
export type { DraftView, PrintOutcome, QuoteLine, ScanResult, TillConfig } from "./types";
export { provisionTillReference } from "./reference";
export { storeCashRounding } from "./settings";
export { TillError } from "./error";

export { issueReceiptBlocks } from "./receipts/blocks";
export { readReceiptStatus } from "./receipts/assign";

export { projectProducts, unprojectProducts, clearProjection } from "./lookup/project";
export type { CatalogueMatch, ProjectedProduct } from "./lookup/types";
export { searchCatalogue, lookupCode } from "./lookup/search";

export { quoteLine, readQuoteReference } from "./quotation";
export { resolveScan } from "./basket/scan";

export { hostTime, validateSession } from "./session";
export { readDraft } from "./drafts/queries";
export { addToDraft, setDraftQuantity, removeDraftLine } from "./drafts/commands";
export { settle } from "./tenders/settle";
export { addDraftTender, removeDraftTender } from "./tenders/commands";
export { completeDraftSale } from "./complete";
export { holdDraftSale, resumeDraftSale, voidDraftSale, listHeldDraftSales } from "./drafts/status";
export { setDraftDiscount } from "./drafts/discount";
export { setDraftPrice } from "./drafts/price";
export { listPurchases, readPurchase } from "./purchases";
export { applyDraftPayment } from "./tenders/payment";
export { storePaymentUpdate } from "./tenders/status";

export { paymentSale } from "./tenders/consumption";

export {
  defaultRegisterSettings,
  findRegisterSettings,
  readRegisterSettings,
  saveRegisterSettings,
} from "./register/settings";
export {
  markReceiptUploaded,
  markReceiptUploadFailed,
  recordReceiptPrint,
  storeReceiptPdf,
} from "./register/receipts";
export { registerReport, registerReportCsv } from "./reports";
export {
  listStockDocuments,
  markStockDocumentAccepted,
  markStockDocumentFailed,
  markStockDocumentRejected,
  queueStockDocument,
} from "./stock";
export { failStaffSignIn, readStaff, readStoredSession, signInStaff, signOutStaff } from "./staff";
export { approve, authorize, LOCK_MS, MAX_FAILURES } from "./approvals";
export { readApprovers, refreshApprovers } from "./approvers";
