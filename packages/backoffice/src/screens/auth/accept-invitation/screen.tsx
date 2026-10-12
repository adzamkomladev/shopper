import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AuthFrame } from "../frame";
import { LoginSuccess } from "../login/success";
import { brokenLink } from "../public-api";
import { JoinForm } from "./join-form";
import { invitationQuery } from "./queries";

export function AcceptInvitationScreen() {
  const navigate = useNavigate();
  const [joined, setJoined] = useState(false);
  return (
    <AuthFrame>
      {joined ? (
        <LoginSuccess onContinue={() => void navigate({ to: "/products" })} />
      ) : (
        <Invitation onJoined={() => setJoined(true)} />
      )}
    </AuthFrame>
  );
}

// Its own component, so signing in (which clears cached data) never re-reads the used link.
function Invitation({ onJoined }: { onJoined: () => void }) {
  const { id, token } = useSearch({ from: "/accept-invitation" });
  if (!id || !token) brokenLink();
  const link = { id, token };
  const { data: preview } = useSuspenseQuery(invitationQuery(link));
  return <JoinForm link={link} preview={preview} onJoined={onJoined} />;
}
