import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Card } from "@shopper/ui/components/card";
import { currentOrgQuery } from "../../../session/queries";
import { LoginForm } from "./form";
import { LoginSuccess } from "./success";

export function LoginScreen() {
  const { data: box } = useSuspenseQuery(currentOrgQuery);
  const { shop } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  return (
    <AppBackdrop className="grid place-items-center bg-transparent p-0 shadow-none">
      <main className="w-full max-w-3xl">
        <Card className="min-h-153 justify-center rounded-3xl border-0">
          {signedIn ? (
            <LoginSuccess onContinue={() => void navigate({ to: "/products" })} />
          ) : (
            <LoginForm
              box={box}
              defaultShopCode={shop ?? ""}
              onSignedIn={() => setSignedIn(true)}
            />
          )}
        </Card>
      </main>
    </AppBackdrop>
  );
}
