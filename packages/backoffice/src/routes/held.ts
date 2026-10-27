import { holds, type PermissionNeed } from "../lib/roles/permissions";
import { permissionsQuery } from "../queries/session/permissions";
import type { BackofficeContext } from "../types";

/** Runs a route's loader only for members who hold `need`: the others are shown the no-permission state by the screen, so nothing is fetched for them. */
export async function whenHeld(
  { queryClient }: BackofficeContext,
  need: PermissionNeed,
  load: () => unknown,
) {
  if (holds(await queryClient.ensureQueryData(permissionsQuery()), need)) await load();
}
