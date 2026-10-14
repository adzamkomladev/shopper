import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { focusOnMount } from "../../../../../lib/focus";
import { AuthPanel } from "../../../frame";
import type { LinkCredentials as Link } from "../../../../../api/auth/public/api";
import { useVerify } from "../../../../../queries/auth/verify/registration";

type Props = { link: Link; email: string; shopName: string };

/** Opening the link only previews it; this button is what verifies the address. */
export function VerifyStep({ link, email, shopName }: Props) {
  const verify = useVerify(link);
  return (
    <AuthPanel
      title="Verify your email"
      description={
        <>
          You're setting up <strong className="text-foreground">{shopName}</strong> with{" "}
          <strong className="text-foreground">{email}</strong>.
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {verify.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{verify.error.message}</AlertDescription>
          </Alert>
        )}
        <Button
          size="lg"
          className="w-full rounded-full"
          onClick={() => verify.mutate()}
          disabled={verify.isPending}
          ref={focusOnMount}
        >
          {verify.isPending && <Loader2Icon className="animate-spin" />}
          {verify.isPending ? "Verifying…" : "Verify email"}
        </Button>
      </div>
    </AuthPanel>
  );
}
