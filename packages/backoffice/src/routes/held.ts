import type { PermissionCode } from "../lib/roles/permissions";
import { permissionsQuery } from "../queries/session/permissions";
import type { BackofficeContext } from "../types";

/** Runs a route's loader only for members who hold `code`: the others are shown the no-permission state by the screen, so nothing is fetched for them. */
export async function whenHeld(
  { queryClient }: BackofficeContext,
  code: PermissionCode,
  load: () => unknown,
) {
  if ((await queryClient.ensureQueryData(permissionsQuery())).includes(code)) await load();
}
