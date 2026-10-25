import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { auditDetail, auditFacets, auditPage, type AuditSearch } from "../../schemas/audit";
import { currentShop } from "../../stores/shops";

const key = (shop = currentShop()) => ["audit", shop?.id ?? "box"] as const;

/** The API's query string for the Log's filters: days become the shop's (UTC) day bounds, `to` inclusive. */
export function auditParams(search: AuditSearch) {
  const params = new URLSearchParams();
  for (const name of [
    "actor",
    "role",
    "device",
    "branch",
    "entity",
    "entityId",
    "command",
  ] as const)
    if (search[name]) params.set(name, search[name]);
  if (search.from) params.set("from", `${search.from}T00:00:00.000Z`);
  if (search.to)
    params.set("to", new Date(Date.parse(`${search.to}T00:00:00.000Z`) + 86_400_000).toISOString());
  return params;
}

/** The merged log, newest first, 50 a page. */
export function auditListQuery(search: AuditSearch) {
  const params = auditParams(search);
  return infiniteQueryOptions({
    queryKey: [...key(), "list", params.toString()],
    queryFn: ({ pageParam }) => {
      const page = new URLSearchParams(params);
      if (pageParam) page.set("cursor", pageParam);
      return apiFetch(`/audit?${page}`, auditPage);
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.next ?? undefined,
  });
}

export const auditEntryQuery = (id: string) =>
  queryOptions({
    queryKey: [...key(), "entry", id],
    queryFn: () => apiFetch(`/audit/${id}`, auditDetail),
  });

/** Who and what the log has seen, for the filter menus. */
export const auditFacetsQuery = () =>
  queryOptions({
    queryKey: [...key(), "facets"],
    queryFn: () => apiFetch("/audit/facets", auditFacets),
  });
