import { test } from "vite-plus/test";
import { workflowLauncherConformance } from "@shopper/conformance";
import { launcher, prepareRegistration, track, waitForEnd } from "../../support/workflows/auth";

workflowLauncherConformance("box auth launcher", test, async (expired) => {
  const params = await prepareRegistration(expired);
  const flow = launcher();
  track(params.id);
  return {
    launcher: flow,
    instanceId: params.id,
    params,
    waitForEnd: () => waitForEnd(params.id),
    close: async () => {
      await flow.start(params.id, params);
      await flow.send(params.id, "auth-action", { action: "completed" });
      await waitForEnd(params.id);
    },
  };
});
