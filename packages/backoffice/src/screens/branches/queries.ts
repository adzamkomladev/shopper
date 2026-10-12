import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { apiFetch } from "../../api/client";
import {
  branchView,
  toBranchBody,
  type BranchValues,
  type BranchView,
} from "../../schemas/management";

export { branchesQuery } from "../catalogue/detail/queries";

/** Creates a branch, or updates `editing` when given. The list is refetched so it shows the change. */
export function useSaveBranch(editing: { id: string } | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BranchValues) =>
      apiFetch(editing ? `/branches/${editing.id}` : "/branches", branchView, {
        method: editing ? "PATCH" : "POST",
        body: toBranchBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Branch saved" : "Branch added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

export function useDeleteBranch(onDeleted: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branch: Pick<BranchView, "id">) =>
      apiFetch(`/branches/${branch.id}`, v.null(), { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Branch deleted");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}
