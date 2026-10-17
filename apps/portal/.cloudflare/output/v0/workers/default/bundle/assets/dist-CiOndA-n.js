import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react } from "./react-dom-BCYT53bd.js";
import { S as useLayoutEffect2 } from "./x-CZUobvN7.js";
//#region ../../node_modules/.pnpm/@radix-ui+react-use-size@1.1.5_@types+react@19.3.0_react@19.3.0/node_modules/@radix-ui/react-use-size/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", {
    value,
    configurable: true,
  });
function useSize(element) {
  const [size, setSize] = import_react.useState(void 0);
  useLayoutEffect2(() => {
    if (element) {
      setSize({
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
      let rAF = 0;
      const resizeObserver = new ResizeObserver((entries) => {
        if (!Array.isArray(entries)) return;
        if (!entries.length) return;
        const entry = entries[0];
        window.cancelAnimationFrame(rAF);
        rAF = window.requestAnimationFrame(() => {
          let width;
          let height;
          if ("borderBoxSize" in entry) {
            const borderSizeEntry = entry["borderBoxSize"];
            const borderSize = Array.isArray(borderSizeEntry)
              ? borderSizeEntry[0]
              : borderSizeEntry;
            width = borderSize["inlineSize"];
            height = borderSize["blockSize"];
          } else {
            width = element.offsetWidth;
            height = element.offsetHeight;
          }
          setSize({
            width,
            height,
          });
        });
      });
      resizeObserver.observe(element, { box: "border-box" });
      return () => {
        window.cancelAnimationFrame(rAF);
        resizeObserver.unobserve(element);
      };
    } else setSize(void 0);
  }, [element]);
  return size;
}
__name(useSize, "useSize");
//#endregion
export { useSize as t };
