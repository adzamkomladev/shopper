import * as v from "valibot";
import { registrationStartResponse } from "@shopper/auth/schemas";

export type Started = v.InferOutput<typeof registrationStartResponse>;
export type SignupValues = { name: string; email: string; shopName: string; shopCode: string };
