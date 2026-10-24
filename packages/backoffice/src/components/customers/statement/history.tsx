import { useQuery } from "@tanstack/react-query";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { dayTime, fullDay } from "../../../lib/customers/format";
import { statementDeliveriesQuery, statementLinksQuery } from "../../../queries/customers/account";
import { useRevokeStatementLink } from "../../../queries/customers/statements";
import { QueryPanel } from "../detail/panel";

const CHANNELS = { sms: "SMS", email: "Email", pdf: "PDF" } as const;
const section = "flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm";
const empty = "text-sm text-muted-foreground";

/** The links that still open a statement, each with Revoke. A revoked or expired link no longer works, so it is not listed. */
export function ActiveLinks({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const query = useQuery(statementLinksQuery(customerId));
  const online = useOnline();
  const revoke = useRevokeStatementLink(customerId);
  return (
    <section aria-labelledby="links-heading" className={section}>
      <h3 id="links-heading" className="font-medium">
        Active links
      </h3>
      <QueryPanel query={query} what="links">
        {(links) => {
          const active = links.filter(
            (link) => !link.revokedAt && Date.parse(link.expiresAt) > Date.now(),
          );
          if (active.length === 0) return <p className={empty}>No links are open.</p>;
          return (
            <ul className="flex flex-col divide-y">
              {active.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                  <div className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="font-medium">
                      {fullDay(link.from)} to {fullDay(link.to)}
                    </span>
                    <span className="text-muted-foreground">
                      Expires {fullDay(link.expiresAt)} ·{" "}
                      {link.viewCount === 0
                        ? "Not opened"
                        : `Opened ${link.viewCount} ${link.viewCount === 1 ? "time" : "times"}`}
                    </span>
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!online || revoke.isPending}
                      aria-label={`Revoke the link for ${fullDay(link.from)} to ${fullDay(link.to)}`}
                      onClick={() => revoke.mutate(link.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          );
        }}
      </QueryPanel>
    </section>
  );
}

/** The statements sent to them and what became of each. */
export function Deliveries({ customerId }: { customerId: string }) {
  const query = useQuery(statementDeliveriesQuery(customerId));
  return (
    <section aria-labelledby="deliveries-heading" className={section}>
      <h3 id="deliveries-heading" className="font-medium">
        Sent statements
      </h3>
      <QueryPanel query={query} what="sent statements">
        {({ items }) =>
          items.length === 0 ? (
            <p className={empty}>Nothing has been sent yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {items.map((delivery) => (
                <li key={delivery.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                  <div className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="font-medium">
                      {CHANNELS[delivery.channel]}: {fullDay(delivery.from)} to{" "}
                      {fullDay(delivery.to)}
                    </span>
                    <span className="text-muted-foreground">{dayTime(delivery.createdAt)}</span>
                  </div>
                  <Badge variant={delivery.status === "failed" ? "destructive" : "outline"}>
                    {delivery.status === "queued"
                      ? "Queued"
                      : delivery.status === "sent"
                        ? "Sent"
                        : "Failed"}
                  </Badge>
                </li>
              ))}
            </ul>
          )
        }
      </QueryPanel>
    </section>
  );
}
