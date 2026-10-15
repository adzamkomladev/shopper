import { useQuery } from "@tanstack/react-query";
import { readPortalHost } from "../../functions/host";

/** Publishes the host's build version and environment as document metadata; React hoists the tags into `<head>`. */
export function HostMeta() {
  const { data } = useQuery({
    queryKey: ["portal", "host"],
    queryFn: () => readPortalHost(),
    staleTime: Infinity,
  });
  if (!data) return null;
  return (
    <>
      <meta name="shopper-version" content={data.version} />
      <meta name="shopper-environment" content={data.environment} />
    </>
  );
}
