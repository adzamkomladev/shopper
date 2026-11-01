import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { useNow } from "@shopper/ui/hooks/use-now";
import { Loader2 } from "lucide-react";
import { ShopApiError, shopFetch } from "../../queries/api";
import { codeResent, loginVerified } from "../../schemas/shop";
import { CodeSlots } from "./slots";

const RESEND_SECONDS = 30;

/** Step two: the six-digit code. It submits on the sixth digit; a wrong one shakes and says how many tries are left. */
export function CodeStep({
  shop,
  loginId,
  onVerified,
  onRestart,
}: {
  shop: string;
  loginId: string;
  onVerified: () => void;
  onRestart: (message?: string) => void;
}) {
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ended, setEnded] = useState<"locked" | "expired" | null>(null);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const now = useNow(1000);
  const wait = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));
  const path = `/${shop}/signin/${loginId}`;

  const verify = useMutation({
    mutationFn: (typed: string) =>
      shopFetch(`${path}/verify`, loginVerified, { body: { code: typed } }),
    onSuccess: onVerified,
    onError: (error) => {
      setCode("");
      if (error instanceof ShopApiError && error.status === 400 && error.attemptsLeft) {
        setAttempt((count) => count + 1);
        const tries = error.attemptsLeft === 1 ? "1 try" : `${error.attemptsLeft} tries`;
        return setMessage(`That code is not right. ${tries} left.`);
      }
      // A locked login takes no more codes: the shopper starts again with the number kept.
      setEnded(error instanceof ShopApiError && error.status === 423 ? "locked" : "expired");
      setMessage(error.message);
    },
  });
  const resend = useMutation({
    mutationFn: () => shopFetch(`${path}/resend`, codeResent, { body: {} }),
    onSuccess: (result) => {
      if (!result.sent) return onRestart("That sign-in has used its codes. Start again.");
      setSentAt(Date.now());
      setEnded(null);
      setAttempt(0);
      setMessage("We sent a new code.");
    },
    onError: (error) => onRestart(error.message),
  });
  const invalid = attempt > 0 && code === "" && !ended && !verify.isPending;

  return (
    <div className="space-y-5">
      <CodeSlots
        key={attempt}
        code={code}
        invalid={invalid}
        disabled={verify.isPending || ended !== null}
      >
        <input
          aria-label="Sign-in code"
          aria-describedby="code-message"
          aria-invalid={invalid || undefined}
          className="absolute inset-0 size-full cursor-text rounded-2xl bg-transparent text-transparent caret-transparent outline-none"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          disabled={verify.isPending || ended !== null}
          value={code}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            if (digits.length === 6) verify.mutate(digits);
          }}
        />
      </CodeSlots>
      <p
        id="code-message"
        role="status"
        className={
          invalid || ended
            ? "text-sm font-medium text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {verify.isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Checking your code
          </span>
        ) : (
          (message ?? "It can take a few seconds to arrive.")
        )}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="rounded-full font-semibold" onClick={() => onRestart()}>
          Change number
        </Button>
        <Button
          variant={ended ? "default" : "outline"}
          className="relative h-11 overflow-hidden rounded-full px-5 font-semibold"
          disabled={(wait > 0 && !ended) || resend.isPending}
          onClick={() => (ended === "locked" ? onRestart(message ?? undefined) : resend.mutate())}
        >
          {/* The bar runs down while the next code is not yet allowed. */}
          {wait > 0 && !ended ? (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-1000 ease-linear"
              style={{ width: `${(wait / RESEND_SECONDS) * 100}%` }}
            />
          ) : null}
          <span className="relative">
            {ended === "locked"
              ? "Start again"
              : wait > 0 && !ended
                ? `Send again in 0:${String(wait).padStart(2, "0")}`
                : "Send a new code"}
          </span>
        </Button>
      </div>
    </div>
  );
}
