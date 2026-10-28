import { useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AuthFrame, LoginForm } from "@shopper/backoffice/kit";
import { platformOrgQuery } from "../../../queries/platform";

/** Staff sign in as members of the platform org; no shop code, and no signup. */
export function LoginScreen() {
  const { data: platform } = useSuspenseQuery(platformOrgQuery);
  const navigate = useNavigate();
  return (
    <AuthFrame>
      <LoginForm
        // Named for the card: the org's own name repeats the brand above it.
        box={{ id: platform.id, name: "Admin" }}
        defaultShopCode=""
        lead="Shopper staff only. Sign in to review business verifications and the shops on Shopper."
        onSignedIn={() => void navigate({ to: "/kyb" })}
      />
    </AuthFrame>
  );
}
