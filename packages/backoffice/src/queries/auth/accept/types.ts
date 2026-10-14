import { invitationPreviewResponse } from "@shopper/auth/schemas";
import type * as v from "valibot";

export type Preview = v.InferOutput<typeof invitationPreviewResponse>;
