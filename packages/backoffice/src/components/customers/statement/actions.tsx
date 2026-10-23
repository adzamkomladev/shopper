import { CopyIcon, DownloadIcon, MailIcon, MessageSquareIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useOnline } from "@shopper/ui/hooks/use-online";
import {
  useCopyStatementLink,
  useDownloadStatementPdf,
  useSendStatement,
} from "../../../queries/customers/statements";
import type { Range } from "../../../lib/customers/types";

const NO_EMAIL_ID = "statement-no-email";

type Props = { customerId: string; email: string | null; range: Range; ready: boolean };

/** Send the statement by SMS or email, download it as a PDF, or copy a link to it. */
export function StatementActions({ customerId, email, range, ready }: Props) {
  const online = useOnline();
  const send = useSendStatement(customerId);
  const copy = useCopyStatementLink(customerId);
  const pdf = useDownloadStatementPdf(customerId);
  const idle = online && ready;
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Share the statement" className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!idle || send.isPending}
          onClick={() => send.mutate({ channel: "sms", ...range })}
        >
          <MessageSquareIcon aria-hidden />
          Send by SMS
        </Button>
        <Button
          variant="outline"
          disabled={!idle || !email || send.isPending}
          aria-describedby={email ? undefined : NO_EMAIL_ID}
          onClick={() => send.mutate({ channel: "email", ...range })}
        >
          <MailIcon aria-hidden />
          Send by email
        </Button>
        <Button
          variant="outline"
          disabled={!idle || pdf.isPending}
          onClick={() => pdf.mutate(range)}
        >
          <DownloadIcon aria-hidden />
          {pdf.isPending ? "Preparing…" : "Download PDF"}
        </Button>
        <Button
          variant="outline"
          disabled={!idle || copy.isPending}
          onClick={() => copy.mutate(range)}
        >
          <CopyIcon aria-hidden />
          Copy link
        </Button>
      </div>
      {!email && (
        <p id={NO_EMAIL_ID} className="text-sm text-muted-foreground">
          Add an email address to this customer to send the statement by email.
        </p>
      )}
    </div>
  );
}
