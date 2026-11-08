import { queryOptions, useMutation } from "@tanstack/react-query";
import { installResultResponse, installStateResponse } from "@shopper/auth/schemas";
import { publicFetch } from "../../api/auth/public/api";
import { ApiError } from "../../api/client";
import type { InstallValues } from "../../schemas/install/form";

/** Whether this box still needs its first-boot setup; null once it has a shop (and on the cloud, which has none). */
export const installStateQuery = () =>
  queryOptions({
    queryKey: ["install"],
    queryFn: async () => {
      try {
        return await publicFetch("/install", installStateResponse);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    retry: false,
    gcTime: 0,
  });

/** Creates the shop, first store and owner. The wizard sends the licence as the text the person pasted. */
export function useInstall() {
  return useMutation({
    gcTime: 0,
    mutationFn: (values: InstallValues) =>
      publicFetch("/install", installResultResponse, {
        method: "POST",
        body: {
          code: values.code,
          shop: { name: values.shopName, code: values.shopCode },
          store: { name: values.storeName },
          owner: { name: values.name, email: values.email, password: values.password },
          licence: values.licence ? JSON.parse(values.licence) : undefined,
        },
      }),
  });
}
