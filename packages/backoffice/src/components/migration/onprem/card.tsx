import { useRef, useState } from "react";
import { CircleAlertIcon, DownloadIcon, LoaderCircleIcon, ServerIcon, XIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { formatDay } from "@shopper/utils";
import { useOnPremArchive } from "../../../queries/migration/onprem";
import type { OnPremView } from "../../../schemas/migration";
import { CancelDialog, StartDialog } from "./dialog";
import { LicencePanel } from "./licence";
import { Mismatches } from "./report";

export const START_ID = "migration-onprem";

const CHECKLIST = [
  "Do it after closing: the back office here stops taking changes and tills stop sending sales the moment it starts.",
  "Have the box installed on the shop network, and its setup code to hand.",
  "Sign-ins, PINs and receipt numbers carry over. Tills move to the box on their own once it has checked everything.",
];

/** A cloud shop moves onto its own box: seal, install the box with the archive, licence it, and let it verify. */
export function OnPremCard({ data }: { data: OnPremView }) {
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const archive = useOnPremArchive();
  const move = data.move;
  const idle = !move || move.status === "cancelled";
  const live = move && (move.status === "open" || move.status === "claimed");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {move?.status === "archived" ? "Moved to your box" : "Run this shop on your own box"}
        </CardTitle>
        <CardDescription>
          {move?.status === "archived"
            ? `This shop now runs on its box at ${move.boxUpstream}. The cloud copy is kept read-only.`
            : "Everything in the cloud, from products and prices to sales, stock, the ledger and the audit trail, moves onto a Shopper box in your shop in one evening."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm">
        {idle && (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {move?.status === "open" && move.archive === "running" && (
          <Waiting>Sealing a signed copy of the shop, taken at one moment.</Waiting>
        )}
        {move?.status === "open" && (move.archive === "failed" || move.archive === "deleted") && (
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>The archive could not be sealed</AlertTitle>
            <AlertDescription>Call the move off and start it again.</AlertDescription>
          </Alert>
        )}
        {move?.status === "open" && move.archive === "ready" && (
          <ol className="flex flex-col gap-6">
            <Step n={1} title="Install the box with the archive">
              <p className="text-muted-foreground">
                Download the archive, copy it to the box, and run the installer with it:
              </p>
              <code className="rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">
                sudo sh shopper-box-installer.run --import archive.shopper
              </code>
              <div>
                <Button
                  variant="outline"
                  disabled={archive.isPending}
                  onClick={() => archive.mutate(move.exportJobId)}
                >
                  <DownloadIcon aria-hidden />
                  Download archive
                </Button>
              </div>
            </Step>
            <Step n={2} title="Licence the box">
              <LicencePanel issued={move.licence} />
            </Step>
            <Step n={3} title="Finish on the box">
              <p className="text-muted-foreground">
                Enter the setup code and the licence on the box's first-boot screen. It takes the
                shop over and checks every record against the cloud.
              </p>
            </Step>
          </ol>
        )}
        {move?.status === "claimed" && !move.report && (
          <Waiting>The box is importing the shop and checking it against the cloud.</Waiting>
        )}
        {move?.status === "claimed" && move.report && !move.report.ok && (
          <Mismatches report={move.report}>
            The cloud stays read-only until a check agrees. Run the import on the box again, or call
            the move off and reinstall the box.
          </Mismatches>
        )}
        {(live || move?.status === "archived") && <Registers data={data} />}
        {(idle || live) && (
          <div className="flex flex-wrap gap-2">
            {idle && (
              <Button
                ref={startButton}
                id={START_ID}
                aria-keyshortcuts="M"
                onClick={() => setStarting(true)}
              >
                <ServerIcon aria-hidden />
                Move on-prem
              </Button>
            )}
            {live && (
              <Button ref={cancelButton} variant="outline" onClick={() => setCancelling(true)}>
                <XIcon aria-hidden />
                Call the move off
              </Button>
            )}
          </div>
        )}
        {move?.completedAt && (
          <p className="text-muted-foreground">Moved on {formatDay(move.completedAt)}.</p>
        )}
      </CardContent>
      <StartDialog
        open={starting}
        onOpenChange={setStarting}
        restoreFocus={() => startButton.current?.focus()}
      />
      <CancelDialog
        open={cancelling}
        onOpenChange={setCancelling}
        restoreFocus={() => (startButton.current ?? cancelButton.current)?.focus()}
      />
    </Card>
  );
}

function Waiting({ children }: { children: string }) {
  return (
    <p role="status" className="flex items-center gap-2">
      <LoaderCircleIcon aria-hidden className="size-4 shrink-0 animate-spin" />
      {children}
    </p>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="font-medium">{title}</h2>
        {children}
      </div>
    </li>
  );
}

function Registers({ data }: { data: OnPremView }) {
  if (!data.registers.length) return null;
  const moved = data.move?.status === "archived";
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Tills</h2>
      <ul aria-label="Registers" className="flex flex-col divide-y rounded-md border">
        {data.registers.map((register) => (
          <li
            key={register.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span>{register.name}</span>
            {moved && register.deliveredAt && <Badge>Moved</Badge>}
            {moved && !register.deliveredAt && (
              <Badge variant="secondary">Waiting for it to connect</Badge>
            )}
            {!moved && (
              <span className="text-muted-foreground">Moves once the box has checked</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
