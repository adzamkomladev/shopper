import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react } from "./react-dom-BCYT53bd.js";
import { t as useRouter } from "./useRouter-DvEAwN-p.js";
import { t as invariant } from "./invariant-tf8rw-KL.js";
import { n as matchContext, t as dummyMatchContext } from "./matchContext-Ds0KShpC.js";
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useMatch.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/**
 * Read and select the nearest or targeted route match.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useMatchHook
 */
function useMatch(opts) {
  const router = useRouter();
  const nearestRouteId = import_react.useContext(opts.from ? dummyMatchContext : matchContext);
  const routeId = opts.from ?? nearestRouteId;
  const matchStore = router.stores.getMatchStore(routeId);
  {
    const match = matchStore.get();
    if (!match) {
      if (opts.shouldThrow ?? true) invariant();
      return;
    }
    return opts.select ? opts.select(match) : match;
  }
}
//#endregion
export { useMatch as t };
