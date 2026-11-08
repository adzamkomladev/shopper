import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { Kbd } from "@shopper/ui/components/kbd";
import { formatDay } from "@shopper/utils";
import { useLicenceCheckIn } from "../../queries/billing";
import type { LicenceView } from "../../schemas/billing";

export const CHECK_IN_ID = "licence-check-in";

const STATE = {
  valid: { label: "Valid", variant: "default" },
  grace: { label: "Check in soon", variant: "secondary" },
  locked: { label: "Read-only", variant: "destructive" },
} as const;

const REASON = {
  missing: "This box has no licence yet. Send the request code below to Shopper support.",
  unreadable: "The licence file can't be read. Send the request code below to Shopper support.",
  forged:
    "The licence file was not issued by Shopper. Send the request code below to Shopper support.",
  machine:
    "The licence belongs to another machine. Send this box's request code below to Shopper support.",
  expired:
    "The box has not checked in for 60 days, so the back office is read-only. Tills keep selling. Check in now once the box is online.",
} as const;

/** The box's perpetual licence: its state, its terms, and either Check in now or the code to request one. */
export function LicenceCard({ licence }: { licence: LicenceView }) {
  const checkIn = useLicenceCheckIn();
  const state = STATE[licence.state];
  const terms = licence.reason === "machine" ? undefined : licence.licence;
  return (
    <Card>
      <CardHeader>
        <CardDescription>Licence</CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-3">
          {terms?.site ?? "Shopper box"} <Badge variant={state.variant}>{state.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">{summary(licence)}</p>
        {terms && (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Term label="Registers">{terms.terminals}</Term>
            <Term label="Updates until">{formatDay(terms.maintenanceUntil)}</Term>
            <Term label="Last check-in">
              {licence.checkedInAt ? formatDay(licence.checkedInAt) : "Not yet"}
            </Term>
            <Term label="Licence">
              <span className="font-mono text-xs break-all">{terms.id}</span>
            </Term>
          </dl>
        )}
        {!terms && <RequestCode code={licence.request} />}
      </CardContent>
      {terms && (
        <CardFooter>
          <Button
            id={CHECK_IN_ID}
            variant={licence.state === "valid" ? "outline" : "default"}
            aria-keyshortcuts="C"
            disabled={checkIn.isPending}
            onClick={() => checkIn.mutate()}
          >
            <RefreshCwIcon aria-hidden className={checkIn.isPending ? "animate-spin" : undefined} />
            {checkIn.isPending ? "Checking in…" : "Check in now"}
            <Kbd aria-hidden className="ml-1 hidden sm:inline-flex">
              C
            </Kbd>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function summary(licence: LicenceView) {
  if (licence.reason) return REASON[licence.reason];
  const by = licence.locksAt ? formatDay(licence.locksAt) : "";
  if (licence.state === "grace")
    return `Check in by ${by} to keep the back office open. The box checks in each night when it is online.`;
  return `Perpetual licence. The box checks in each night when it is online; the next check-in is due by ${by}.`;
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export function RequestCode({ code }: { code: string }) {
  const copy = () =>
    navigator.clipboard.writeText(code).then(
      () => toast.success("Request code copied"),
      () => toast.error("Couldn't copy. Select the code and copy it instead."),
    );
  return (
    <div className="flex flex-col gap-2">
      <span id="licence-request" className="font-medium">
        Request code
      </span>
      <div className="flex items-start gap-2">
        <code
          aria-labelledby="licence-request"
          className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all select-all"
        >
          {code}
        </code>
        <Button variant="outline" size="icon" aria-label="Copy request code" onClick={copy}>
          <CopyIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}
