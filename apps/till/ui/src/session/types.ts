/** Host error codes the sign-in form explains; anything else shows the host's own message. */
export type SignInFailureCode =
  | "INVALID_CREDENTIALS"
  | "SIGN_IN_LOCKED"
  | "OFFLINE_UNAVAILABLE"
  | "DEVICE_REJECTED"
  | "SIGN_IN_UNAVAILABLE"
  | "HOST_UNREACHABLE"
  | "OTHER";

export type SignInFailure = { code: SignInFailureCode; message: string };
export type SignInSnapshot = {
  status: "idle" | "signing";
  failure: SignInFailure | null;
};
