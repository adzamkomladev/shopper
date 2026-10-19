import { hashPassword, verifyPassword } from "better-auth/crypto";

export const hashPin = (pin: string) => hashPassword(pin);

/** True when `pin` matches a hash made by `hashPin`, the way `cashier.pin.assign` stores it. */
export function verifyPin(hash: string, pin: string) {
  return verifyPassword({ hash, password: pin });
}
