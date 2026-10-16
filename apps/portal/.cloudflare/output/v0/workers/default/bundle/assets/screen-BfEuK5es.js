import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { t as buildInfo } from "./src-DwthVcY1.js";
import { n as Outlet } from "./Match-C7HVSA6L.js";
import { t as Link } from "./link-Dm8tj3is.js";
import {
  P as keepPreviousData,
  c as Button,
  f as useComposedRefs,
  h as useMutation,
  i as currentShop,
  m as cn,
  o as selectShop,
  q as useQueryClient,
  r as apiFetch,
  s as useShops,
  t as createLucideIcon,
  u as createSlot,
} from "./createLucideIcon-DmKyVZgg.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { t as AppBackdrop } from "./backdrop-CU13Mil9.js";
import {
  i as focusIfIdle,
  n as AlertDescription,
  o as Primitive,
  s as dispatchDiscreteCustomEvent,
  t as Alert,
} from "./alert-Cl5zWfQH.js";
import {
  C as composeEventHandlers,
  S as useLayoutEffect2,
  _ as DismissableLayer,
  b as Presence,
  d as useFocusGuards,
  f as Portal,
  g as useFocusScopeBranchRegistry,
  h as useFocusScopeBranch,
  l as hideOthers,
  m as FocusScopeBranchProvider,
  p as FocusScope,
  u as ReactRemoveScroll,
  v as useCallbackRef,
  w as createContextScope,
  x as useControllableState,
  y as useId,
} from "./x-CZUobvN7.js";
import {
  a as createPopperScope,
  i as PopperContent,
  n as Popper,
  o as useDirection,
  r as PopperAnchor,
  s as createCollection,
  t as Check,
} from "./check-B_zEzfYT.js";
import {
  a as CommandDialog,
  c as CommandInput,
  d as Search,
  f as Plus,
  i as Command,
  l as CommandItem,
  n as PopoverContent,
  o as CommandEmpty,
  r as PopoverTrigger,
  s as CommandGroup,
  t as Popover,
  u as CommandList,
} from "./popover-BEG8WX3O.js";
import { c as productPage } from "./schemas-B4d_8FW9.js";
import { i as toast, n as KbdGroup, r as Toaster$1, t as Kbd } from "./kbd-DLpSQiun.js";
import { t as CircleCheck } from "./circle-check-C_LeQUoQ.js";
import { t as GitBranch } from "./git-branch-AN0ykaqP.js";
import { t as LoaderCircle } from "./loader-circle-CGIjpJGj.js";
import { t as MonitorSmartphone } from "./monitor-smartphone-DoKGCSHP.js";
import { t as Package } from "./package-BBsfbWFw.js";
import { t as ScanBarcode } from "./scan-barcode-jWJo2gmb.js";
import { t as Store } from "./store-Dsr3zRui.js";
import { t as Upload } from "./upload-CJ_Elxe7.js";
import { n as usePermissions } from "./permissions--dOQAlW8.js";
import { a as sessionQuery, n as isTenantQuery, o as signOut } from "./session-DN4yT67X.js";
import { $ as Navigate, Q as WifiOff, et as useNavigate } from "./router-Dr1B-bFG.js";
import {
  i as useShortcuts,
  n as MOD_KEY,
  r as ShortcutRoot,
  t as useOnline,
} from "./online-Bubx-X8y.js";
import {
  i as InputGroupInput,
  n as InputGroup,
  r as InputGroupAddon,
  t as useDebouncedCallback,
} from "./callback-xJkOzKSk.js";
//#region ../../node_modules/.pnpm/@radix-ui+react-avatar@1.2.7_@types+react-dom@19.3.0_@types+react@19.3.0__@types+react@_2005d07d9099f578bc4374bc638a122b/node_modules/@radix-ui/react-avatar/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var __defProp$4 = Object.defineProperty;
var __name$4 = (target, value) =>
  __defProp$4(target, "name", {
    value,
    configurable: true,
  });
var AVATAR_NAME = "Avatar";
var [createAvatarContext, createAvatarScope] = createContextScope(AVATAR_NAME);
var ImageLoadingStatus = {
  Idle: "idle",
  Loading: "loading",
  Loaded: "loaded",
  Error: "error",
};
var STATIC_IMAGE_COUNT_STATE = [0, () => void 0];
var [AvatarProvider, useAvatarContext] = createAvatarContext(AVATAR_NAME);
var Avatar$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$4(function Avatar2(props, forwardedRef) {
    const { __scopeAvatar, ...avatarProps } = props;
    const [imageLoadingStatus, setImageLoadingStatus] = import_react.useState(
      ImageLoadingStatus.Idle,
    );
    const [imageCount, setImageCount] = useImageCount();
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AvatarProvider, {
      scope: __scopeAvatar,
      imageLoadingStatus,
      setImageLoadingStatus,
      imageCount,
      setImageCount,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.span, {
        ...avatarProps,
        ref: forwardedRef,
      }),
    });
  }, "Avatar"),
);
var FALLBACK_NAME = "AvatarFallback";
var AvatarFallback$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$4(function AvatarFallback2(props, forwardedRef) {
    const { __scopeAvatar, delayMs, ...fallbackProps } = props;
    const context = useAvatarContext(FALLBACK_NAME, __scopeAvatar);
    const [canRender, setCanRender] = import_react.useState(delayMs === void 0);
    import_react.useEffect(() => {
      if (delayMs !== void 0) {
        const timerId = window.setTimeout(() => setCanRender(true), delayMs);
        return () => window.clearTimeout(timerId);
      }
    }, [delayMs]);
    return canRender && context.imageLoadingStatus !== ImageLoadingStatus.Loaded
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.span, {
          ...fallbackProps,
          ref: forwardedRef,
        })
      : null;
  }, "AvatarFallback"),
);
function useImageLoadingStatus(
  src,
  { loadingStatus, setLoadingStatus, referrerPolicy, crossOrigin },
) {
  useLayoutEffect2(() => {
    if (!src) {
      setLoadingStatus(ImageLoadingStatus.Error);
      return;
    }
    const image = new window.Image();
    const handleLoad = /* @__PURE__ */ __name$4((event) => {
      const image2 = event.currentTarget;
      setLoadingStatus(getImageLoadingStatus(image2));
    }, "handleLoad");
    const handleError = /* @__PURE__ */ __name$4(
      () => setLoadingStatus(ImageLoadingStatus.Error),
      "handleError",
    );
    image.addEventListener("load", handleLoad);
    image.addEventListener("error", handleError);
    if (referrerPolicy) image.referrerPolicy = referrerPolicy;
    image.crossOrigin = crossOrigin ?? null;
    image.src = src;
    setLoadingStatus(getImageLoadingStatus(image));
    return () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      setLoadingStatus(ImageLoadingStatus.Idle);
    };
  }, [src, crossOrigin, referrerPolicy, setLoadingStatus]);
  return loadingStatus;
}
__name$4(useImageLoadingStatus, "useImageLoadingStatus");
function getImageLoadingStatus(image) {
  return image.complete
    ? image.naturalWidth > 0
      ? ImageLoadingStatus.Loaded
      : ImageLoadingStatus.Error
    : ImageLoadingStatus.Loading;
}
__name$4(getImageLoadingStatus, "getImageLoadingStatus");
function useImageCount() {
  return STATIC_IMAGE_COUNT_STATE;
}
__name$4(useImageCount, "useImageCount");
function useUpdateImageCount(setImageCount) {}
__name$4(useUpdateImageCount, "useUpdateImageCount");
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-use-is-hydrated@0.1.3_@types+react@19.3.0_react@19.3.0/node_modules/@radix-ui/react-use-is-hydrated/dist/index.mjs
var __defProp$3 = Object.defineProperty;
var __name$3 = (target, value) =>
  __defProp$3(target, "name", {
    value,
    configurable: true,
  });
