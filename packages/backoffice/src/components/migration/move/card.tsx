import { useRef, useState } from "react";
import { CheckIcon, CircleAlertIcon, CloudUploadIcon, LoaderCircleIcon } from "lucide-react";
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
import type { MoveView } from "../../../schemas/migration";
import { MoveDialog } from "./dialog";

export const MOVE_ID = "migration-move";

const STEPS = [
  {
    status: "sealing",
    label: "Sealing",
    hint: "A signed copy of everything, taken at one moment.",
  },
  {
    status: "uploading",
    label: "Sending",
    hint: "Each file once; a dropped line picks up where it stopped.",
  },
  {
    status: "importing",
    label: "Opening in the cloud",
    hint: "The cloud checks every file, then takes the shop in one go.",
  },
] as const;

const CHECKLIST = [
  "Do it after closing: the back office here stops taking changes the moment it starts.",
  "Leave the box and the tills switched on and connected until every till shows Moved.",
  "Sign-ins, PINs and receipt numbers carry over. Nobody needs a new password.",
];

/** The move from start to finish: what happens, where it is, which tills have followed, and why it failed. */
export function MoveCard({ data }: { data: MoveView }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const move = data.move;
  const idle = !move || move.status === "failed";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {move?.status === "moved" ? "Moved to the cloud" : "Your shop on Shopper Cloud"}
        </CardTitle>
        <CardDescription>
          {move?.status === "moved"
            ? `This shop now runs in the cloud at ${move.cloudUrl}. Make changes in the cloud portal; this box only reads.`
            : "Everything on this box, from products and prices to sales, stock, the ledger and the audit trail, moves to the cloud in one evening. Tills keep their place and their receipt numbers."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm">
        {move?.status === "failed" && (
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>The move stopped</AlertTitle>
            <AlertDescription>
              {move.error ?? "Something went wrong."} The box takes changes again until you retry.
            </AlertDescription>
          </Alert>
        )}
        {idle && (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {move && !idle && move.status !== "moved" && <Steps current={move.status} />}
        <Registers data={data} />
        {idle && (
          <div>
            <Button ref={button} id={MOVE_ID} aria-keyshortcuts="M" onClick={() => setOpen(true)}>
              <CloudUploadIcon aria-hidden />
              {move ? "Try again" : "Move to cloud"}
            </Button>
          </div>
        )}
        {move?.completedAt && (
          <p className="text-muted-foreground">Moved on {formatDay(move.completedAt)}.</p>
        )}
      </CardContent>
      <MoveDialog
        key={move?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        cloudUrl={move?.cloudUrl}
        restoreFocus={() => button.current?.focus()}
      />
    </Card>
  );
}

function Steps({ current }: { current: string }) {
  const at = STEPS.findIndex((step) => step.status === current);
  return (
    <ol aria-label="Steps" className="flex flex-col gap-3">
      {STEPS.map((step, index) => (
        <li
          key={step.status}
          aria-current={index === at ? "step" : undefined}
          className="flex items-start gap-3"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border">
            {index < at && <CheckIcon aria-hidden className="size-3.5" />}
            {index === at && <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" />}
          </span>
          <span className="flex flex-col">
            <span className={index > at ? "text-muted-foreground" : "font-medium"}>
              {step.label}
              {index < at && <span className="sr-only"> (done)</span>}
            </span>
            <span className="text-muted-foreground">{step.hint}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Registers({ data }: { data: MoveView }) {
  if (!data.registers.length)
    return <p className="text-muted-foreground">No tills are enrolled on this box.</p>;
  const moved = data.move?.status === "moved";
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
              <span className="text-muted-foreground">Follows the shop when it next connects</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
