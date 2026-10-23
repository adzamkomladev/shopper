// Test-only sale actions for the till UI harness: they record the call, then change the snapshot as the host would.
import type { Dispatch, SetStateAction } from "react";
import { printFailure } from "../../src/purchases/delivery";
import type { ReceiptPrint, SaleActions, SaleSnapshot } from "../../src/sale/types";
import { approvalActions } from "../approvals";
import { scenarios } from "../scenarios";
import { customerActions } from "./customers";
import { addTender } from "./tenders";

type Recorder = (type: string) => (...args: unknown[]) => unknown;
type SetSale = Dispatch<SetStateAction<SaleSnapshot>>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const refused = "connection refused (192.168.1.50:9100)";

export function saleActions(
  name: string,
  record: Recorder,
  setSale: SetSale,
  printerFails: boolean,
): SaleActions {
  const sale: SaleActions = {
    search: record("search"),
    add: record("add"),
    setQuantity: record("setQuantity"),
    removeLine: record("removeLine"),
    addTender: (input) => {
      record("addTender")(input);
      setSale((current) => addTender(current, input));
    },
    charge: (input) => {
      record("charge")(input);
      completeSale(name, setSale, name === "lines-slowprint" ? 1500 : 120);
    },
    complete: () => {
      record("complete")();
      completeSale(name, setSale, 120);
    },
    removeTender: record("removeTender"),
    startMomo: (input) => {
      record("startMomo")(input);
      setSale((current) => ({ ...current, view: scenarios["momo-otp"]!.view }));
    },
    submitMomoOtp: (input) => {
      record("submitMomoOtp")(input);
      setSale((current) => ({ ...current, view: scenarios["momo-confirmed"]!.view }));
    },
    hold: record("holdSale"),
    listHeld: record("listHeld"),
    resume: record("resumeSale"),
    ...approvalActions(name, record, setSale),
    ...customerActions(record, setSale),
    newSale: () => {
      record("newSale")();
      const initial = scenarios.lines!;
      const view = initial.view;
      setSale(
        view?.draft
          ? {
              ...initial,
              view: {
                ...view,
                draft: { ...view.draft, id: "10000000-0000-7000-8000-000000000101", revision: 0 },
              },
            }
          : initial,
      );
    },
    newSaleWith: (input) => {
      record("newSaleWith")(input);
      sale.newSale();
    },
    print: async (saleId) => {
      record("print")(saleId);
      await sleep(300);
      setSale((current) => withPrint(current, saleId, printerFails ? "failed" : "printed"));
      return printerFails
        ? { status: "failed", message: printFailure(refused) }
        : { status: "done", message: null };
    },
    dismissFeedback: record("dismissFeedback"),
    syncNow: record("syncNow"),
    reconnect: record("reconnect"),
  };
  return sale;
}

/** Completes the sale, then plays out the automatic print after `delay` ms. */
function completeSale(name: string, setSale: SetSale, delay: number) {
  const receipt = scenarios.complete!.receipt!;
  const pending = { saleId: receipt.saleId, outcome: null, message: null };
  setSale((current) => ({ ...current, view: null, receipt, receiptPrint: pending }));
  setTimeout(
    () =>
      setSale((current) => {
        const register = current.register;
        if (!register?.printAutomatically || register.printer.state === "unconfigured")
          return current;
        const outcome =
          name === "lines-stuck"
            ? "unknown"
            : register.printer.state === "offline"
              ? "failed"
              : "printed";
        return withPrint(current, receipt.saleId, outcome);
      }),
    delay,
  );
}

function withPrint(
  snapshot: SaleSnapshot,
  saleId: string,
  outcome: NonNullable<ReceiptPrint["outcome"]>,
): SaleSnapshot {
  const message = outcome === "failed" ? printFailure(refused) : null;
  return { ...snapshot, receiptPrint: { saleId, outcome, message } };
}
