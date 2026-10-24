import { useQuery } from "@tanstack/react-query";
import { customerSearchQuery } from "./list";
import type { CustomerView } from "./types";

/** The other active customers on this customer's phone number; none for one who is archived or merged. */
export function useSharedPhone({ id, phone, archivedAt }: CustomerView) {
  const { data } = useQuery({ ...customerSearchQuery(phone), enabled: !archivedAt });
  return data?.items.filter((other) => other.id !== id && other.phone === phone) ?? [];
}
