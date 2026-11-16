import { shiftTime } from "@shopper/backoffice/kit";
import { Section } from "../../kyb/review/details";
import type { TenantDetail } from "../../../schemas/types";
import { Facts, Stats } from "./header";

/** Who to call, where the shop stands, and how big it is. */
export function TenantOverview({ shop }: { shop: TenantDetail["overview"] }) {
  return (
    <>
      <Stats
        items={[
          ["Stores", shop.counts.stores],
          ["Branches", shop.counts.branches],
          ["Registers", shop.counts.devices],
          ["Active products", shop.counts.products],
          ["Archived products", shop.counts.archived],
          ["Members", shop.counts.members],
          ["Pending invitations", shop.counts.invitations],
          ["Till updates", shop.updateChannel === "pilot" ? "Pilot" : "Stable"],
        ]}
      />
      <Section label="Owner and status">
        <Facts
          rows={[
            ["Owner", shop.owner?.name ?? "No active owner"],
            [
              "Owner email",
              shop.owner ? (
                <a
                  href={`mailto:${shop.owner.email}`}
                  className="underline-offset-4 hover:underline"
                >
                  {shop.owner.email}
                </a>
              ) : (
                "None"
              ),
            ],
            ["Joined", shiftTime(shop.createdAt)],
            ["First sale", shop.firstSaleAt ? shiftTime(shop.firstSaleAt) : "None yet"],
            ["Mode", shop.mode === "relay" ? "Relay" : "Full"],
            ["Shop id", <code className="font-mono text-xs">{shop.id}</code>],
          ]}
        />
      </Section>
    </>
  );
}