var _isHydrated = false;
function useIsHydrated() {
  const [isHydrated, setIsHydrated] = import_react.useState(_isHydrated);
  import_react.useEffect(() => {
    if (!_isHydrated) {
      _isHydrated = true;
      setIsHydrated(true);
    }
  }, []);
  return isHydrated;
}
__name$3(useIsHydrated, "useIsHydrated");
var useReactSyncExternalStore = import_react[" useSyncExternalStore ".trim().toString()];
function subscribe() {
  return () => {};
}
__name$3(subscribe, "subscribe");
function useIsHydratedModern() {
  return useReactSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
__name$3(useIsHydratedModern, "useIsHydratedModern");
var useIsHydrated2 =
  typeof useReactSyncExternalStore === "function" ? useIsHydratedModern : useIsHydrated;
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-roving-focus@1.1.20_@types+react-dom@19.3.0_@types+react@19.3.0__@types_4a1e3c631f31675fbe9dd912b1e92891/node_modules/@radix-ui/react-roving-focus/dist/index.mjs
var __defProp$2 = Object.defineProperty;
var __name$2 = (target, value) =>
  __defProp$2(target, "name", {
    value,
    configurable: true,
  });
var ENTRY_FOCUS = "rovingFocusGroup.onEntryFocus";
var EVENT_OPTIONS = {
  bubbles: false,
  cancelable: true,
};
var GROUP_NAME = "RovingFocusGroup";
var [Collection$1, useCollection$1, createCollectionScope$1] = createCollection(GROUP_NAME);
var [createRovingFocusGroupContext, createRovingFocusGroupScope] = createContextScope(GROUP_NAME, [
  createCollectionScope$1,
]);
var Orientation = {
  Vertical: "vertical",
  Horizontal: "horizontal",
};
var Direction = {
  LTR: "ltr",
  RTL: "rtl",
};
var [RovingFocusProvider, useRovingFocusContext] = createRovingFocusGroupContext(GROUP_NAME);
var RovingFocusGroup = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$2(function RovingFocusGroup2(props, forwardedRef) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection$1.Provider, {
      scope: props.__scopeRovingFocusGroup,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection$1.Slot, {
        scope: props.__scopeRovingFocusGroup,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RovingFocusGroupImpl, {
          ...props,
          ref: forwardedRef,
        }),
      }),
    });
  }, "RovingFocusGroup"),
);
var RovingFocusGroupImpl = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$2(function RovingFocusGroupImpl2(props, forwardedRef) {
    const {
      __scopeRovingFocusGroup,
      orientation,
      loop = false,
      dir,
      currentTabStopId: currentTabStopIdProp,
      defaultCurrentTabStopId,
      onCurrentTabStopIdChange,
      onEntryFocus,
      preventScrollOnEntryFocus = false,
      ...groupProps
    } = props;
    const ref = import_react.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const direction = useDirection(dir);
    const [currentTabStopId, setCurrentTabStopId] = useControllableState({
      prop: currentTabStopIdProp,
      defaultProp: defaultCurrentTabStopId ?? null,
      onChange: onCurrentTabStopIdChange,
      caller: GROUP_NAME,
    });
    const [isTabbingBackOut, setIsTabbingBackOut] = import_react.useState(false);
    const handleEntryFocus = useCallbackRef(onEntryFocus);
    const getItems = useCollection$1(__scopeRovingFocusGroup);
    const isClickFocusRef = import_react.useRef(false);
    const [focusableItemsCount, setFocusableItemsCount] = import_react.useState(0);
    import_react.useEffect(() => {
      const node = ref.current;
      if (node) {
        node.addEventListener(ENTRY_FOCUS, handleEntryFocus);
        return () => node.removeEventListener(ENTRY_FOCUS, handleEntryFocus);
      }
    }, [handleEntryFocus]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RovingFocusProvider, {
      scope: __scopeRovingFocusGroup,
      orientation,
      dir: direction,
      loop,
      currentTabStopId,
      onItemFocus: import_react.useCallback(
        (tabStopId) => setCurrentTabStopId(tabStopId),
        [setCurrentTabStopId],
      ),
      onItemShiftTab: import_react.useCallback(() => setIsTabbingBackOut(true), []),
      onFocusableItemAdd: import_react.useCallback(
        () => setFocusableItemsCount((prevCount) => prevCount + 1),
        [],
      ),
      onFocusableItemRemove: import_react.useCallback(
        () => setFocusableItemsCount((prevCount) => prevCount - 1),
        [],
      ),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
        tabIndex: isTabbingBackOut || focusableItemsCount === 0 ? -1 : 0,
        "data-orientation": orientation,
        ...groupProps,
        ref: composedRefs,
        style: {
          outline: "none",
          ...props.style,
        },
        onMouseDown: composeEventHandlers(props.onMouseDown, () => {
          isClickFocusRef.current = true;
        }),
        onFocus: composeEventHandlers(props.onFocus, (event) => {
          const isKeyboardFocus = !isClickFocusRef.current;
          if (event.target === event.currentTarget && isKeyboardFocus && !isTabbingBackOut) {
            const entryFocusEvent = new CustomEvent(ENTRY_FOCUS, EVENT_OPTIONS);
            event.currentTarget.dispatchEvent(entryFocusEvent);
            if (!entryFocusEvent.defaultPrevented) {
              const items = getItems().filter((item) => item.focusable);
              focusFirst$1(
                [
                  items.find((item) => item.active),
                  items.find((item) => item.id === currentTabStopId),
                  ...items,
                ]
                  .filter(Boolean)
                  .map((item) => item.ref.current),
                preventScrollOnEntryFocus,
              );
            }
          }
          isClickFocusRef.current = false;
        }),
        onBlur: composeEventHandlers(props.onBlur, () => setIsTabbingBackOut(false)),
      }),
    });
  }, "RovingFocusGroupImpl"),
);
var ITEM_NAME$1 = "RovingFocusGroupItem";
var RovingFocusGroupItem = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$2(function RovingFocusGroupItem2(props, forwardedRef) {
    const {
      __scopeRovingFocusGroup,
      focusable = true,
      active = false,
      tabStopId,
      children,
      ...itemProps
    } = props;
    const autoId = useId();
    const id = tabStopId || autoId;
    const context = useRovingFocusContext(ITEM_NAME$1, __scopeRovingFocusGroup);
    const isCurrentTabStop = context.currentTabStopId === id;
    const getItems = useCollection$1(__scopeRovingFocusGroup);
    const { onFocusableItemAdd, onFocusableItemRemove, currentTabStopId } = context;
    const isHydrated = useIsHydrated2();
    useLayoutEffect2(() => {
      if (!isHydrated || !focusable) return;
      onFocusableItemAdd();
      return () => onFocusableItemRemove();
    }, [isHydrated, focusable, onFocusableItemAdd, onFocusableItemRemove]);
    import_react.useEffect(() => {
      if (isHydrated || !focusable) return;
      onFocusableItemAdd();
      return () => onFocusableItemRemove();
    }, [isHydrated, focusable, onFocusableItemAdd, onFocusableItemRemove]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection$1.ItemSlot, {
      scope: __scopeRovingFocusGroup,
      id,
      focusable,
      active,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.span, {
        tabIndex: isCurrentTabStop ? 0 : -1,
        "data-orientation": context.orientation,
        ...itemProps,
        ref: forwardedRef,
        onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
          if (!focusable) event.preventDefault();
          else context.onItemFocus(id);
        }),
        onFocus: composeEventHandlers(props.onFocus, () => context.onItemFocus(id)),
        onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
          if (event.key === "Tab" && event.shiftKey) {
            context.onItemShiftTab();
            return;
          }
          if (event.target !== event.currentTarget) return;
          const focusIntent = getFocusIntent(event, context.orientation, context.dir);
          if (focusIntent !== void 0) {
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
            event.preventDefault();
            let candidateNodes = getItems()
              .filter((item) => item.focusable)
              .map((item) => item.ref.current);
            if (focusIntent === "last") candidateNodes.reverse();
            else if (focusIntent === "prev" || focusIntent === "next") {
              if (focusIntent === "prev") candidateNodes.reverse();
              const currentIndex = candidateNodes.indexOf(event.currentTarget);
              candidateNodes = context.loop
                ? wrapArray$1(candidateNodes, currentIndex + 1)
                : candidateNodes.slice(currentIndex + 1);
            }
            setTimeout(() => focusFirst$1(candidateNodes));
          }
        }),
        children:
          typeof children === "function"
            ? children({
                isCurrentTabStop,
                hasTabStop: currentTabStopId != null,
              })
            : children,
      }),
    });
  }, "RovingFocusGroupItem"),
);
var MAP_KEY_TO_FOCUS_INTENT = {
  ArrowLeft: "prev",
  ArrowUp: "prev",
  ArrowRight: "next",
  ArrowDown: "next",
  PageUp: "first",
  Home: "first",
  PageDown: "last",
  End: "last",
};
function getDirectionAwareKey(key, dir) {
  if (dir !== Direction.RTL) return key;
  return key === "ArrowLeft" ? "ArrowRight" : key === "ArrowRight" ? "ArrowLeft" : key;
}
__name$2(getDirectionAwareKey, "getDirectionAwareKey");
function getFocusIntent(event, orientation, dir) {
  const key = getDirectionAwareKey(event.key, dir);
  if (orientation === Orientation.Vertical && ["ArrowLeft", "ArrowRight"].includes(key)) return;
  if (orientation === Orientation.Horizontal && ["ArrowUp", "ArrowDown"].includes(key)) return;
  return MAP_KEY_TO_FOCUS_INTENT[key];
}
__name$2(getFocusIntent, "getFocusIntent");
function focusFirst$1(candidates, preventScroll = false) {
  const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
  for (const candidate of candidates) {
    if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
    candidate.focus({ preventScroll });
    if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
  }
}
__name$2(focusFirst$1, "focusFirst");
function wrapArray$1(array, startIndex) {
  return array.map((_, index) => array[(startIndex + index) % array.length]);
}
__name$2(wrapArray$1, "wrapArray");
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-menu@2.1.25_@types+react-dom@19.3.0_@types+react@19.3.0__@types+react@1_3ae13a8b8abaffcff00d77dee41e2df0/node_modules/@radix-ui/react-menu/dist/index.mjs
var __defProp$1 = Object.defineProperty;
var __name$1 = (target, value) =>
  __defProp$1(target, "name", {
    value,
    configurable: true,
  });
