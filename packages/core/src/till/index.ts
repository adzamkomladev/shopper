export { recordLocalSale } from "./record";
export type { DraftView, PrintOutcome, QuoteLine, ScanResult, TillConfig } from "./types";
export { provisionTillReference } from "./reference";
export { readOrgSettings, storeOrgSettings } from "./settings";
export { TillError } from "./error";

export { issueReceiptBlocks } from "./receipts/blocks";
export { readReceiptStatus } from "./receipts/assign";
export { signLocalReceipt, unsignedLocalReceipts } from "./receipts/sign";

export { projectProducts, unprojectProducts, clearProjection } from "./lookup/project";
export type { CatalogueMatch, ProjectedCustomer, ProjectedProduct } from "./lookup/types";
export { projectCustomers, removeCustomers, replayPendingCustomers } from "./lookup/customers";
export { attachDraftCustomer, createTillCustomer, updateTillCustomer } from "./customers/commands";
export { findCustomers } from "./customers/queries";
export { recordAccountPayment } from "./accounts/payment";
export {
  markAccountPaymentAccepted,
  markAccountPaymentFailed,
  markAccountPaymentRejected,
} from "./accounts/uploads";
export {
  markCustomerAccepted,
  markCustomerFailed,
  markCustomerRejected,
} from "./customers/uploads";
export { searchCatalogue, lookupCode } from "./lookup/search";

export { ghanaDate, quoteLine, readQuoteReference } from "./quotation";
export { resolveScan } from "./basket/scan";

export { hostTime, validateSession } from "./session";
export { readDraft } from "./drafts/queries";
export { addToDraft, setDraftQuantity, removeDraftLine } from "./drafts/commands";
export { settle } from "./tenders/settle";
export { addDraftAccountTender, addDraftTender, removeDraftTender } from "./tenders/commands";
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
export {
  failStaffSignIn,
  forgetStaff,
  readStaff,
  readStoredSession,
  signInStaff,
  signOutStaff,
  unlockStaff,
} from "./staff";
export { approve, authorize, LOCK_MS, MAX_FAILURES } from "./approvals";
export { readApprovers, refreshApprovers } from "./approvers";
export {
  planRefund,
  readRefundEligibility,
  recordRefund,
  reserveCreditNote,
} from "./refunds/record";
export { findSaleByReceipt, serverPurchase } from "./refunds/queries";
export { markRefundAccepted, markRefundFailed, markRefundRejected } from "./refunds/uploads";
export { currentShift, shiftSummary } from "./shifts/queries";
export { dropCash, openShift, recordNoSale } from "./shifts/commands";
export { printShiftReport, readShiftReport } from "./shifts/report";
export { closeShift, declareShift } from "./shifts/close";
export { markShiftAccepted, markShiftFailed, markShiftRejected } from "./shifts/uploads";
export type { EligibilityView } from "./refunds/types";
