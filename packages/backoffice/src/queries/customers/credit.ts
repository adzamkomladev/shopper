import { useMutation, useQueryClient } from "@tanstack/react-query";
import type * as v from "valibot";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { transferred } from "../../schemas/customers/account";
import { customerView } from "../../schemas/customers/view";

type Call<S extends v.GenericSchema> = {
  method: "POST" | "PUT";
  path: string;
  schema: S;
  done: string;
  onDone: () => void;
};

/** One change to an account. Every customer list and page is refetched, so each shows it. */
function useAccountChange<S extends v.GenericSchema>({
  method,
  path,
  schema,
  done,
  onDone,
}: Call<S>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiFetch(path, schema, { method, body }),
    onSuccess: async () => {
      toast.success(done);
      onDone();
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Money paid onto the account under `body.id`, so a retry replays instead of counting twice. */
export function useRecordPayment(id: string, onDone: () => void) {
  return useAccountChange({
    method: "POST",
    path: `/customers/${id}/payments`,
    schema: customerView,
    done: "Payment recorded",
    onDone,
  });
}

export function useAddCreditNote(id: string, onDone: () => void) {
  return useAccountChange({
    method: "POST",
    path: `/customers/${id}/credit/notes`,
    schema: customerView,
    done: "Credit note added",
    onDone,
  });
}

export function useSetCreditLimit(id: string, onDone: () => void) {
  return useAccountChange({
    method: "PUT",
    path: `/customers/${id}/limit`,
    schema: customerView,
    done: "Credit limit saved",
    onDone,
  });
}

/** Moves points from this customer to the one in `body.toId`. */
export function useTransferPoints(onDone: () => void) {
  return useAccountChange({
    method: "POST",
    path: "/loyalty/transfers",
    schema: transferred,
    done: "Points transferred",
    onDone,
  });
}
