import { Link } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import { AuthPanel } from "../frame";

export function AlreadySetUp({ shopCode }: { shopCode: string }) {
  return (
    <AuthPanel
      title="Your shop is already set up"
      description="This link has done its job. Log in with your email and password to carry on."
    >
      <Button asChild size="lg" className="w-full rounded-full">
        <Link to="/login" search={{ shop: shopCode }}>
          Log in
        </Link>
      </Button>
    </AuthPanel>
  );
}
