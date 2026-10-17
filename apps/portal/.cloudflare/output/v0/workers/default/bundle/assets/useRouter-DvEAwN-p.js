import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
//#region ../../node_modules/.pnpm/@tanstack+router-core@1.171.34/node_modules/@tanstack/router-core/dist/esm/utils.js
/**
 * Return the last element of an array.
 * Intended for non-empty arrays used within router internals.
 */
function last(arr) {
  return arr[arr.length - 1];
}
/**
 * Apply a value-or-updater to a previous value.
 * Accepts either a literal value or a function of the previous value.
 */
function functionalUpdate(updater, previous) {
  if (typeof updater === "function") return updater(previous);
  return updater;
}
var hasOwn = Object.prototype.hasOwnProperty;
function hasKeys(obj) {
  for (const key in obj) if (hasOwn.call(obj, key)) return true;
  return false;
}
var createNull = () => Object.create(null);
var nullReplaceEqualDeep = (prev, next) => replaceEqualDeep(prev, next, true);
function replaceEqualDeep(prev, next, _nullProto, _depth = 0) {
  return next;
}
function isPlainObject(o) {
  if (!o || typeof o !== "object") return false;
  return (Object.getPrototypeOf(o)?.constructor ?? Object) === Object;
}
/**
 * Perform a deep equality check optimized for router state comparisons.
 *
 * - `partial`: `b` may omit keys that `a` has (arrays stay length-exact).
 * - `explicitUndefined`: keys holding `undefined` take part in the comparison
 *   instead of being ignored.
 *
 * Internal: the flags are positional so hot callers pass no options object.
 */
function deepEqual(a, b, partial, explicitUndefined) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0, l = a.length; i < l; i++) {
      const av = a[i];
      const bv = b[i];
      if (av !== bv && !deepEqual(av, bv, partial, explicitUndefined)) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    if (partial) {
      for (const k in b)
        if (explicitUndefined || b[k] !== void 0) {
          if (!deepEqual(a[k], b[k], partial, explicitUndefined)) return false;
        }
      return true;
    }
    let aCount = 0;
    if (explicitUndefined) aCount = Object.keys(a).length;
    else for (const k in a) if (a[k] !== void 0) aCount++;
    for (const k in b)
      if (explicitUndefined || b[k] !== void 0) {
        if (aCount-- === 0 || !deepEqual(a[k], b[k], partial, explicitUndefined)) return false;
      }
    return aCount === 0;
  }
  return false;
}
/**
 * Heuristically detect dynamic import "module not found" errors
 * across major browsers for lazy route component handling.
 */
function isModuleNotFoundError(error) {
  if (typeof error?.message !== "string") return false;
  return (
    error.message.startsWith("Failed to fetch dynamically imported module") ||
    error.message.startsWith("error loading dynamically imported module") ||
    error.message.startsWith("Importing a module script failed")
  );
}
function isPromise(value) {
  return Boolean(value && typeof value === "object" && typeof value.then === "function");
}
/**
 * Re-encode characters that are unsafe in URL paths.
 * Includes ASCII control characters (0x00-0x1F, 0x7F) and a subset of the
 * WHATWG URL "path percent-encode set" (", <, >, `, {, }).
 *
 * Space (0x20) is intentionally excluded — decodeURI decodes %20 to space
 * and the router stores decoded spaces in location.pathname. The existing
 * encodePathLikeUrl already handles re-encoding spaces for outgoing URLs.
 *
 * These characters are decoded by decodeURI but must remain percent-encoded
 * in paths to match how upstream layers (CDNs, edge middleware, browsers)
 * interpret the URL, preventing infinite redirect loops and path mismatches.
 */
