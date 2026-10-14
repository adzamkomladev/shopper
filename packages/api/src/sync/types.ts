import type { createDeviceService } from "@shopper/auth/devices";

export type LiveUpgrade = (
  request: Request,
  principal: Principal,
  cursor: string,
) => Promise<Response>;

export type Principal = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createDeviceService>["resolveUploadPrincipal"]>>
>;
