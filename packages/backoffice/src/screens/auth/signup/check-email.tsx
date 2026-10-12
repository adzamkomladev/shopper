import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { focusOnMount } from "../../../lib/focus";
import { AuthPanel } from "../frame";
import { deliveryQuery, useResend, type Started } from "./queries";

type Props = { started: Started; onChangeEmail: () => void };

export function CheckEmail({ started, onChangeEmail }: Props) {
  const delivery = useQuery({ ...deliveryQuery(started), initialData: started.deliveryStatus });
  const resend = useResend(started);
  const status = delivery.data;
  return (
    <AuthPanel
      title="Check your email"
      description={
        <>
          We sent a link to <strong className="text-foreground">{started.email}</strong>. Open it to
          confirm it's you. The link works for 24 hours.
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {status === "failed" && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              We couldn't send the email. Resend it, or go back and check the address.
            </AlertDescription>
          </Alert>
        )}
        <p role="status" className="text-sm text-muted-foreground">
          {status === "pending" && "Sending the email…"}
          {status === "sent" && "The email was sent."}
          {resend.isSuccess && " Another email is on its way. It can take a minute to arrive."}
        </p>
        {resend.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{resend.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            size="lg"
            className="rounded-full sm:flex-1"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            ref={focusOnMount}
          >
            {resend.isPending && <Loader2Icon className="animate-spin" />}
            Resend email
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full sm:flex-1"
            onClick={() => void delivery.refetch()}
            disabled={delivery.isFetching}
          >
            Check delivery
          </Button>
        </div>
        <Button variant="link" className="self-start px-0" onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
    </AuthPanel>
  );
}
