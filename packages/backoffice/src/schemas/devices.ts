import * as v from "valibot";
import { deviceListItem } from "@shopper/auth/schemas";

export const deviceRow = v.object(deviceListItem.entries);
export type DeviceView = v.InferOutput<typeof deviceRow>;
export const enrolment = v.object({ code: v.string(), expiresAt: v.string() });

export const deviceList = v.array(deviceRow);

export const revocationResponse = v.looseObject({});

export const pinResponse = v.looseObject({});
