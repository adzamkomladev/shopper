import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { pageRef } from "../shop/focus";
import type { StoreInfo } from "../../schemas/store";
import { StoreHeader } from "../store/header";

/** The store's bar over a checkout page, its title, and a way back that Esc also takes. */
export function CheckoutFrame({
  shop,
  info,
  branchId,
  title,
  back,
  children,
}: {
  shop: string;
  info: StoreInfo;
  branchId: string;
  title: string;
  back: { to: "/$shop" | "/$shop/cart"; label: string };
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const shortcuts = useShortcuts({
    Escape: () => void navigate({ to: back.to, params: { shop }, search: { branch: branchId } }),
  });
  return (
    <div ref={pageRef(shortcuts)} tabIndex={-1} className="min-h-dvh outline-none">
      <StoreHeader shop={shop} info={info} branchId={branchId} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-6 pb-16 sm:px-6">
        <Link
          to={back.to}
          params={{ shop }}
          search={{ branch: branchId }}
          aria-keyshortcuts="Escape"
          className="inline-flex h-10 items-center gap-2 rounded-full pr-3 font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