var SELECTION_KEYS = ["Enter", " "];
var FIRST_KEYS = ["ArrowDown", "PageUp", "Home"];
var LAST_KEYS = ["ArrowUp", "PageDown", "End"];
var FIRST_LAST_KEYS = [...FIRST_KEYS, ...LAST_KEYS];
([...SELECTION_KEYS], [...SELECTION_KEYS]);
var MENU_NAME = "Menu";
var [Collection, useCollection, createCollectionScope] = createCollection(MENU_NAME);
var [createMenuContext, createMenuScope] = createContextScope(MENU_NAME, [
  createCollectionScope,
  createPopperScope,
  createRovingFocusGroupScope,
]);
var usePopperScope = createPopperScope();
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var [MenuProvider, useMenuContext] = createMenuContext(MENU_NAME);
var [MenuRootProvider, useMenuRootContext] = createMenuContext(MENU_NAME);
var Menu = /* @__PURE__ */ __name$1((props) => {
  const { __scopeMenu, open = false, children, dir, onOpenChange, modal = true } = props;
  const popperScope = usePopperScope(__scopeMenu);
  const [content, setContent] = import_react.useState(null);
  const isUsingKeyboardRef = import_react.useRef(false);
  const handleOpenChange = useCallbackRef(onOpenChange);
  const direction = useDirection(dir);
  import_react.useEffect(() => {
    const handleKeyDown = /* @__PURE__ */ __name$1(() => {
      isUsingKeyboardRef.current = true;
      document.addEventListener("pointerdown", handlePointer, {
        capture: true,
        once: true,
      });
      document.addEventListener("pointermove", handlePointer, {
        capture: true,
        once: true,
      });
    }, "handleKeyDown");
    const handlePointer = /* @__PURE__ */ __name$1(
      () => (isUsingKeyboardRef.current = false),
      "handlePointer",
    );
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("pointerdown", handlePointer, { capture: true });
      document.removeEventListener("pointermove", handlePointer, { capture: true });
    };
  }, []);
  import_react.useEffect(() => {
    if (!open) return;
    const handleBlur = /* @__PURE__ */ __name$1(() => handleOpenChange(false), "handleBlur");
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [open, handleOpenChange]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Popper, {
    ...popperScope,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuProvider, {
      scope: __scopeMenu,
      open,
      onOpenChange: handleOpenChange,
      content,
      onContentChange: setContent,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuRootProvider, {
        scope: __scopeMenu,
        onClose: import_react.useCallback(() => handleOpenChange(false), [handleOpenChange]),
        isUsingKeyboardRef,
        dir: direction,
        modal,
        children,
      }),
    }),
  });
}, "Menu");
var MenuAnchor = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuAnchor2(props, forwardedRef) {
    const { __scopeMenu, ...anchorProps } = props;
    const popperScope = usePopperScope(__scopeMenu);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopperAnchor, {
      ...popperScope,
      ...anchorProps,
      ref: forwardedRef,
    });
  }, "MenuAnchor"),
);
var PORTAL_NAME = "MenuPortal";
var [PortalProvider, usePortalContext] = createMenuContext(PORTAL_NAME, { forceMount: void 0 });
var MenuPortal = /* @__PURE__ */ __name$1((props) => {
  const { __scopeMenu, forceMount, children, container } = props;
  const context = useMenuContext(PORTAL_NAME, __scopeMenu);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortalProvider, {
    scope: __scopeMenu,
    forceMount,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
      present: forceMount || context.open,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, {
        asChild: true,
        container,
        children,
      }),
    }),
  });
}, "MenuPortal");
var CONTENT_NAME$1 = "MenuContent";
var [MenuContentProvider, useMenuContentContext] = createMenuContext(CONTENT_NAME$1);
var MenuContent = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuContent2(props, forwardedRef) {
    const portalContext = usePortalContext(CONTENT_NAME$1, props.__scopeMenu);
    const { forceMount = portalContext.forceMount, ...contentProps } = props;
    const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
    const rootContext = useMenuRootContext(CONTENT_NAME$1, props.__scopeMenu);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection.Provider, {
      scope: props.__scopeMenu,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
        present: forceMount || context.open,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection.Slot, {
          scope: props.__scopeMenu,
          children: rootContext.modal
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuRootContentModal, {
                ...contentProps,
                ref: forwardedRef,
              })
            : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuRootContentNonModal, {
                ...contentProps,
                ref: forwardedRef,
              }),
        }),
      }),
    });
  }, "MenuContent"),
);
var MenuRootContentModal = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuRootContentModal2(props, forwardedRef) {
    const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
    const ref = import_react.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    import_react.useEffect(() => {
      const content = ref.current;
      if (content) return hideOthers(content);
    }, []);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuContentImpl, {
      ...props,
      ref: composedRefs,
      trapFocus: context.open,
      disableOutsidePointerEvents: context.open,
      disableOutsideScroll: true,
      onFocusOutside: composeEventHandlers(
        props.onFocusOutside,
        (event) => event.preventDefault(),
        { checkForDefaultPrevented: false },
      ),
      onDismiss: () => context.onOpenChange(false),
    });
  }, "MenuRootContentModal"),
);
var MenuRootContentNonModal = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuRootContentNonModal2(props, forwardedRef) {
    const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuContentImpl, {
      ...props,
      ref: forwardedRef,
      trapFocus: false,
      disableOutsidePointerEvents: false,
      disableOutsideScroll: false,
      onDismiss: () => context.onOpenChange(false),
    });
  }, "MenuRootContentNonModal"),
);
var Slot = createSlot("MenuContent.ScrollLock");
var MenuContentImpl = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuContentImpl2(props, forwardedRef) {
    const {
      __scopeMenu,
      loop = false,
      trapFocus,
      onOpenAutoFocus,
      onCloseAutoFocus,
      disableOutsidePointerEvents,
      onEntryFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      onDismiss,
      disableOutsideScroll,
      ...contentProps
    } = props;
    const context = useMenuContext(CONTENT_NAME$1, __scopeMenu);
    const rootContext = useMenuRootContext(CONTENT_NAME$1, __scopeMenu);
    const popperScope = usePopperScope(__scopeMenu);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeMenu);
    const getItems = useCollection(__scopeMenu);
    const [currentItemId, setCurrentItemId] = import_react.useState(null);
    const contentRef = import_react.useRef(null);
    const [branchNode, setBranchNode] = import_react.useState(null);
    useFocusScopeBranch(branchNode);
    const { nodes: branchNodes, registry: branchRegistry } = useFocusScopeBranchRegistry();
    const isModal = Boolean(trapFocus || disableOutsideScroll);
    const composedRefs = useComposedRefs(
      forwardedRef,
      contentRef,
      context.onContentChange,
      setBranchNode,
    );
    const timerRef = import_react.useRef(0);
    const searchRef = import_react.useRef("");
    const pointerGraceTimerRef = import_react.useRef(0);
    const pointerGraceIntentRef = import_react.useRef(null);
    const pointerDirRef = import_react.useRef("right");
    const lastPointerXRef = import_react.useRef(0);
    const shards = import_react.useMemo(
      () =>
        disableOutsideScroll ? [contentRef, ...branchNodes.map((node) => ({ current: node }))] : [],
      [contentRef, branchNodes, disableOutsideScroll],
    );
    const ScrollLockWrapper = disableOutsideScroll ? ReactRemoveScroll : import_react.Fragment;
    const scrollLockWrapperProps = disableOutsideScroll
      ? {
          as: Slot,
          allowPinchZoom: true,
          shards,
        }
      : void 0;
    const handleTypeaheadSearch = /* @__PURE__ */ __name$1((key) => {
      const search = searchRef.current + key;
      const items = getItems().filter((item) => !item.disabled);
      const currentItem = document.activeElement;
      const currentMatch = items.find((item) => item.ref.current === currentItem)?.textValue;
      const nextMatch = getNextMatch(
        items.map((item) => item.textValue),
        search,
        currentMatch,
      );
      const newItem = items.find((item) => item.textValue === nextMatch)?.ref.current;
      /* @__PURE__ */ __name$1(function updateSearch(value) {
        searchRef.current = value;
        window.clearTimeout(timerRef.current);
        if (value !== "") timerRef.current = window.setTimeout(() => updateSearch(""), 1e3);
      }, "updateSearch")(search);
      if (newItem) setTimeout(() => newItem.focus());
    }, "handleTypeaheadSearch");
    import_react.useEffect(() => {
      return () => window.clearTimeout(timerRef.current);
    }, []);
    useFocusGuards();
    const isPointerMovingToSubmenu = import_react.useCallback((event) => {
      return (
        pointerDirRef.current === pointerGraceIntentRef.current?.side &&
        isPointerInGraceArea(event, pointerGraceIntentRef.current?.area)
      );
    }, []);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuContentProvider, {
      scope: __scopeMenu,
      searchRef,
      onItemEnter: import_react.useCallback(
        (event) => {
          if (isPointerMovingToSubmenu(event)) event.preventDefault();
        },
        [isPointerMovingToSubmenu],
      ),
      onItemLeave: import_react.useCallback(
        (event) => {
          if (isPointerMovingToSubmenu(event)) return;
          contentRef.current?.focus();
          setCurrentItemId(null);
        },
        [isPointerMovingToSubmenu],
      ),
      onTriggerLeave: import_react.useCallback(
        (event) => {
          if (isPointerMovingToSubmenu(event)) event.preventDefault();
        },
        [isPointerMovingToSubmenu],
      ),
      pointerGraceTimerRef,
      onPointerGraceIntentChange: import_react.useCallback((intent) => {
        pointerGraceIntentRef.current = intent;
      }, []),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FocusScopeBranchProvider, {
        registry: isModal ? branchRegistry : null,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollLockWrapper, {
          ...scrollLockWrapperProps,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FocusScope, {
            asChild: true,
            trapped: trapFocus,
            branches: branchNodes,
            onMountAutoFocus: composeEventHandlers(onOpenAutoFocus, (event) => {
              event.preventDefault();
              contentRef.current?.focus({ preventScroll: true });
            }),
            onUnmountAutoFocus: onCloseAutoFocus,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DismissableLayer, {
              asChild: true,
              disableOutsidePointerEvents,
              onEscapeKeyDown,
              onPointerDownOutside,
              onFocusOutside,
              onInteractOutside,
              onDismiss,
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RovingFocusGroup, {
                asChild: true,
                ...rovingFocusGroupScope,
                dir: rootContext.dir,
                orientation: "vertical",
                loop,
                currentTabStopId: currentItemId,
                onCurrentTabStopIdChange: setCurrentItemId,
                onEntryFocus: composeEventHandlers(onEntryFocus, (event) => {
                  if (!rootContext.isUsingKeyboardRef.current) event.preventDefault();
                }),
                preventScrollOnEntryFocus: true,
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopperContent, {
                  role: "menu",
                  "aria-orientation": "vertical",
                  "data-state": getOpenState(context.open),
                  "data-radix-menu-content": "",
                  dir: rootContext.dir,
                  ...popperScope,
                  ...contentProps,
                  ref: composedRefs,
                  style: {
                    outline: "none",
                    ...contentProps.style,
                  },
                  onKeyDown: composeEventHandlers(contentProps.onKeyDown, (event) => {
                    const isKeyDownInside =
                      event.target.closest("[data-radix-menu-content]") === event.currentTarget;
                    const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
                    const isCharacterKey = event.key.length === 1;
                    if (isKeyDownInside) {
                      if (event.key === "Tab") event.preventDefault();
                      if (!isModifierKey && isCharacterKey) handleTypeaheadSearch(event.key);
                    }
                    const content = contentRef.current;
                    if (event.target !== content) return;
                    if (!FIRST_LAST_KEYS.includes(event.key)) return;
                    event.preventDefault();
                    const candidateNodes = getItems()
                      .filter((item) => !item.disabled)
                      .map((item) => item.ref.current);
                    if (LAST_KEYS.includes(event.key)) candidateNodes.reverse();
                    focusFirst(candidateNodes);
                  }),
                  onBlur: composeEventHandlers(props.onBlur, (event) => {
                    if (!event.currentTarget.contains(event.target)) {
                      window.clearTimeout(timerRef.current);
                      searchRef.current = "";
                    }
                  }),
                  onPointerMove: composeEventHandlers(
                    props.onPointerMove,
                    whenMouse((event) => {
                      const target = event.target;
                      const pointerXHasChanged = lastPointerXRef.current !== event.clientX;
                      if (event.currentTarget.contains(target) && pointerXHasChanged) {
                        const newDir = event.clientX > lastPointerXRef.current ? "right" : "left";
                        pointerDirRef.current = newDir;
                        lastPointerXRef.current = event.clientX;
                      }
                    }),
                  ),
                }),
              }),
            }),
          }),
        }),
      }),
    });
  }, "MenuContentImpl"),
);
var MenuLabel = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuLabel2(props, forwardedRef) {
    const { __scopeMenu, ...labelProps } = props;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
      ...labelProps,
      ref: forwardedRef,
    });
  }, "MenuLabel"),
);
var ITEM_NAME = "MenuItem";
var ITEM_SELECT = "menu.itemSelect";
var MenuItem = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuItem2(props, forwardedRef) {
    const { disabled = false, onSelect, ...itemProps } = props;
    const ref = import_react.useRef(null);
    const rootContext = useMenuRootContext(ITEM_NAME, props.__scopeMenu);
    const contentContext = useMenuContentContext(ITEM_NAME, props.__scopeMenu);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const isPointerDownRef = import_react.useRef(false);
    const handleSelect = /* @__PURE__ */ __name$1(() => {
      const menuItem = ref.current;
      if (!disabled && menuItem) {
        const itemSelectEvent = new CustomEvent(ITEM_SELECT, {
          bubbles: true,
          cancelable: true,
        });
        menuItem.addEventListener(ITEM_SELECT, (event) => onSelect?.(event), { once: true });
        dispatchDiscreteCustomEvent(menuItem, itemSelectEvent);
        if (itemSelectEvent.defaultPrevented) isPointerDownRef.current = false;
        else rootContext.onClose();
      }
    }, "handleSelect");
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuItemImpl, {
      ...itemProps,
      ref: composedRefs,
      disabled,
      onClick: composeEventHandlers(props.onClick, handleSelect),
      onPointerDown: (event) => {
        props.onPointerDown?.(event);
        isPointerDownRef.current = true;
      },
      onPointerUp: composeEventHandlers(props.onPointerUp, (event) => {
        if (!isPointerDownRef.current) event.currentTarget?.click();
      }),
      onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
        if (disabled || event.target !== event.currentTarget) return;
        if (contentContext.searchRef.current !== "" && event.key === " ") return;
        if (SELECTION_KEYS.includes(event.key)) {
          event.currentTarget.click();
          event.preventDefault();
        }
      }),
    });
  }, "MenuItem"),
);
var MenuItemImpl = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuItemImpl2(props, forwardedRef) {
    const { __scopeMenu, disabled = false, textValue, ...itemProps } = props;
    const contentContext = useMenuContentContext(ITEM_NAME, __scopeMenu);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeMenu);
    const ref = import_react.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const [isFocused, setIsFocused] = import_react.useState(false);
    const [textContent, setTextContent] = import_react.useState("");
    import_react.useEffect(() => {
      const menuItem = ref.current;
      if (menuItem) setTextContent((menuItem.textContent ?? "").trim());
    }, [itemProps.children]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection.ItemSlot, {
      scope: __scopeMenu,
      disabled,
      textValue: textValue ?? textContent,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RovingFocusGroupItem, {
        asChild: true,
        ...rovingFocusGroupScope,
        focusable: !disabled,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
          role: "menuitem",
          "data-highlighted": isFocused ? "" : void 0,
          "aria-disabled": disabled || void 0,
          "data-disabled": disabled ? "" : void 0,
          ...itemProps,
          ref: composedRefs,
          onPointerMove: composeEventHandlers(
            props.onPointerMove,
            whenMouse((event) => {
              if (disabled) contentContext.onItemLeave(event);
              else {
                contentContext.onItemEnter(event);
                if (!event.defaultPrevented) event.currentTarget.focus({ preventScroll: true });
              }
            }),
          ),
          onPointerLeave: composeEventHandlers(
            props.onPointerLeave,
            whenMouse((event) => contentContext.onItemLeave(event)),
          ),
          onFocus: composeEventHandlers(props.onFocus, () => setIsFocused(true)),
          onBlur: composeEventHandlers(props.onBlur, () => setIsFocused(false)),
        }),
      }),
    });
  }, "MenuItemImpl"),
);
var [RadioGroupProvider, useRadioGroupContext] = createMenuContext("MenuRadioGroup", {
  value: void 0,
  onValueChange: /* @__PURE__ */ __name$1(() => {}, "onValueChange"),
});
var [ItemIndicatorProvider, useItemIndicatorContext] = createMenuContext("MenuItemIndicator", {
  checked: false,
});
var MenuSeparator = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function MenuSeparator2(props, forwardedRef) {
    const { __scopeMenu, ...separatorProps } = props;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
      role: "separator",
      "aria-orientation": "horizontal",
      ...separatorProps,
      ref: forwardedRef,
    });
  }, "MenuSeparator"),
);
var [MenuSubProvider, useMenuSubContext] = createMenuContext("MenuSub");
function getOpenState(open) {
  return open ? "open" : "closed";
}
__name$1(getOpenState, "getOpenState");
function isIndeterminate(checked) {
  return checked === "indeterminate";
}
__name$1(isIndeterminate, "isIndeterminate");
function getCheckedState(checked) {
  return isIndeterminate(checked) ? "indeterminate" : checked ? "checked" : "unchecked";
}
__name$1(getCheckedState, "getCheckedState");
function focusFirst(candidates) {
  const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
  for (const candidate of candidates) {
    if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
    candidate.focus();
    if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
  }
}
__name$1(focusFirst, "focusFirst");
function wrapArray(array, startIndex) {
  return array.map((_, index) => array[(startIndex + index) % array.length]);
}
__name$1(wrapArray, "wrapArray");
function getNextMatch(values, search, currentMatch) {
  const normalizedSearch =
    search.length > 1 && Array.from(search).every((char) => char === search[0])
      ? search[0]
      : search;
  const currentMatchIndex = currentMatch ? values.indexOf(currentMatch) : -1;
  let wrappedValues = wrapArray(values, Math.max(currentMatchIndex, 0));
  if (normalizedSearch.length === 1)
    wrappedValues = wrappedValues.filter((v) => v !== currentMatch);
  const nextMatch = wrappedValues.find((value) =>
    value.toLowerCase().startsWith(normalizedSearch.toLowerCase()),
  );
  return nextMatch !== currentMatch ? nextMatch : void 0;
}
__name$1(getNextMatch, "getNextMatch");
function isPointInPolygon(point, polygon) {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ii = polygon[i];
    const jj = polygon[j];
    const xi = ii.x;
    const yi = ii.y;
    const xj = jj.x;
    const yj = jj.y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
__name$1(isPointInPolygon, "isPointInPolygon");
function isPointerInGraceArea(event, area) {
  if (!area) return false;
  return isPointInPolygon(
    {
      x: event.clientX,
      y: event.clientY,
    },
    area,
  );
}
__name$1(isPointerInGraceArea, "isPointerInGraceArea");
function whenMouse(handler) {
  return (event) => (event.pointerType === "mouse" ? handler(event) : void 0);
}
__name$1(whenMouse, "whenMouse");
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-dropdown-menu@2.1.25_@types+react-dom@19.3.0_@types+react@19.3.0__@type_629a5a4a562bce11ef9cf18d771c29ae/node_modules/@radix-ui/react-dropdown-menu/dist/index.mjs
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", {
    value,
    configurable: true,
  });
