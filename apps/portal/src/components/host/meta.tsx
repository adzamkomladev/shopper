import { useQuery } from "@tanstack/react-query";
import { readPortalHost } from "../../functions/host";

/** Publishes the host's build version and environment as document metadata; React hoists the tags into `<head>`. */
export function HostMeta() {
  const { data } = useQuery({
    queryKey: ["portal", "host"],
    queryFn: () => readPortalHost(),
    staleTime: Infinity,
    // The box serves the SPA without server functions: its 404 is the answer, not a fault to retry.
    retry: false,
  });
  if (!data) return null;
  return (
    <>
      <meta name="shopper-version" content={data.version} />
      <meta name="shopper-environment" content={data.environment} />
    </>
  );
}