var PATH_UNSAFE_RE = /[\x00-\x1f\x7f"<>`{}]/g;
function sanitizePathSegment(segment) {
  return segment.replace(
    PATH_UNSAFE_RE,
    (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
  );
}
function decodeSegment(segment) {
  let decoded;
  try {
    decoded = decodeURI(segment);
  } catch {
    decoded = segment.replaceAll(/%[0-9A-F]{2}/gi, (match) => {
      try {
        return decodeURI(match);
      } catch {
        return match;
      }
    });
  }
  return sanitizePathSegment(decoded);
}
/**
 * Default list of URL protocols to allow in links, redirects, and navigation.
 * Any absolute URL protocol not in this list is treated as dangerous by default.
 */
var DEFAULT_PROTOCOL_ALLOWLIST = ["http:", "https:", "mailto:", "tel:"];
/**
 * Extract the explicit URL scheme, including its colon, using WHATWG
 * normalization rules. This does not validate the rest of the URL.
 *
 * Returning `undefined` means "no explicit scheme", not "safe URL";
 * protocol-relative URLs such as "//evil.example" require a separate check.
 */
function getUrlScheme(url) {
  if (url[0] === "/") return;
  if (!url.includes(":")) return;
  return /^[\x00-\x20]*([a-z][a-z\d+.\t\n\r-]*:)/i
    .exec(url)?.[1]
    ?.replace(/[\t\n\r]/g, "")
    .toLowerCase();
}
var protocolRelativePrefixRegex = /^[\x00-\x20]*[\\/][\t\n\r]*[\\/]/;
/**
 * Check if a URL string uses a protocol that is not in the allowlist or is
 * protocol-relative (e.g. "//evil.example"), which can navigate to another host.
 * Returns true for blocked protocols like javascript:, blob:, and data:, as
 * well as slash/backslash variants of protocol-relative URLs.
 *
 * Scheme parsing normalizes:
 * - Mixed case (JavaScript: → javascript:)
 * - Whitespace/control characters (java\nscript: → javascript:)
 * - Leading whitespace
 *
 * For relative URLs without a protocol-relative prefix, returns false.
 *
 * @param url - The URL string to check
 * @param allowlist - Set of protocols to allow
 * @returns true if the URL uses a protocol that is not allowed or can escape
 * the current origin through a protocol-relative URL
 */
function isDangerousProtocol(url, allowlist) {
  if (!url) return false;
  if (protocolRelativePrefixRegex.test(url)) return true;
  const scheme = getUrlScheme(url);
  return scheme ? !allowlist.has(scheme) : false;
}
var HTML_ESCAPE_LOOKUP = {
  "&": "\\u0026",
  ">": "\\u003e",
  "<": "\\u003c",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
var HTML_ESCAPE_REGEX = /[&><\u2028\u2029]/g;
/**
 * Escape HTML special characters in a string to prevent XSS attacks
 * when embedding strings in script tags during SSR.
 *
 * This is essential for preventing XSS vulnerabilities when user-controlled
 * content is embedded in inline scripts.
 */
function escapeHtml(str) {
  return str.replace(HTML_ESCAPE_REGEX, (match) => HTML_ESCAPE_LOOKUP[match]);
}
function decodePath(path) {
  if (!path) return path;
  let result = path;
  if (/[%\\\x00-\x1f\x7f]/.test(path)) {
    const re = /%25|%5C/gi;
    let cursor = 0;
    let match;
    result = "";
    while (null !== (match = re.exec(path))) {
      result += decodeSegment(path.slice(cursor, match.index)) + match[0];
      cursor = re.lastIndex;
    }
    result += decodeSegment(cursor ? path.slice(cursor) : path);
  }
  return result;
}
/**
 * Encodes a path the same way `new URL()` would, but without the overhead of full URL parsing.
 *
 * This function encodes:
 * - Whitespace characters (spaces → %20, tabs → %09, etc.)
 * - Non-ASCII/Unicode characters (emojis, accented characters, etc.)
 *
 * It preserves:
 * - Already percent-encoded sequences (won't double-encode %2F, %25, etc.)
 * - ASCII special characters valid in URL paths (@, $, &, +, etc.)
 * - Forward slashes as path separators
 *
 * Used to generate proper href values for SSR without constructing URL objects.
 *
 * @example
 * encodePathLikeUrl('/path/file name.pdf') // '/path/file%20name.pdf'
 * encodePathLikeUrl('/path/日本語') // '/path/%E6%97%A5%E6%9C%AC%E8%AA%9E'
 * encodePathLikeUrl('/path/already%20encoded') // '/path/already%20encoded' (preserved)
 */
function encodePathLikeUrl(path) {
  if (!/[\s\u0080-\uFFFF]/.test(path)) return path;
  return path.replace(/\s|[^\u0000-\u007F]/gu, encodeURIComponent);
}
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+router-core@1.171.34/node_modules/@tanstack/router-core/dist/esm/path.js
/** Remove repeated slashes from a path string. */
function cleanPath(path) {
  return path.replace(/\/{2,}/g, "/");
}
/** Trim leading slashes (except preserving root '/'). */
function trimPathLeft(path) {
  return path === "/" ? path : path.replace(/^\/+/, "");
}
/** Trim trailing slashes (except preserving root '/'). */
function trimPathRight(path) {
  const len = path.length;
  return len > 1 && path[len - 1] === "/" ? path.replace(/\/+$/, "") : path;
}
/** Trim both leading and trailing slashes. */
function trimPath(path) {
  return trimPathRight(trimPathLeft(path));
}
/** Remove a trailing slash from value when appropriate for comparisons. */
function removeTrailingSlash(value, basepath) {
  if (value?.endsWith("/") && value !== "/" && value !== `${basepath}/`) return value.slice(0, -1);
  return value;
}
/**
 * Resolve a destination path against a base, honoring trailing-slash policy
 * and supporting relative segments (`.`/`..`) and absolute `to` values.
 *
 * Internal: parameters are positional so the router's hot callers pass no
 * options object.
 */
function resolvePath(base, to, trailingSlash = "never", cache) {
  if (to.includes("//")) to = cleanPath(to);
  if (to.startsWith("/")) {
    if (to.length === 1 || trailingSlash === "preserve") return to;
    if (trailingSlash === "always") return to.endsWith("/") ? to : `${to}/`;
    return to.endsWith("/") ? to.slice(0, -1) : to;
  }
  const isBase = to === ".";
  let key;
  if (cache) {
    key = isBase ? base : base + "\0" + to;
    const cached = cache.get(key);
    if (cached) return cached;
  }
  let baseSegments;
  if (isBase) baseSegments = base.split("/");
  else {
    if (base.includes("//")) base = cleanPath(base);
    baseSegments = base.split("/");
    while (baseSegments.length > 1 && last(baseSegments) === "") baseSegments.pop();
    const toSegments = to.split("/");
    for (let index = 0, length = toSegments.length; index < length; index++) {
      const value = toSegments[index];
      if (value === "") {
        if (!index) baseSegments = [value];
        else if (index === length - 1) baseSegments.push(value);
      } else if (value === "..")
        if (baseSegments.length > 1) baseSegments.pop();
        else baseSegments = [""];
      else if (value === ".") {
      } else baseSegments.push(value);
    }
  }
  if (baseSegments.length > 1) {
    if (last(baseSegments) === "") {
      if (trailingSlash === "never") baseSegments.pop();
    } else if (trailingSlash === "always") baseSegments.push("");
  }
  const joined = baseSegments.join("/");
  const result = (isBase ? cleanPath(joined) : joined) || "/";
  if (key && cache) cache.set(key, result);
  return result;
}
/**
 * Create a pre-compiled decode config from allowed characters.
 * Created once for the router's fixed encoding configuration.
 */
function compileDecodeCharMap(pathParamsAllowedCharacters) {
  const charMap = new Map(
    pathParamsAllowedCharacters.map((char) => [encodeURIComponent(char), char]),
  );
  const regex = new RegExp([...charMap.keys()].join("|").replace(/[.*()]/g, "\\$&"), "g");
  return (encoded) => encoded.replace(regex, (match) => charMap.get(match) ?? match);
}
/** A splat is missing when it has no value; `0` and `false` are stringified like any other param. */
function isMissingSplat(value) {
  return value == null || value === "";
}
function encodeParam(key, value, decoder) {
  if (typeof value !== "string") return "" + (value ?? void 0);
  const splat = key === "_splat";
  if (splat && (!value || /^[a-zA-Z0-9\-._~!/]*$/.test(value))) return value;
  let encoded = encodeURIComponent(value);
  if (splat) encoded = encoded.replaceAll("%2F", "/");
  return decoder ? decoder(encoded) : encoded;
}
/** Substitute current values into parsed segments, optionally collecting raw params. */
function interpolatePath(path, segments, params, decoder, usedParams) {
  const trailingSlash = path.endsWith("/") ? "/" : "";
  let joined = "";
  for (const part of segments) {
    if (typeof part === "string") {
      joined += part;
      continue;
    }
    const [kind, key, prefix, rawSuffix] = part;
    const splat = kind === 2;
    const suffix = splat && rawSuffix !== void 0 ? rawSuffix + trailingSlash : rawSuffix;
    let paramValue = params[key];
    if (kind === 3 && paramValue == null) continue;
    if (usedParams) {
      usedParams[key] = paramValue;
      if (splat) usedParams["*"] = paramValue;
    }
    if (splat && isMissingSplat(paramValue)) {
      if (prefix === "/" && !suffix) continue;
      paramValue = "";
    }
    joined += prefix + encodeParam(key, paramValue, decoder) + (suffix || "");
  }
  return joined + trailingSlash || "/";
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/ClientOnly.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var getSnapshot = () => true;
var getServerSnapshot = () => false;
/**
 * Render the children only after the JS has loaded client-side. Use an optional
 * fallback component if the JS is not yet loaded.
 *
 * @example
 * Render a Chart component if JS loads, renders a simple FakeChart
 * component server-side or if there is no JS. The FakeChart can have only the
 * UI without the behavior or be a loading spinner or skeleton.
 *
 * ```tsx
 * return (
 *   <ClientOnly fallback={<FakeChart />}>
 *     <Chart />
 *   </ClientOnly>
 * )
 * ```
 */
function ClientOnly({ children, fallback = null }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Fragment, {
    children: useHydrated() ? children : fallback,
  });
}
/** @internal */
function useHydrated(enabled = true) {
  return import_react.useSyncExternalStore(
    subscribe,
    getSnapshot,
    enabled ? getServerSnapshot : getSnapshot,
  );
}
function subscribe() {
  return () => {};
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/routerContext.js
var routerContext = import_react.createContext(null);
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useRouter.js
/**
 * Access the current TanStack Router instance from React context.
 * Must be used within a `RouterProvider`.
 *
 * Options:
 * - `warn`: Log a warning if no router context is found (default: true).
 *
 * @returns The registered router instance.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useRouterHook
 */
function useRouter(opts) {
  const value = import_react.useContext(routerContext);
  if (!value);
  return value;
}
//#endregion
export {
  replaceEqualDeep as A,
  hasOwn as C,
  last as D,
  isPromise as E,
  nullReplaceEqualDeep as O,
  hasKeys as S,
  isModuleNotFoundError as T,
  deepEqual as _,
  cleanPath as a,
  functionalUpdate as b,
  removeTrailingSlash as c,
  trimPathLeft as d,
  trimPathRight as f,
  decodePath as g,
  createNull as h,
  useHydrated as i,
  protocolRelativePrefixRegex as k,
  resolvePath as l,
  arraysEqual as m,
  routerContext as n,
  compileDecodeCharMap as o,
  DEFAULT_PROTOCOL_ALLOWLIST as p,
  ClientOnly as r,
  interpolatePath as s,
  useRouter as t,
  trimPath as u,
  encodePathLikeUrl as v,
  isDangerousProtocol as w,
  getUrlScheme as x,
  escapeHtml as y,
};