var DROPDOWN_MENU_NAME = "DropdownMenu";
var [createDropdownMenuContext, createDropdownMenuScope] = createContextScope(DROPDOWN_MENU_NAME, [
  createMenuScope,
]);
var useMenuScope = createMenuScope();
var [DropdownMenuProvider, useDropdownMenuContext] = createDropdownMenuContext(DROPDOWN_MENU_NAME);
var DropdownMenu$1 = /* @__PURE__ */ __name((props) => {
  const {
    __scopeDropdownMenu,
    children,
    dir,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = true,
  } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  const triggerRef = import_react.useRef(null);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: DROPDOWN_MENU_NAME,
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuProvider, {
    scope: __scopeDropdownMenu,
    triggerId: useId(),
    triggerRef,
    contentId: useId(),
    open,
    onOpenChange: setOpen,
    onOpenToggle: import_react.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
    modal,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
      ...menuScope,
      open,
      onOpenChange: setOpen,
      dir,
      modal,
      children,
    }),
  });
}, "DropdownMenu");
var TRIGGER_NAME = "DropdownMenuTrigger";
var DropdownMenuTrigger$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function DropdownMenuTrigger2(props, forwardedRef) {
    const { __scopeDropdownMenu, disabled = false, ...triggerProps } = props;
    const context = useDropdownMenuContext(TRIGGER_NAME, __scopeDropdownMenu);
    const menuScope = useMenuScope(__scopeDropdownMenu);
    const composedRefs = useComposedRefs(forwardedRef, context.triggerRef);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuAnchor, {
      asChild: true,
      ...menuScope,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.button, {
        type: "button",
        id: context.triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": context.open,
        "aria-controls": context.open ? context.contentId : void 0,
        "data-state": context.open ? "open" : "closed",
        "data-disabled": disabled ? "" : void 0,
        disabled,
        ...triggerProps,
        ref: composedRefs,
        onPointerDown: composeEventHandlers(props.onPointerDown, (event) => {
          if (!disabled && event.button === 0 && event.ctrlKey === false) {
            context.onOpenToggle();
            if (!context.open) event.preventDefault();
          }
        }),
        onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
          if (disabled) return;
          if (["Enter", " "].includes(event.key)) context.onOpenToggle();
          if (event.key === "ArrowDown") context.onOpenChange(true);
          if (["Enter", " ", "ArrowDown"].includes(event.key)) event.preventDefault();
        }),
      }),
    });
  }, "DropdownMenuTrigger"),
);
var DropdownMenuPortal = /* @__PURE__ */ __name((props) => {
  const { __scopeDropdownMenu, ...portalProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuPortal, {
    ...menuScope,
    ...portalProps,
  });
}, "DropdownMenuPortal");
var CONTENT_NAME = "DropdownMenuContent";
var DropdownMenuContent$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function DropdownMenuContent2(props, forwardedRef) {
    const { __scopeDropdownMenu, ...contentProps } = props;
    const context = useDropdownMenuContext(CONTENT_NAME, __scopeDropdownMenu);
    const menuScope = useMenuScope(__scopeDropdownMenu);
    const hasInteractedOutsideRef = import_react.useRef(false);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuContent, {
      id: context.contentId,
      "aria-labelledby": context.triggerId,
      ...menuScope,
      ...contentProps,
      ref: forwardedRef,
      onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
        if (!hasInteractedOutsideRef.current) context.triggerRef.current?.focus();
        hasInteractedOutsideRef.current = false;
        event.preventDefault();
      }),
      onInteractOutside: composeEventHandlers(props.onInteractOutside, (event) => {
        const originalEvent = event.detail.originalEvent;
        const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
        const isRightClick = originalEvent.button === 2 || ctrlLeftClick;
        if (!context.modal || isRightClick) hasInteractedOutsideRef.current = true;
      }),
      style: {
        ...props.style,
        "--radix-dropdown-menu-content-transform-origin": "var(--radix-popper-transform-origin)",
        "--radix-dropdown-menu-content-available-width": "var(--radix-popper-available-width)",
        "--radix-dropdown-menu-content-available-height": "var(--radix-popper-available-height)",
        "--radix-dropdown-menu-trigger-width": "var(--radix-popper-anchor-width)",
        "--radix-dropdown-menu-trigger-height": "var(--radix-popper-anchor-height)",
      },
    });
  }, "DropdownMenuContent"),
);
var DropdownMenuLabel$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function DropdownMenuLabel2(props, forwardedRef) {
    const { __scopeDropdownMenu, ...labelProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuLabel, {
      ...menuScope,
      ...labelProps,
      ref: forwardedRef,
    });
  }, "DropdownMenuLabel"),
);
var DropdownMenuItem$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function DropdownMenuItem2(props, forwardedRef) {
    const { __scopeDropdownMenu, ...itemProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuItem, {
      ...menuScope,
      ...itemProps,
      ref: forwardedRef,
    });
  }, "DropdownMenuItem"),
);
var DropdownMenuSeparator$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function DropdownMenuSeparator2(props, forwardedRef) {
    const { __scopeDropdownMenu, ...separatorProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuSeparator, {
      ...menuScope,
      ...separatorProps,
      ref: forwardedRef,
    });
  }, "DropdownMenuSeparator"),
);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/chevrons-up-down.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$6 = {
  name: "chevrons-up-down",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m7 15 5 5 5-5",
        key: "1hf1tw",
      },
    ],
    [
      "path",
      {
        d: "m7 9 5-5 5 5",
        key: "sgt6xg",
      },
    ],
  ],
};
__iconData$6.node;
var ChevronsUpDown = createLucideIcon(__iconData$6);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/info.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$5 = {
  name: "info",
  size: 24,
  node: [
    [
      "circle",
      {
        cx: "12",
        cy: "12",
        r: "10",
        key: "1mglay",
      },
    ],
    [
      "path",
      {
        d: "M12 16v-4",
        key: "1dtifu",
      },
    ],
    [
      "path",
      {
        d: "M12 8h.01",
        key: "e9boi3",
      },
    ],
  ],
};
__iconData$5.node;
var Info = createLucideIcon(__iconData$5);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/log-out.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$4 = {
  name: "log-out",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m16 17 5-5-5-5",
        key: "1bji2h",
      },
    ],
    [
      "path",
      {
        d: "M21 12H9",
        key: "dn1m92",
      },
    ],
    [
      "path",
      {
        d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
        key: "1uf3rs",
      },
    ],
  ],
};
__iconData$4.node;
var LogOut = createLucideIcon(__iconData$4);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/octagon-x.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$3 = {
  name: "octagon-x",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m15 9-6 6",
        key: "1uzhvr",
      },
    ],
    [
      "path",
      {
        d: "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z",
        key: "2d38gg",
      },
    ],
    [
      "path",
      {
        d: "m9 9 6 6",
        key: "z0biqf",
      },
    ],
  ],
  aliases: ["x-octagon"],
};
__iconData$3.node;
var OctagonX = createLucideIcon(__iconData$3);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/shield-check.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$2 = {
  name: "shield-check",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y",
      },
    ],
    [
      "path",
      {
        d: "m9 12 2 2 4-4",
        key: "dzmm74",
      },
    ],
  ],
};
__iconData$2.node;
var ShieldCheck = createLucideIcon(__iconData$2);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$1 = {
  name: "triangle-alert",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        key: "wmoenq",
      },
    ],
    [
      "path",
      {
        d: "M12 9v4",
        key: "juzpu7",
      },
    ],
    [
      "path",
      {
        d: "M12 17h.01",
        key: "p32p05",
      },
    ],
  ],
  aliases: ["alert-triangle"],
};
__iconData$1.node;
var TriangleAlert = createLucideIcon(__iconData$1);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/users.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData = {
  name: "users",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
        key: "1yyitq",
      },
    ],
    [
      "path",
      {
        d: "M16 3.128a4 4 0 0 1 0 7.744",
        key: "16gr8j",
      },
    ],
    [
      "path",
      {
        d: "M22 21v-2a4 4 0 0 0-3-3.87",
        key: "kshegd",
      },
    ],
    [
      "circle",
      {
        cx: "9",
        cy: "7",
        r: "4",
        key: "nufk8",
      },
    ],
  ],
};
__iconData.node;
var Users = createLucideIcon(__iconData);
//#endregion
//#region ../../packages/ui/src/components/sonner.tsx
var Toaster = ({ ...props }) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
    theme: "system",
    className: "toaster group",
    icons: {
      success: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4" }),
      info: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4" }),
      warning: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4" }),
      error: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OctagonX, { className: "size-4" }),
      loading: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
        className: "size-4 animate-spin",
      }),
    },
    style: {
      "--normal-bg": "var(--popover)",
      "--normal-text": "var(--popover-foreground)",
      "--normal-border": "var(--border)",
      "--border-radius": "var(--radius)",
    },
    ...props,
  });
