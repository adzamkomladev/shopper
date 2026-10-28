import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { usePermissions } from "../../queries/session/permissions";
import { setupQuery } from "../../queries/setup";
import type { SetupStep } from "../../schemas/setup";

/** In an empty screen the wizard covers: the way back to its step, while the shop is still being set up. */
export function SetupStepLink({ step }: { step: SetupStep }) {
  const { data } = useQuery({ ...setupQuery(), retry: false });
  const canWrite = !!usePermissions()?.includes("store.write");
  if (data?.status !== "setup" || !canWrite) return null;
  return (
    <Button asChild variant="outline">
      <Link to="/setup" search={{ step }}>
        <ListChecksIcon aria-hidden />
        Back to setup
      </Link>
    </Button>
  );
}
