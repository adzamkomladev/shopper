import type { HostStatus } from "@shopper/sync/bridge";
import { serverLabelFor, serverState } from "../../screens/connection/details";
import type { HostConnection } from "../../connection/types";
import type { ShellLink } from "./types";

/** The status bar's connection: the register host first, then the server it syncs with. */
export function shellLink(host: HostConnection, status: HostStatus | null): ShellLink {
  if (host === "connecting") return { label: "Connecting", state: "pending", online: false };
  if (host === "disconnected") return { label: "Disconnected", state: "problem", online: false };
  const server = status?.server ?? null;
  return { label: serverLabelFor(server), state: serverState(server), online: server === "online" };
}
