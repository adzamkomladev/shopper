import { Activity, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gate, OfflineNote } from "../../../components/register/states";
import { ModeSwitch } from "../../../components/stock/document/switch";
import type { Mode } from "../../../components/stock/document/types";
import { InventorySkeleton } from "../../../components/stock/document/skeleton";
import { StockQueue } from "../../../components/stock/document/queue";
import { permissionsQuery } from "../../../queries/session/permissions";
import { ReadOnlyNote } from "../../../components/admin/states";
import { CountScreen } from "../count/screen";
import { ReceivingScreen } from "../receiving/screen";

/** Inventory: a stock count or a delivery (one switch), and the queue of what was entered. */
export function RegisterInventory({ online = true }: { online?: boolean }) {
  return (
    <Gate fallback={<InventorySkeleton />} need="stock.read" what="inventory">
      <Inventory online={online} />
    </Gate>
  );
}

function Inventory({ online }: { online: boolean }) {
  const [mode, setMode] = useState<Mode>("count");
  const canWrite = useQuery(permissionsQuery()).data?.includes("stock.write");
  return (
    <div className="flex flex-col gap-6 pb-6">
      {!online && (
        <OfflineNote>
          Counts and deliveries are saved on this register and upload when it reconnects.
        </OfflineNote>
      )}
      {canWrite ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="flex min-w-0 flex-col gap-5">
            <ModeSwitch mode={mode} onChange={setMode} />
            <Activity mode={mode === "count" ? "visible" : "hidden"}>
              <CountScreen />
            </Activity>
            <Activity mode={mode === "receiving" ? "visible" : "hidden"}>
              <ReceivingScreen />
            </Activity>
          </div>
          <StockQueue />
        </div>
      ) : (
        <>
          <ReadOnlyNote>
            You can see the queue but not enter stock. Ask a manager for stock access.
          </ReadOnlyNote>
          <StockQueue />
        </>
      )}
    </div>
  );
}
