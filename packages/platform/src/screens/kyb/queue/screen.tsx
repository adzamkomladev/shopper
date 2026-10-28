import { useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { NoCases } from "../../../components/kyb/queue/states";
import { QueueTable } from "../../../components/kyb/queue/table";
import { QueueTabs } from "../../../components/kyb/queue/tabs";
import { kybQueueQuery } from "../../../queries/platform";

/** Business verifications by status, the longest-waiting first. */
export function KybQueueScreen() {
  const { status } = useSearch({ from: "/_staff/kyb" });
  const { data } = useSuspenseQuery(kybQueueQuery(status));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Business verification</h1>
      <QueueTabs active={status}>
        {data.length === 0 ? <NoCases status={status} /> : <QueueTable cases={data} />}
      </QueueTabs>
    </div>
  );
}
