import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ReadOnlyNote } from "../../components/admin/states";
import { OfflineNote } from "../../components/register/states";
import { SetupRail } from "../../components/setup/rail";
import { SetupStepPanel } from "../../components/setup/panel";
import { STEPS } from "../../lib/setup/steps";
import { permissionsQuery } from "../../queries/session/permissions";
import { setupQuery, useSetupMove } from "../../queries/setup";

/** The setup wizard: the steps with where each stands, and the one on screen with its own form. */
export function SetupScreen() {
  const search = useSearch({ from: "/_shop/setup" });
  const { data: progress } = useSuspenseQuery(setupQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const navigate = useNavigate();
  const online = useOnline();
  const move = useSetupMove();
  const canWrite = held.includes("store.write");
  const current = search.step ?? progress.next ?? "done";
  const done = Object.fromEntries(progress.steps.map((each) => [each.step, each.done]));
  const shortcuts = useShortcuts(
    Object.fromEntries(
      STEPS.map(({ step }, index) => [
        `Alt+${index + 1}`,
        () => void navigate({ to: "/setup", search: { step } }),
      ]),
    ),
  );
  const leave = () =>
    move.mutate("dismiss", { onSuccess: () => void navigate({ to: "/products" }) });
  return (
    <div ref={shortcuts} className="flex flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Get your shop ready</h1>
          <p className="text-sm text-muted-foreground">
            {progress.steps.filter((each) => each.done).length} of {progress.steps.length} steps
            done. Your progress is kept as you go.
          </p>
        </div>
        {canWrite && !progress.finished && (
          <Button variant="outline" onClick={leave} disabled={!online || move.isPending}>
            Finish later
          </Button>
        )}
      </header>
      {!online && (
        <OfflineNote>
          You're offline. You can look through the steps; saving needs a connection.
        </OfflineNote>
      )}
      {!canWrite && (
        <ReadOnlyNote>
          You can see how setup is going. The shop's owner makes these changes.
        </ReadOnlyNote>
      )}
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <SetupRail current={current} done={done} />
        <SetupStepPanel step={current} progress={progress} held={held} />
      </div>
    </div>
  );
}
