import {
  B as parse,
  L as object,
  N as nonEmpty,
  P as null_,
  Q as string,
  U as pipe,
  _ as check,
  et as transform,
  h as boolean,
  k as maxLength,
  m as array,
  q as regex,
  tt as trim,
  x as forward,
} from "./react-dom-BCYT53bd.js";
import { N as fromDecimal, c as productInput, l as productPatch } from "./inputs-CH80xucg.js";
import {
  h as useMutation,
  i as currentShop,
  n as ApiError,
  q as useQueryClient,
  r as apiFetch,
} from "./createLucideIcon-DmKyVZgg.js";
import { t as queryOptions } from "./queryOptions-eKLVKX7x.js";
import { o as priceView, s as productDetail, t as branchView } from "./schemas-B4d_8FW9.js";
import { i as toast } from "./kbd-DLpSQiun.js";
import { t as parseShopTime } from "./time-ChhXrqEi.js";
import { r as messageOfError } from "./catalogue-BxH-8PyC.js";
//#region ../../packages/backoffice/src/schemas/catalogue/detail.ts
var branchList = array(branchView);
var deletedBarcode = null_();
var scheduledPrice = object({ price: priceView });
var { name, sku, baseUnit, taxClass, categoryId } = productInput.entries;
var detailsSchema = object({
  name,
  sku,
  baseUnit,
  taxClass,
  categoryId,
  onlineVisible: boolean(),
});
var DETAILS_FIELDS = ["name", "sku"];
function toDetailsBody(values) {
  return parse(productPatch, values);
}
var barcodeSchema = object({
  code: pipe(string(), trim(), nonEmpty("Enter or scan a barcode"), maxLength(64)),
  quantity: pipe(string(), trim(), regex(/^[1-9]\d{0,5}$/, "Use a whole number, 1 or more")),
});
var BARCODE_FIELDS = ["code", "quantityThousandths", "barcodes"];
var emptyBarcode = {
  code: "",
  quantity: "1",
};
function toBarcodeBody(values) {
  const { code, quantity } = parse(barcodeSchema, values);
  return {
    code,
    quantityThousandths: Number(quantity) * 1e3,
  };
}
var amount = pipe(
  string(),
  trim(),
  check((value) => {
    try {
      fromDecimal(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter an amount like 12.50"),
  transform(fromDecimal),
  check((value) => value > 0, "The amount must be more than 0"),
);
var reason = pipe(string(), trim(), nonEmpty("Give a reason"), maxLength(500));
var branchId = pipe(
  string(),
  transform((value) => (value === "all" ? void 0 : value)),
);
var instant = pipe(
  string(),
  nonEmpty("Choose a date and time"),
  check((value) => !Number.isNaN(parseShopTime(value).getTime()), "Choose a date and time"),
  transform((value) => parseShopTime(value).toISOString()),
);
var priceSchemas = {
  set: object({
    amount,
    branchId,
    reason,
  }),
  schedule: pipe(
    object({
      amount,
      branchId,
      reason,
      startsAt: instant,
      endsAt: instant,
    }),
    forward(
      check((price) => price.endsAt > price.startsAt, "The end must be after the start"),
      ["endsAt"],
    ),
    forward(
      check((price) => Date.parse(price.endsAt) > Date.now(), "The end must be in the future"),
      ["endsAt"],
    ),
  ),
};
var PRICE_FIELDS = ["amount", "branchId", "reason", "startsAt", "endsAt"];
var emptyPrice = {
  amount: "",
  branchId: "all",
  reason: "",
  startsAt: "",
  endsAt: "",
};
function toPriceBody(mode, values) {
  return parse(priceSchemas[mode], values);
}
/** The API's message when it blames one of these inputs, to show under that input. */
function failureFor(error, ...fields) {
  return error instanceof ApiError && error.field && fields.includes(error.field)
    ? failureMessage(error)
    : void 0;
}
/** What to tell the owner when a write fails. */
function failureMessage(error) {
  return error instanceof ApiError && error.status === 403
    ? "You don't have permission to change products. Ask the shop owner."
    : messageOfError(error);
}
//#endregion
//#region ../../packages/backoffice/src/queries/catalogue/detail.ts
function productQuery(productId, shop = currentShop()) {
  return queryOptions({
    queryKey: ["product", shop?.id ?? "box", productId],
    queryFn: () => apiFetch(`/products/${productId}`, productDetail, { shopId: shop?.id ?? null }),
  });
}
/** Branch names for price labels. Roles without branch.read get a 403, so callers must cope without. */
function branchesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["branches", shop?.id ?? "box"],
    queryFn: () => apiFetch("/branches", branchList, { shopId: shop?.id ?? null }),
    retry: false,
  });
}
var pinShop = (productId, shop = currentShop()) => ({
  key: productQuery(productId, shop).queryKey,
  shopId: shop?.id ?? null,
});
/** Saves the details; the list is refetched because it shows the name, SKU and price. */
function useSaveProduct(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) =>
      apiFetch(`/products/${productId}`, productDetail, {
        method: "PATCH",
        body: toDetailsBody(values),
      }),
    onMutate: () => pinShop(productId),
    onSuccess: async (detail, _values, pinned) => {
      queryClient.setQueryData(pinned.key, detail);
      toast.success("Changes saved");
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
function useAddBarcode(productId, onAdded) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => postBarcode(productId, toBarcodeBody(values)),
    onMutate: () => pinShop(productId),
    onSuccess: (barcodes, _values, pinned) => {
      queryClient.setQueryData(
        pinned.key,
        (old) =>
          old && {
            ...old,
            barcodes,
          },
      );
      toast.success("Barcode added");
      onAdded();
    },
  });
}
/** Removes a barcode. The toast offers Undo, which adds the same code and pack size back. */
function useRemoveBarcode(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (barcode) =>
      apiFetch(
        `/products/${productId}/barcodes/${encodeURIComponent(barcode.code)}`,
        deletedBarcode,
        { method: "DELETE" },
      ),
    onMutate: () => pinShop(productId),
    onSuccess: (_removed, barcode, pinned) => {
      queryClient.setQueryData(
        pinned.key,
        (old) =>
          old && {
            ...old,
            barcodes: old.barcodes.filter((item) => item.code !== barcode.code),
          },
      );
      toast.success("Barcode removed", {
        action: {
          label: "Undo",
          onClick: () =>
            void postBarcode(productId, barcode, pinned.shopId).then(
              (barcodes) =>
                queryClient.setQueryData(
                  pinned.key,
                  (old) =>
                    old && {
                      ...old,
                      barcodes,
                    },
                ),
              (error) => toast.error(failureMessage(error)),
            ),
        },
      });
    },
    onError: (error) => toast.error(failureMessage(error)),
  });
}
/** Appends a price version, or a scheduled one. The prices are refetched before the dialog closes. */
function useSavePrice(productId, mode, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values) => {
      const body = toPriceBody(mode, values);
      if (mode === "set")
        return apiFetch(`/products/${productId}/prices`, priceView, {
          method: "POST",
          body,
        });
      return apiFetch(`/products/${productId}/prices/schedule`, scheduledPrice, {
        method: "POST",
        body,
      });
    },
    onMutate: () => pinShop(productId),
    onSuccess: async (_price, _values, pinned) => {
      await queryClient.invalidateQueries({ queryKey: pinned.key });
      toast.success(mode === "set" ? "Price saved" : "Price scheduled");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
function postBarcode(productId, body, shopId = currentShop()?.id ?? null) {
  return apiFetch(`/products/${productId}/barcodes`, productDetail.entries.barcodes, {
    method: "POST",
    body,
    shopId,
  });
}
//#endregion
export {
  useSavePrice as a,
  DETAILS_FIELDS as c,
  detailsSchema as d,
  emptyBarcode as f,
  priceSchemas as g,
  failureMessage as h,
  useRemoveBarcode as i,
  PRICE_FIELDS as l,
  failureFor as m,
  productQuery as n,
  useSaveProduct as o,
  emptyPrice as p,
  useAddBarcode as r,
  BARCODE_FIELDS as s,
  branchesQuery as t,
  barcodeSchema as u,
};
