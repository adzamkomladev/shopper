import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { api, appVersion } from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";

test("a legacy register must update and re-bootstrap before tender sales", async () => {
  for (const protocol of [1, 2]) {
    const response = await api.request("/sync/handshake", {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify({ requestId: v7(), appVersion, protocol }),
    });
    expect(response.status).toBe(409);
  }
});
