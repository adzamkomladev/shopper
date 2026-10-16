import {
  B as parse,
  I as number,
  L as object,
  N as nonEmpty,
  Q as string,
  U as pipe,
  _ as check,
  tt as trim,
} from "./react-dom-BCYT53bd.js";
import {
  E as storeInput,
  N as fromDecimal,
  P as toDecimal,
  w as branchInput,
} from "./inputs-CH80xucg.js";
import "./schemas-B4d_8FW9.js";
import "./catalogue-BxH-8PyC.js";
//#region ../../packages/backoffice/src/schemas/management.ts
var id = string();
var storeView = object({
  id,
  name: string(),
  cashRoundingStep: number(),
  createdAt: string(),
});
var branchView = object({
  id,
  name: string(),
  storeId: id,
  createdAt: string(),
});
var { name } = storeInput.entries;
var DEFAULT_STEP = "0.01";
var storeFormSchema = object({
  name,
  cashRounding: pipe(
    string(),
    trim(),
    check((value) => {
      try {
        return fromDecimal(value) > 0;
      } catch {
        return false;
      }
    }, "Enter an amount like 0.05"),
  ),
});
var emptyStore = {
  name: "",
  cashRounding: DEFAULT_STEP,
};
var storeValues = (store) => ({
  name: store.name,
  cashRounding: toDecimal(store.cashRoundingStep),
});
function toStoreBody({ name, cashRounding }) {
  return parse(storeInput, {
    name,
    cashRoundingStep: fromDecimal(cashRounding.trim()),
  });
}
var branchFormSchema = object({
  name: branchInput.entries.name,
  storeId: pipe(string(), nonEmpty("Choose a store")),
});
var emptyBranch = (storeId = "") => ({
  name: "",
  storeId,
});
function toBranchBody(values) {
  return parse(branchInput, values);
}
//#endregion
export {
  storeFormSchema as a,
  toBranchBody as c,
  emptyStore as i,
  toStoreBody as l,
  branchView as n,
  storeValues as o,
  emptyBranch as r,
  storeView as s,
  branchFormSchema as t,
};
