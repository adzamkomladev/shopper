import { useState } from "react";
import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { maskPhone } from "../../components/shop/phone";
import { SignInFrame } from "../../components/signin/frame";
import { PhoneStep } from "../../components/signin/phone";
import { CodeStep } from "../../components/signin/code";
import { Welcome } from "../../components/signin/welcome";

const shopRoute = getRouteApi("/$shop");

export const Route = createFileRoute("/$shop/signin")({ component: SignIn });

/** Phone, then code, then a drawn check while the account opens. */
function SignIn() {
  const shop = shopRoute.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [login, setLogin] = useState<{ loginId: string; phone: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  if (welcome) return <Welcome shopName={shop.name} />;
  if (!login)
    return (
      <SignInFrame
        shopName={shop.name}
        title="See your receipts and points"
        description={notice ?? "Sign in with your phone number. We text you a code; no password."}
      >
        <PhoneStep
          shop={shop.code}
          siteKey={shop.turnstileSiteKey}
          initialPhone={phone}
          onSent={(started) => {
            setNotice(null);
            setPhone(started.phone);
            setLogin(started);
          }}
        />
      </SignInFrame>
    );
  return (
    <SignInFrame
      shopName={shop.name}
      title="Enter your code"
      description={
        <>
          We texted a 6-digit code to{" "}
          <strong className="text-foreground">{maskPhone(login.phone)}</strong>.
        </>
      }
    >
      <CodeStep
        key={login.loginId}
        shop={shop.code}
        loginId={login.loginId}
        onRestart={(message) => {
          setNotice(message ?? null);
          setLogin(null);
        }}
        onVerified={() => {
          // Anything cached for a previous shopper on this browser goes.
          queryClient.removeQueries({ queryKey: [shop.code] });
          setWelcome(true);
          const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          setTimeout(
            () => void navigate({ to: "/$shop/account", params: { shop: shop.code } }),
            still ? 0 : 700,
          );
        }}
      />
    </SignInFrame>
  );
}
