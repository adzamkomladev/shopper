import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// better-auth is a dependency of @shopper/auth, not of the repo root.
const resolver = createRequire(new URL("../../../packages/auth/package.json", import.meta.url));

/** The credential hash @shopper/auth stores for a staff password. */
export const { hashPassword } = (await import(
  pathToFileURL(resolver.resolve("better-auth/crypto")).href
)) as { hashPassword(password: string): Promise<string> };
