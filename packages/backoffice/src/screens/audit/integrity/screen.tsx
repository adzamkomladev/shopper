import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import { IntegritySkeleton } from "../../../components/audit/integrity/states";
import { StreamsTable } from "../../../components/audit/integrity/streams";
import { AuditPage } from "../../../components/audit/tabs";
import { auditStreamsQuery, verifyStream } from "../../../queries/audit/integrity";
import type { Verdict } from "../../../schemas/audit";

/** Each audit chain re-hashed on demand, end to end, with a plain pass or fail and the entry that broke it. */
export function AuditIntegrityScreen() {
  return (
    <Gate need="audit.read" what="the audit chains" fallback={<IntegritySkeleton />}>
      <IntegrityBody />
    </Gate>
  );
}

function IntegrityBody() {
  const { data: streams } = useSuspenseQuery(auditStreamsQuery());
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const online = useOnline();
  const checking = Object.values(verdicts).includes("checking");
  const verify = (stream: string) => {
    setVerdicts((current) => ({ ...current, [stream]: "checking" }));
    return verifyStream(stream).then(
      (verdict) => setVerdicts((current) => ({ ...current, [stream]: verdict })),
      (error: Error) =>
        setVerdicts((current) => ({ ...current, [stream]: { failed: error.message } })),
    );
  };
  // One at a time: each check re-reads a whole chain from the database.
  const verifyAll = async () => {
    if (checking || !online) return;
    for (const stream of streams) await verify(stream.stream);
  };
  const shortcuts = useShortcuts({ V: () => void verifyAll() });
  return (
    <AuditPage
      active="integrity"
      action={
        <Button
          onClick={() => void verifyAll()}
          disabled={checking || !online}
          aria-keyshortcuts="V"
        >
          <ShieldCheckIcon aria-hidden />
          Verify all
          <Kbd aria-hidden className="bg-primary-foreground/5">
            V
          </Kbd>
        </Button>
      }
    >
      <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
        {!online && <OfflineNote>Checking a chain needs a connection.</OfflineNote>}
        <Alert>
          <ShieldCheckIcon aria-hidden />
          <AlertTitle>Every entry seals the one before it</AlertTitle>
          <AlertDescription>
            Verifying re-hashes a chain from its first entry. A changed, missing or reordered entry
            fails the check and names where. Each day's last entries are also emailed to the owners.
          </AlertDescription>
        </Alert>
        <StreamsTable
          streams={streams}
          verdicts={verdicts}
          onVerify={(stream) => void verify(stream)}
          disabled={checking || !online}
        />
      </div>
    </AuditPage>
  );
}