//#endregion
//#region ../../packages/backoffice/src/components/shell/offline/banner.tsx
function OfflineBanner() {
  if (useOnline()) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
    role: "status",
    className: "fixed inset-x-5 bottom-5 z-40 mx-auto max-w-2xl shadow-md",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, { "aria-hidden": true }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
        children:
          "You're offline. You can still look around, but changes can't be saved until you're back online.",
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/queries/shell.ts
/** Switches shop. A shop without a session for this device goes to login with its code filled in. */
function usePickShop() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (shop) => {
      selectShop(shop.id);
      queryClient.removeQueries({ predicate: isTenantQuery });
      return queryClient.fetchQuery(sessionQuery());
    },
    onSuccess: (session, shop) =>
      navigate(
        session
          ? { to: "/products" }
          : {
              to: "/login",
              search: { shop: shop.slug },
            },
      ),
    onError: (error) => toast.error(error.message),
  });
}
function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await navigate({
        to: "/login",
        search: { shop: currentShop()?.slug || void 0 },
      });
      queryClient.removeQueries({ predicate: isTenantQuery });
    },
    onError: (error) => toast.error(error.message),
  });
}
var PALETTE_RESULTS = 8;
/** Products matching what the palette's search box says (name, SKU or barcode). */
function usePaletteProducts(term, online) {
  const shop = currentShop();
  const search = term.trim();
  return useQuery({
    queryKey: ["products", "palette", shop?.id ?? "box", search],
    queryFn: () =>
      apiFetch(
        `/products?${new URLSearchParams({
          q: search,
          limit: String(PALETTE_RESULTS),
        })}`,
        productPage,
        { shopId: shop?.id ?? null },
      ),
    enabled: online && search.length > 0,
    placeholderData: keepPreviousData,
  });
}
//#endregion
//#region ../../packages/backoffice/src/lib/shell/nav/items.ts
var NAV_ITEMS = [
  {
    to: "/products",
    label: "Products",
    icon: Package,
  },
  {
    to: "/barcodes",
    label: "Barcodes",
    icon: ScanBarcode,
    permission: "product.read",
  },
  {
    to: "/imports",
    label: "Import",
    icon: Upload,
  },
  {
    to: "/stores",
    label: "Stores",
    icon: Store,
    permission: "store.read",
  },
  {
    to: "/branches",
    label: "Branches",
    icon: GitBranch,
    permission: "branch.read",
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    permission: "user.read",
  },
  {
    to: "/roles",
    label: "Roles",
    icon: ShieldCheck,
    permission: "role.read",
  },
  {
    to: "/devices",
    label: "Devices",
    icon: MonitorSmartphone,
    permission: "device.read",
  },
];
//#endregion
//#region ../../packages/backoffice/src/hooks/shell/nav/items.ts
/** The links this member may use. Gated links wait for the permission list rather than flash and vanish. */
function useNavItems() {
  const granted = usePermissions();
  return NAV_ITEMS.filter(({ permission }) => !permission || granted?.includes(permission));
}
//#endregion
//#region ../../packages/backoffice/src/components/shell/command/palette.tsx
var SEARCH_DEBOUNCE_MS = 200;
/** `query` is what is typed; `term` trails it by a moment and is what the server is asked. */
var closedPalette = {
  open: false,
  query: "",
  term: "",
};
function CommandPalette({ state, onChange, onClosed }) {
  const navigate = useNavigate();
  const navItems = useNavItems();
  const online = useOnline();
  const { data, isFetching, isError } = usePaletteProducts(state.term, online);
  const setTerm = useDebouncedCallback(
    (term) =>
      onChange((current) => ({
        ...current,
        term,
      })),
    SEARCH_DEBOUNCE_MS,
  );
  const close = () => {
    setTerm.cancel();
    onChange(closedPalette);
  };
  const searching = state.term.trim() !== "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandDialog, {
    open: state.open,
    onOpenChange: (open) =>
      open
        ? onChange((current) => ({
            ...current,
            open,
          }))
        : close(),
    onCloseAutoFocus: (event) => {
      event.preventDefault();
      onClosed();
    },
    title: "Search",
    description: "Search products or jump to a page",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandInput, {
        placeholder: "Search products or jump to…",
        value: state.query,
        onValueChange: (query) => {
          onChange((current) => ({
            ...current,
            query,
          }));
          setTerm(query);
        },
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandList, {
        children: [
          !online &&
            searching &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaletteNote, {
              children: "Can't search products offline.",
            }),
          online &&
            isError &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaletteNote, {
              children: "Couldn't search products. Try again.",
            }),
          !isFetching &&
            !isError &&
            !data?.items.length &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandEmpty, {
              children: "Nothing matches that.",
            }),
          searching &&
            data &&
            data.items.length > 0 &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandGroup, {
              heading: "Products",
              children: data.items.map((product) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  CommandItem,
                  {
                    value: `${state.query} ${product.name} ${product.sku}`,
                    onSelect: () => {
                      close();
                      navigate({
                        to: "/products/$productId",
                        params: { productId: product.id },
                      });
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                        className: "flex-1 truncate",
                        children: product.name,
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                        className: "text-xs text-muted-foreground",
                        children: product.sku,
                      }),
                    ],
                  },
                  product.id,
                ),
              ),
            }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandGroup, {
            heading: "Go to",
            children: navItems.map(({ to, label, icon: Icon }) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                CommandItem,
                {
                  onSelect: () => {
                    close();
                    navigate({ to });
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { "aria-hidden": true }),
                    label,
                  ],
                },
                to,
              ),
            ),
          }),
        ],
      }),
    ],
  });
}
function PaletteNote({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
    role: "status",
    className: "py-6 text-center text-sm text-muted-foreground",
    children,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/shell/shop/switcher.tsx
function ShopSwitcher({ shops, currentId }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const pick = usePickShop();
  const navigate = useNavigate();
  const current = shops.find((shop) => shop.id === currentId);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
    open,
    onOpenChange: setOpen,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
        asChild: true,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
          variant: "outline",
          role: "combobox",
          "aria-label": `Shop: ${current?.name ?? "none selected"}`,
          "aria-expanded": open,
          className: "w-full justify-start font-medium sm:w-50",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Store, { "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
              className: "flex-1 truncate text-left",
              children: current?.name ?? "Select a shop",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, {
              "aria-hidden": true,
              className: "opacity-50",
            }),
          ],
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
        "aria-label": "Shops",
        align: "start",
        className: "w-(--radix-popover-trigger-width) min-w-56 p-0",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Command, {
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandInput, {
                placeholder: "Find a shop",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandList, {
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandEmpty, {
                    children: "No shop found.",
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandGroup, {
                    heading: "Shops on this device",
                    children: shops.map((shop) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        CommandItem,
                        {
                          value: `${shop.name} ${shop.slug}`,
                          onSelect: () => {
                            setOpen(false);
                            if (shop.id !== currentId) pick.mutate(shop);
                          },
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                              className: "flex-1 truncate",
                              children: shop.name,
                            }),
                            shop.id === currentId &&
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
                                "aria-hidden": true,
                              }),
                          ],
                        },
                        shop.id,
                      ),
                    ),
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "border-t p-1",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              variant: "ghost",
              className: "w-full justify-start font-normal",
              onClick: () => {
                setOpen(false);
                navigate({ to: "/login" });
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { "aria-hidden": true }),
                "Add another shop",
              ],
            }),
          }),
        ],
      }),
    ],
  });
}
//#endregion
//#region ../../packages/ui/src/components/avatar.tsx
function Avatar({ className, size = "default", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar$1, {
    "data-slot": "avatar",
    "data-size": size,
    className: cn(
      "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
      className,
    ),
    ...props,
  });
}
function AvatarFallback({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AvatarFallback$1, {
    "data-slot": "avatar-fallback",
    className: cn(
      "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
      className,
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/ui/src/components/dropdown/menu.tsx
function DropdownMenu({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenu$1, {
    "data-slot": "dropdown-menu",
    ...props,
  });
}
function DropdownMenuTrigger({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger$1, {
    "data-slot": "dropdown-menu-trigger",
    ...props,
  });
}
function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuPortal, {
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuContent$1, {
      "data-slot": "dropdown-menu-content",
      sideOffset,
      className: cn(
        "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      ),
      ...props,
    }),
  });
}
function DropdownMenuItem({ className, inset, variant = "default", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem$1, {
    "data-slot": "dropdown-menu-item",
    "data-inset": inset,
    "data-variant": variant,
    className: cn(
      "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
      className,
    ),
    ...props,
  });
}
function DropdownMenuLabel({ className, inset, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel$1, {
    "data-slot": "dropdown-menu-label",
    "data-inset": inset,
    className: cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className),
    ...props,
  });
}
function DropdownMenuSeparator({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator$1, {
    "data-slot": "dropdown-menu-separator",
    className: cn("-mx-1 my-1 h-px bg-border", className),
    ...props,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/shell/user/menu.tsx
function UserMenu({ user }) {
  const signOut = useSignOut();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, {
    modal: false,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
        asChild: true,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
          variant: "ghost",
          size: "icon",
          className: "rounded-full",
          "aria-label": user.name,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AvatarFallback, {
              className: "text-foreground",
              children: initials(user.name),
            }),
          }),
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
        align: "end",
        className: "w-64",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuLabel, {
            className: "flex flex-col gap-0.5 font-normal",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                className: "truncate font-medium",
                children: user.name,
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                className: "truncate text-muted-foreground",
                children: user.email,
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
            onSelect: () => signOut.mutate(),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { "aria-hidden": true }),
              "Sign out",
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuLabel, {
            className: "text-xs font-normal text-muted-foreground",
            children: ["Shopper ", buildInfo.version],
          }),
        ],
      }),
    ],
  });
}
function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
//#endregion
//#region ../../packages/backoffice/src/hooks/shell/shortcuts.ts
/** Mod+K opens the palette; "/" focuses the search field. Attach the returned ref to the nav. */
function useShellShortcuts(actions) {
  return useShortcuts({
    "Mod+K": actions.openPalette,
    "/": actions.focusSearch,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/shell/top/nav.tsx
/** Figma 48:1473: shop switcher, links, search and the user menu in one bar, plus the palette it opens. */
function TopNav({ shops, currentId, user }) {
  const [palette, setPalette] = (0, import_react.useState)(closedPalette);
  const navItems = useNavItems();
  const searchRef = (0, import_react.useRef)(null);
  const searchButtonRef = (0, import_react.useRef)(null);
  const open = (query = "") =>
    setPalette({
      open: true,
      query,
      term: query,
    });
  const shortcuts = useShellShortcuts({
    openPalette: () => open(),
    focusSearch,
  });
  function focusSearch() {
    searchRef.current?.focus();
    if (document.activeElement !== searchRef.current) searchButtonRef.current?.focus();
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
    ref: shortcuts,
    "aria-label": "Main",
    className: "flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
        className: "flex min-w-0 flex-1 items-center gap-x-6 xl:flex-initial",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShopSwitcher, {
          shops,
          currentId,
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
        className:
          "order-last flex w-full flex-wrap gap-x-6 gap-y-1 xl:order-none xl:w-auto xl:flex-nowrap",
        children: navItems.map(({ to, label }) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            Link,
            {
              to,
              className:
                "-mx-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:text-foreground",
              children: label,
            },
            to,
          ),
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex items-center gap-4 md:ml-auto",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            ref: searchButtonRef,
            variant: "ghost",
            size: "icon",
            className: "xl:hidden",
            "aria-label": "Search",
            onClick: () => open(),
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { "aria-hidden": true }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InputGroup, {
            className: "hidden w-72 xl:flex",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputGroupAddon, {
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
                  "aria-hidden": true,
                }),
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputGroupInput, {
                ref: searchRef,
                value: "",
                placeholder: "Search",
                "aria-label": "Search",
                "aria-keyshortcuts": "/ Control+K Meta+K",
                onClick: () => open(),
                onChange: (event) => open(event.target.value),
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputGroupAddon, {
                align: "inline-end",
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(KbdGroup, {
                  "aria-hidden": true,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, { children: MOD_KEY }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, { children: "K" }),
                  ],
                }),
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserMenu, { user }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandPalette, {
        state: palette,
        onChange: setPalette,
        onClosed: focusSearch,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/shell/screen.tsx
function ShellScreen() {
  const { shops, currentId } = useShops();
  const { data: session } = useSuspenseQuery(sessionQuery());
  if (!session)
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
      to: "/login",
      search: { shop: currentShop()?.slug || void 0 },
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ShortcutRoot, {
    ref: focusIfIdle,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppBackdrop, {
        fill: true,
        className: "flex flex-col gap-8 px-5 py-6 md:px-13 md:py-10",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflineBanner, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TopNav, {
            shops,
            currentId,
            user: session.user,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
            className: "-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}),
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {}),
    ],
  });
}
//#endregion
export { ShellScreen };
