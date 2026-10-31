// The register reads the handshake leniently: a server that adds a field must not turn every till "incompatible".
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { readHandshake } from "@shopper/sync";
import { syncProtocol } from "../../support/till/server/data";

test("a handshake carrying a field this register does not know still parses", () => {
  const requestId = v7();
  expect(
    readHandshake(
      {
        requestId,
        protocol: syncProtocol,
        appVersion: "0.2.0",
        minTillVersion: "0.1.1",
        updateChannel: "pilot",
        somethingNew: { from: "a later server" },
      },
      requestId,
      syncProtocol,
    ),
  ).toMatchObject({ minTillVersion: "0.1.1", updateChannel: "pilot" });
});

test("a handshake from a server that names no minimum leaves the register unblocked", () => {
  const requestId = v7();
  expect(
    readHandshake(
      { requestId, protocol: syncProtocol, appVersion: "0.1.0" },
      requestId,
      syncProtocol,
    ),
  ).not.toHaveProperty("minTillVersion");
});
