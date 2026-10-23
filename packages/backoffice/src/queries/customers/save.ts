import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { toCreateBody, toPatchBody, type CustomerValues } from "../../schemas/customers/form";
import { customerView } from "../../schemas/customers/view";
import type { CustomerView } from "./types";

/**
 * Creates a customer under `id` (a UUIDv7 made when the form opened, so a retry replays), or edits
 * `editing`. Every customer list and page is refetched, so each shows the change.
 */
export function useSaveCustomer(
  id: string,
  editing: CustomerView | undefined,
  onSaved: (saved: CustomerView) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerValues) =>
      apiFetch(editing ? `/customers/${editing.id}` : "/customers", customerView, {
        method: editing ? "PATCH" : "POST",
        body: editing ? toPatchBody(values) : toCreateBody(id, values),
      }),
    onSuccess: async (saved) => {
      toast.success(editing ? "Customer saved" : "Customer added");
      onSaved(saved);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
