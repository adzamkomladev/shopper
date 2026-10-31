import type { AppUpdater } from "electron-updater";
import type { UpdatePolicy, UpdateState } from "./types";

type Updater = Pick<
  AppUpdater,
  | "autoDownload"
  | "autoInstallOnAppQuit"
  | "setFeedURL"
  | "checkForUpdates"
  | "quitAndInstall"
  | "on"
>;

// A client timer, not business logic: the feed is read at start (the host's first policy) and every 4 hours.
const every = 4 * 60 * 60 * 1000;

/**
 * Keeps the register on its channel's feed (`${feed}/${channel}/`, the generic provider's latest.yml) and downloads
 * what is newer. A ready update installs when the register next quits, so it never interrupts a shift. It installs
 * at once only when the server requires it and no shift is open, or when a cashier confirms between shifts.
 */
export function createUpdates(
  updater: Updater,
  feed: string,
  report: (state: UpdateState) => void,
) {
  let policy: UpdatePolicy | undefined;
  let state: UpdateState = { state: "idle", version: null, percent: null };
  let url = "";
  const set = (next: Partial<UpdateState>) => {
    state = { ...state, ...next };
    report(state);
  };
  const installNow = () => updater.quitAndInstall(true, true);
  const installIfRequired = () => {
    if (policy?.required && !policy.shiftOpen && state.state === "ready") installNow();
  };
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on("checking-for-update", () => {
    if (state.state !== "ready") set({ state: "checking", percent: null });
  });
  updater.on("update-available", (info) => set({ state: "available", version: info.version }));
  updater.on("update-not-available", () => set({ state: "idle", version: null, percent: null }));
  updater.on("download-progress", (progress) =>
    set({ state: "downloading", percent: Math.round(progress.percent) }),
  );
  updater.on("update-downloaded", (info) => {
    set({ state: "ready", version: info.version, percent: 100 });
    installIfRequired();
  });
  updater.on("error", () => {
    if (state.state !== "ready") set({ state: "error", percent: null });
  });
  const check = () => {
    if (!policy) return;
    const next = `${feed}/${policy.channel}/`;
    if (next !== url) updater.setFeedURL({ provider: "generic", url: (url = next) });
    // The `error` event already reported it; a feed that is down never stops the register.
    updater.checkForUpdates().catch(() => undefined);
  };
  const timer = setInterval(check, every);
  timer.unref();
  return {
    policy(next: UpdatePolicy) {
      const moved = next.channel !== policy?.channel;
      policy = next;
      if (moved) check();
      installIfRequired();
    },
    /** A cashier's Restart now: refused while a shift is open or before the download is ready. */
    install() {
      if (policy?.shiftOpen || state.state !== "ready") return false;
      installNow();
      return true;
    },
    /** A cashier's Retry after a failed download. */
    check,
    stop: () => clearInterval(timer),
  };
}
