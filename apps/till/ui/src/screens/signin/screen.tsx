import { useState } from "react";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { SignInForm } from "../../components/signin/form";
import { SignInNotices } from "../../components/signin/notices";
import { UnlockDialog } from "../../components/signin/unlock";
import { TitleBar } from "../../components/shell/titlebar";
import type { HostConnection } from "../../connection/types";
import { loadingApprovers } from "../../sale/approvers";
import type { Approval, ApproverState, SaleOutcome } from "../../sale/types";
import type { SignInSnapshot } from "../../session/types";

/**
 * Figma "New Login": the title bar, then a centred column with the app name, the security sentence and
 * the form. It draws the sign-in snapshot and reports the attempt through `onSubmit`.
 */
export function SignInScreen({
  host,
  offline,
  snapshot,
  onSubmit,
  onReconnect,
  onUnlock,
  readApprovers,
}: {
  host: HostConnection;
  /** The server is unreachable; the host can still sign in a cashier it knows. */
  offline: boolean;
  snapshot: SignInSnapshot;
  onSubmit: (email: string, password: string) => Promise<boolean>;
  onReconnect: () => void;
  onUnlock: (email: string, approval: Approval) => Promise<SaleOutcome>;
  /** Who may lift a sign-in lock on this register, as the host answers now. */
  readApprovers: () => Promise<ApproverState>;
}) {
  // The dialog opens once the host has answered, so focus lands on the manager field, not a skeleton.
  const [approvers, setApprovers] = useState<ApproverState | null>(null);
  const [opening, setOpening] = useState(false);
  const email = snapshot.failure?.code === "SIGN_IN_LOCKED" ? snapshot.failure.email : undefined;
  async function openUnlock() {
    if (opening) return;
    setOpening(true);
    setApprovers(await readApprovers());
    setOpening(false);
  }
  async function retryApprovers() {
    setApprovers(loadingApprovers("staff.unlock"));
    const answered = await readApprovers();
    // Cancelled while the list loaded: stay closed.
    setApprovers((current) => current && answered);
  }
  const register = useShortcuts({
    "Alt+C": onReconnect,
    "Mod+U": () => {
      if (email) void openUnlock();
    },
  });
  return (
    <div className="flex h-svh min-h-0 flex-col bg-background" ref={register}>
      <TitleBar />
      <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-8">
        <div className="grid w-full max-w-xl gap-8 sm:gap-10">
          <h1 className="flex items-center justify-center gap-3 text-4xl font-semibold tracking-tight">
            <span aria-hidden="true" className="size-12 rounded-full bg-border" />
            Shopper App
          </h1>
          <p className="text-center text-base font-medium">
            For security reasons please enter your username and password to continue using Point Of
            Sales
          </p>
          <SignInNotices
            failure={snapshot.failure}
            host={host}
            offline={offline}
            onReconnect={onReconnect}
            onUnlock={() => void openUnlock()}
            unlocking={opening}
          />
          <SignInForm
            disabled={host !== "connected"}
            onSubmit={onSubmit}
            signing={snapshot.status === "signing"}
          />
        </div>
      </main>
      {email && approvers && (
        <UnlockDialog
          approvers={approvers}
          email={email}
          onOpenChange={(open) => !open && setApprovers(null)}
          onRetryApprovers={() => void retryApprovers()}
          onSubmit={async (approval) => {
            const outcome = await onUnlock(email, approval);
            if (outcome.ok) setApprovers(null);
            return outcome;
          }}
          open
        />
      )}
    </div>
  );
}
