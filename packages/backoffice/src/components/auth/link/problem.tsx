import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { LinkIcon, WifiOffIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { CardContent } from "@shopper/ui/components/card";
import { AuthFrame } from "../frame";
import { linkProblem, type LinkProblem } from "../../../api/auth/public/api";

type Copy = { title: string; description: string };

/** `subject` names the link in the heading and the fix for a broken one ("verification", "invitation"). */
export function linkProblemScreen(subject: "verification" | "invitation") {
  const broken: Record<typeof subject, Copy & { action: { label: string; to: string } }> = {
    verification: {
      title: "This verification link doesn't work",
      description:
        "It may have expired, or it isn't the link we emailed you. Start again to get a new one.",
      action: { label: "Start again", to: "/signup" },
    },
    invitation: {
      title: "This invitation link doesn't work",
      description:
        "It may have expired, been used, cancelled or replaced. Ask the shop owner to send a new invitation.",
      action: { label: "Log in", to: "/login" },
    },
  };
  const others: Record<Exclude<LinkProblem, "broken">, Copy> = {
    unreachable: {
      title: "Can't reach the server",
      description: "Check your connection and try again. Nothing you entered here has been lost.",
    },
    closed: {
      title: "Shops can't be created here",
      description:
        "This till server belongs to one shop. Log in, or ask the shop owner for access.",
    },
    busy: {
      title: "Too many attempts",
      description: "Wait about ten seconds, then try again.",
    },
    unavailable: {
      title: "Something went wrong",
      description: "We couldn't load this page. Try again in a moment.",
    },
  };
  return function LinkProblemScreen({ error, reset }: ErrorComponentProps) {
    const router = useRouter();
    const kind = linkProblem(error);
    const copy = kind === "broken" ? broken[subject] : others[kind];
    return (
      <AuthFrame>
        <CardContent className="flex flex-col items-start gap-9 px-6 sm:px-22">
          {kind === "unreachable" ? (
            <WifiOffIcon aria-hidden className="size-10 text-muted-foreground" />
          ) : (
            <LinkIcon aria-hidden className="size-10 text-muted-foreground" />
          )}
          <div className="flex flex-col gap-5">
            <h1 className="text-4xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-lg font-medium text-muted-foreground">{copy.description}</p>
          </div>
          {kind === "broken" ? (
            <Button asChild size="lg" className="rounded-full">
              <Link to={broken[subject].action.to}>{broken[subject].action.label}</Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="rounded-full"
              onClick={() => {
                reset();
                void router.invalidate();
              }}
            >
              Try again
            </Button>
          )}
        </CardContent>
      </AuthFrame>
    );
  };
}
