import type { EnsureQueryDataOptions } from "@tanstack/react-query";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { ListSkeleton } from "../components/admin/states";
import { branchesQuery } from "../queries/branches";
import { devicesScreenQueries } from "../queries/devices";
import { rolesScreenQueries } from "../queries/roles";
import { storesQuery } from "../queries/stores";
import { usersScreenQueries } from "../queries/users";
import { usersSearch } from "../schemas/users";
import { permissionsQuery } from "../queries/session/permissions";
import type { BackofficeContext } from "../types";

type Context = { context: BackofficeContext };

// Each screen lists the queries it needs. Their data types differ, so the list is loaded untyped.
const loadAll = ({ queryClient }: BackofficeContext, queries: readonly unknown[]) =>
  Promise.all(queries.map((query) => queryClient.ensureQueryData(query as EnsureQueryDataOptions)));

/** Stores, branches, people and devices: the screens an owner sets the shop up with. */
export function administrationRoutes(shopRoute: AnyRoute) {
  const storesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stores",
    loader: ({ context }: Context) =>
      Promise.all([
        context.queryClient.ensureQueryData(storesQuery()),
        context.queryClient.ensureQueryData(permissionsQuery()),
      ]),
    component: lazyRouteComponent(() => import("../screens/stores/screen"), "StoresScreen"),
    ...routeStates,
    pendingComponent: () => <ListSkeleton label="Loading stores" />,
  });
  const branchesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/branches",
    loader: async ({ context }: Context) => {
      const held = await context.queryClient.ensureQueryData(permissionsQuery());
      await Promise.all([
        context.queryClient.ensureQueryData(branchesQuery()),
        ...(held.includes("store.read")
          ? [context.queryClient.ensureQueryData(storesQuery())]
          : []),
      ]);
    },
    component: lazyRouteComponent(() => import("../screens/branches/screen"), "BranchesScreen"),
    ...routeStates,
    pendingComponent: () => <ListSkeleton label="Loading branches" />,
  });
  const usersRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/users",
    validateSearch: usersSearch,
    loader: ({ context }: Context) => loadAll(context, usersScreenQueries()),
    component: lazyRouteComponent(() => import("../screens/users/screen"), "UsersScreen"),
    ...routeStates,
    pendingComponent: () => <ListSkeleton label="Loading users" />,
  });
  const rolesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/roles",
    loader: ({ context }: Context) => loadAll(context, rolesScreenQueries()),
    component: lazyRouteComponent(() => import("../screens/roles/screen"), "RolesScreen"),
    ...routeStates,
    pendingComponent: () => <ListSkeleton label="Loading roles" />,
  });
  const devicesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/devices",
    loader: ({ context }: Context) => loadAll(context, devicesScreenQueries()),
    component: lazyRouteComponent(() => import("../screens/devices/screen"), "DevicesScreen"),
    ...routeStates,
    pendingComponent: () => <ListSkeleton label="Loading devices" />,
  });
  return [storesRoute, branchesRoute, usersRoute, rolesRoute, devicesRoute];
}
