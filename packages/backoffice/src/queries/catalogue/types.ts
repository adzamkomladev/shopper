import * as v from "valibot";
import { branchView, priceView, productDetail } from "@shopper/core/schemas";
import { importPreview, importResult } from "@shopper/core/schemas";
import { categoryView, type productSummary } from "@shopper/core/schemas";

export type ProductDetail = v.InferOutput<typeof productDetail>;
export type PriceView = v.InferOutput<typeof priceView>;
export type BranchView = v.InferOutput<typeof branchView>;

export type ImportPreview = v.InferOutput<typeof importPreview>;
export type ImportResult = v.InferOutput<typeof importResult>;

export type CategoryView = v.InferOutput<typeof categoryView>;
export type ProductSummary = v.InferOutput<typeof productSummary>;
export type ProductSearch = { q?: string; categoryId?: string };
