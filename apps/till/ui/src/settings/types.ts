import type { RegisterSettings } from "@shopper/core/schemas";
import type { HostStatus } from "@shopper/sync/bridge";
import type { HostConnection } from "../connection/types";

export type PrinterStatus = HostStatus["printer"];
export type DeviceAction = "test" | "drawer";
export type DeviceFeedback = {
  action: DeviceAction;
  status: "running" | "done" | "failed";
  message: string | null;
  /** When the host answered, in epoch milliseconds. */
  at: number | null;
};
export type SaveError = { kind: "stale" | "storage" | "permission"; message: string };
/** The host's saved settings, present only while the register host is connected. */
export type SettingsCurrent = {
  revision: number;
  value: RegisterSettings;
  canEdit: boolean;
  printer: PrinterStatus;
  registerCode: string;
};
export type SettingsSnapshot = {
  host: HostConnection;
  current: SettingsCurrent | null;
  saving: boolean;
  saveError: SaveError | null;
  device: DeviceFeedback | null;
};
export type SettingsActions = {
  /** Resolves true when the host saved the settings. */
  save: (settings: RegisterSettings, expectedRevision: number) => Promise<boolean>;
  /** Both resolve with the final feedback, so the screen can toast it as well as show it inline. */
  testPrint: () => Promise<DeviceFeedback>;
  openDrawer: () => Promise<DeviceFeedback>;
  /** Re-reads the host's settings, or reconnects when the host is gone. */
  reload: () => Promise<void>;
};
export type DraftErrors = Partial<Record<string, string>>;
export type PrinterBadge = "none" | "unchecked" | "connected" | "offline";

/** Named focus targets for the settings form, so a handler can move focus without reaching into the DOM. */
export type Focus = {
  ref: (key: string) => (node: HTMLElement | null) => () => void;
  to: (key: string) => void;
};
