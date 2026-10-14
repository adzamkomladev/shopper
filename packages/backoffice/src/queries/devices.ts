import { deviceList, revocationResponse, pinResponse } from "../schemas/devices";
import { enrolment, type DeviceView } from "../schemas/devices";
export { type DeviceView } from "../schemas/devices";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { enrollmentIssueInput, pinInput, revokeDeviceInput } from "@shopper/auth/schemas";
import { apiFetch } from "../api/client";
import { permissionsQuery } from "./session/permissions";
import { currentShop } from "../stores/shops";

// The server's own schema is strict; a field added later should not break this screen.

export function devicesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["devices", shop?.id ?? "box"],
    queryFn: () => apiFetch("/devices", deviceList, { shopId: shop?.id ?? null }),
  });
}

/** What the devices screen needs before it can draw. Branches and members load after: they are optional context. */
export const devicesScreenQueries = () => [devicesQuery(), permissionsQuery()];

/** Makes a six-digit code a till redeems once, within minutes. */
export function useIssueEnrolment() {
  return useMutation({
    gcTime: 0,
    mutationFn: (branchId: string) =>
      apiFetch("/devices/enrollment", enrolment, {
        method: "POST",
        body: v.parse(enrollmentIssueInput, { branchId }),
      }),
  });
}

export function useRevokeDevice(onRevoked: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (device: DeviceView) =>
      apiFetch("/devices/revoke", revocationResponse, {
        method: "POST",
        body: v.parse(revokeDeviceInput, { deviceId: device.id }),
      }),
    onSuccess: async () => {
      toast.success("Device revoked");
      onRevoked();
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

/** Sets or replaces a member's till PIN. */
export function useSavePin(onSaved: () => void) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (input: { userId: string; pin: string; name: string }) => {
      try {
        return await apiFetch("/cashiers/pin", pinResponse, {
          method: "POST",
          body: v.parse(pinInput, { userId: input.userId, pin: input.pin }),
        });
      } finally {
        input.pin = "";
      }
    },
    onSuccess: (_result, input) => {
      toast.success(`PIN saved for ${input.name}`);
      onSaved();
    },
  });
}
