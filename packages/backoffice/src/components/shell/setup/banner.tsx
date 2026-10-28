import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { usePermissions } from "../../../queries/session/permissions";
import { setupQuery } from "../../../queries/setup";

/** Until the first sale, the owner keeps a way back into the wizard from every screen but the wizard itself. */
export function SetupBanner() {
  const { data } = useQuery({ ...setupQuery(), retry: false });
  const canWrite = !!usePermissions()?.includes("store.write");
  const onSetup = useLocation({ select: (location) => location.pathname.endsWith("/setup") });
  if (data?.status !== "setup" || !canWrite || onSetup) return null;
  const done = data.steps.filter((each) => each.done).length;
  return (
    <Alert role="region" aria-label="Shop setup">
      <ListChecksIcon aria-hidden />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>
          {done} of {data.steps.length} steps done. Finish setting up to start selling.
        </span>
        <Link to="/setup" className="font-medium text-foreground underline underline-offset-4">
          Continue setup
        </Link>
      </AlertDescription>
    </Alert>
  );
}
