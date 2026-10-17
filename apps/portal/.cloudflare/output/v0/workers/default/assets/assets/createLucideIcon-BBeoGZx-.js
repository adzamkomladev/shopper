var e = Object.create,
  t = Object.defineProperty,
  n = Object.getOwnPropertyDescriptor,
  r = Object.getOwnPropertyNames,
  i = Object.getPrototypeOf,
  a = Object.prototype.hasOwnProperty,
  o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), (e = null)), t.exports),
  s = (e, i, o, s) => {
    if ((i && typeof i == `object`) || typeof i == `function`)
      for (var c = r(i), l = 0, u = c.length, d; l < u; l++)
        ((d = c[l]),
          !a.call(e, d) &&
            d !== o &&
            t(e, d, {
              get: ((e) => i[e]).bind(null, d),
              enumerable: !(s = n(i, d)) || s.enumerable,
            }));
    return e;
  },
  c = (n, r, o) => (
    (o = n == null ? {} : e(i(n))),
    s(
      r || !n || !n.__esModule || !a.call(n, `default`)
        ? t(o, `default`, { value: n, enumerable: !0 })
        : o,
      n,
    )
  ),
  l = o((e) => {
    var t = Symbol.for(`react.transitional.element`),
      n = Symbol.for(`react.portal`),
      r = Symbol.for(`react.fragment`),
      i = Symbol.for(`react.strict_mode`),
      a = Symbol.for(`react.profiler`),
      o = Symbol.for(`react.consumer`),
      s = Symbol.for(`react.context`),
      c = Symbol.for(`react.forward_ref`),
      l = Symbol.for(`react.suspense`),
      u = Symbol.for(`react.memo`),
      d = Symbol.for(`react.lazy`),
      f = Symbol.for(`react.activity`),
      p = Symbol.for(`react.view_transition`),
      m = Symbol.iterator;
    function h(e) {
      return typeof e != `object` || !e
        ? null
        : ((e = (m && e[m]) || e[`@@iterator`]), typeof e == `function` ? e : null);
    }
    var g = {
        isMounted: function () {
          return !1;
        },
        enqueueForceUpdate: function () {},
        enqueueReplaceState: function () {},
        enqueueSetState: function () {},
      },
      _ = Object.assign,
      v = {};
    function y(e, t, n) {
      ((this.props = e), (this.context = t), (this.refs = v), (this.updater = n || g));
    }
    ((y.prototype.isReactComponent = {}),
      (y.prototype.setState = function (e, t) {
        if (typeof e != `object` && typeof e != `function` && e != null)
          throw Error(
            `takes an object of state variables to update or a function which returns an object of state variables.`,
          );
        this.updater.enqueueSetState(this, e, t, `setState`);
      }),
      (y.prototype.forceUpdate = function (e) {
        this.updater.enqueueForceUpdate(this, e, `forceUpdate`);
      }));
    function b() {}
    b.prototype = y.prototype;
    function x(e, t, n) {
      ((this.props = e), (this.context = t), (this.refs = v), (this.updater = n || g));
    }
    var S = (x.prototype = new b());
    ((S.constructor = x), _(S, y.prototype), (S.isPureReactComponent = !0));
    var C = Array.isArray;
    function w() {}
    var T = { H: null, A: null, T: null, S: null },
      E = Object.prototype.hasOwnProperty;
    function D(e, n, r) {
      var i = r.ref;
      return { $$typeof: t, type: e, key: n, ref: i === void 0 ? null : i, props: r };
    }
    function O(e, t) {
      return D(e.type, t, e.props);
    }
    function k(e) {
      return typeof e == `object` && !!e && e.$$typeof === t;
    }
    function A(e) {
      var t = { "=": `=0`, ":": `=2` };
      return (
        `$` +
        e.replace(/[=:]/g, function (e) {
          return t[e];
        })
      );
    }
    var ee = /\/+/g;
    function j(e, t) {
      return typeof e == `object` && e && e.key != null ? A(`` + e.key) : t.toString(36);
    }
    function M(e) {
      switch (e.status) {
        case `fulfilled`:
          return e.value;
        case `rejected`:
          throw e.reason;
        default:
          switch (
            (typeof e.status == `string`
              ? e.then(w, w)
              : ((e.status = `pending`),
                e.then(
                  function (t) {
                    e.status === `pending` && ((e.status = `fulfilled`), (e.value = t));
                  },
                  function (t) {
                    e.status === `pending` && ((e.status = `rejected`), (e.reason = t));
                  },
                )),
            e.status)
          ) {
            case `fulfilled`:
              return e.value;
            case `rejected`:
              throw e.reason;
          }
      }
      throw e;
    }
    function N(e, r, i, a, o) {
      var s = typeof e;
      (s === `undefined` || s === `boolean`) && (e = null);
      var c = !1;
      if (e === null) c = !0;
      else
        switch (s) {
          case `bigint`:
          case `string`:
          case `number`:
            c = !0;
            break;
          case `object`:
            switch (e.$$typeof) {
              case t:
              case n:
                c = !0;
                break;
              case d:
                return ((c = e._init), N(c(e._payload), r, i, a, o));
            }
        }
      if (c)
        return (
          (o = o(e)),
          (c = a === `` ? `.` + j(e, 0) : a),
          C(o)
            ? ((i = ``),
              c != null && (i = c.replace(ee, `$&/`) + `/`),
              N(o, r, i, ``, function (e) {
                return e;
              }))
            : o != null &&
              (k(o) &&
                (o = O(
                  o,
                  i +
                    (o.key == null || (e && e.key === o.key)
                      ? ``
                      : (`` + o.key).replace(ee, `$&/`) + `/`) +
                    c,
                )),
              r.push(o)),
          1
        );
      c = 0;
      var l = a === `` ? `.` : a + `:`;
      if (C(e))
        for (var u = 0; u < e.length; u++) ((a = e[u]), (s = l + j(a, u)), (c += N(a, r, i, s, o)));
      else if (((u = h(e)), typeof u == `function`))
        for (e = u.call(e), u = 0; !(a = e.next()).done;)
          ((a = a.value), (s = l + j(a, u++)), (c += N(a, r, i, s, o)));
      else if (s === `object`) {
        if (typeof e.then == `function`) return N(M(e), r, i, a, o);
        throw (
          (r = String(e)),
          Error(
            `Objects are not valid as a React child (found: ` +
              (r === `[object Object]`
                ? `object with keys {` + Object.keys(e).join(`, `) + `}`
                : r) +
              `). If you meant to render a collection of children, use an array instead.`,
          )
        );
      }
      return c;
    }
    function P(e, t, n) {
      if (e == null) return e;
      var r = [],
        i = 0;
      return (
        N(e, r, ``, ``, function (e) {
          return t.call(n, e, i++);
        }),
        r
      );
    }
    function F(e) {
      if (e._status === -1) {
        var t = e._result,
          n = t();
        (n.then(
          function (t) {
            (e._status === 0 || e._status === -1) &&
              ((e._status = 1),
              (e._result = t),
              n.status === void 0 && ((n.status = `fulfilled`), (n.value = t)));
          },
          function (t) {
            (e._status === 0 || e._status === -1) &&
              ((e._status = 2),
              (e._result = t),
              n.status === void 0 && ((n.status = `rejected`), (n.reason = t)));
          },
        ),
          e._status === -1 && ((e._status = 0), (e._result = n)));
      }
      if (e._status === 1) return e._result.default;
      throw e._result;
    }
    var te =
      typeof reportError == `function`
        ? reportError
        : function (e) {
            if (typeof window == `object` && typeof window.ErrorEvent == `function`) {
              var t = new window.ErrorEvent(`error`, {
                bubbles: !0,
                cancelable: !0,
                message:
                  typeof e == `object` && e && typeof e.message == `string`
                    ? String(e.message)
                    : String(e),
                error: e,
              });
              if (!window.dispatchEvent(t)) return;
            } else if (typeof process == `object` && typeof process.emit == `function`) {
              process.emit(`uncaughtException`, e);
              return;
            }
            console.error(e);
          };
    function I(e) {
      var t = T.T,
        n = {};
      ((n.types = t === null ? null : t.types), (T.T = n));
      try {
        var r = e(),
          i = T.S;
        (i !== null && i(n, r),
          typeof r == `object` && r && typeof r.then == `function` && r.then(w, te));
      } catch (e) {
        te(e);
      } finally {
        (t !== null && n.types !== null && (t.types = n.types), (T.T = t));
      }
    }
    function L(e) {
      var t = T.T;
      if (t !== null) {
        var n = t.types;
        n === null ? (t.types = [e]) : n.indexOf(e) === -1 && n.push(e);
      } else I(L.bind(null, e));
    }
    var ne = {
      map: P,
      forEach: function (e, t, n) {
        P(
          e,
          function () {
            t.apply(this, arguments);
          },
          n,
        );
      },
      count: function (e) {
        var t = 0;
        return (
          P(e, function () {
            t++;
          }),
          t
        );
      },
      toArray: function (e) {
        return (
          P(e, function (e) {
            return e;
          }) || []
        );
      },
      only: function (e) {
        if (!k(e))
          throw Error(`React.Children.only expected to receive a single React element child.`);
        return e;
      },
    };
    ((e.Activity = f),
      (e.Children = ne),
      (e.Component = y),
      (e.Fragment = r),
      (e.Profiler = a),
      (e.PureComponent = x),
      (e.StrictMode = i),
      (e.Suspense = l),
      (e.ViewTransition = p),
      (e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = T),
      (e.__COMPILER_RUNTIME = {
        __proto__: null,
        c: function (e) {
          return T.H.useMemoCache(e);
        },
      }),
      (e.addTransitionType = L),
      (e.cache = function (e) {
        return function () {
          return e.apply(null, arguments);
        };
      }),
      (e.cacheSignal = function () {
        return null;
      }),
      (e.cloneElement = function (e, t, n) {
        if (e == null)
          throw Error(`The argument must be a React element, but you passed ` + e + `.`);
        var r = _({}, e.props),
          i = e.key;
        if (t != null)
          for (a in (t.key !== void 0 && (i = `` + t.key), t))
            !E.call(t, a) ||
              a === `key` ||
              a === `__self` ||
              a === `__source` ||
              (a === `ref` && t.ref === void 0) ||
              (r[a] = t[a]);
        var a = arguments.length - 2;
        if (a === 1) r.children = n;
        else if (1 < a) {
          for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
          r.children = o;
        }
        return D(e.type, i, r);
      }),
      (e.createContext = function (e) {
        return (
          (e = {
            $$typeof: s,
            _currentValue: e,
            _currentValue2: e,
            _threadCount: 0,
            Provider: null,
            Consumer: null,
          }),
          (e.Provider = e),
          (e.Consumer = { $$typeof: o, _context: e }),
          e
        );
      }),
      (e.createElement = function (e, t, n) {
        var r,
          i = {},
          a = null;
        if (t != null)
          for (r in (t.key !== void 0 && (a = `` + t.key), t))
            E.call(t, r) && r !== `key` && r !== `__self` && r !== `__source` && (i[r] = t[r]);
        var o = arguments.length - 2;
        if (o === 1) i.children = n;
        else if (1 < o) {
          for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
          i.children = s;
        }
        if (e && e.defaultProps)
          for (r in ((o = e.defaultProps), o)) i[r] === void 0 && (i[r] = o[r]);
        return D(e, a, i);
      }),
      (e.createRef = function () {
        return { current: null };
      }),
      (e.forwardRef = function (e) {
        return { $$typeof: c, render: e };
      }),
      (e.isValidElement = k),
      (e.lazy = function (e) {
        return { $$typeof: d, _payload: { _status: -1, _result: e }, _init: F };
      }),
      (e.memo = function (e, t) {
        return { $$typeof: u, type: e, compare: t === void 0 ? null : t };
      }),
      (e.startTransition = I),
      (e.unstable_useCacheRefresh = function () {
        return T.H.useCacheRefresh();
      }),
      (e.use = function (e) {
        return T.H.use(e);
      }),
      (e.useActionState = function (e, t, n) {
        return T.H.useActionState(e, t, n);
      }),
      (e.useCallback = function (e, t) {
        return T.H.useCallback(e, t);
      }),
      (e.useContext = function (e) {
        return T.H.useContext(e);
      }),
      (e.useDebugValue = function () {}),
      (e.useDeferredValue = function (e, t) {
        return T.H.useDeferredValue(e, t);
      }),
      (e.useEffect = function (e, t) {
        return T.H.useEffect(e, t);
      }),
      (e.useEffectEvent = function (e) {
        return T.H.useEffectEvent(e);
      }),
      (e.useId = function () {
        return T.H.useId();
      }),
      (e.useImperativeHandle = function (e, t, n) {
        return T.H.useImperativeHandle(e, t, n);
      }),
      (e.useInsertionEffect = function (e, t) {
        return T.H.useInsertionEffect(e, t);
      }),
      (e.useLayoutEffect = function (e, t) {
        return T.H.useLayoutEffect(e, t);
      }),
      (e.useMemo = function (e, t) {
        return T.H.useMemo(e, t);
      }),
      (e.useOptimistic = function (e, t) {
        return T.H.useOptimistic(e, t);
      }),
      (e.useReducer = function (e, t, n) {
        return T.H.useReducer(e, t, n);
      }),
      (e.useRef = function (e) {
        return T.H.useRef(e);
      }),
      (e.useState = function (e) {
        return T.H.useState(e);
      }),
      (e.useSyncExternalStore = function (e, t, n) {
        return T.H.useSyncExternalStore(e, t, n);
      }),
      (e.useTransition = function () {
        return T.H.useTransition();
      }),
      (e.version = `19.3.0`));
  }),
  u = o((e, t) => {
    t.exports = l();
  }),
  d = o((e) => {
    var t = u();
    function n(e) {
      var t = `https://react.dev/errors/` + e;
      if (1 < arguments.length) {
        t += `?args[]=` + encodeURIComponent(arguments[1]);
        for (var n = 2; n < arguments.length; n++)
          t += `&args[]=` + encodeURIComponent(arguments[n]);
      }
      return (
        `Minified React error #` +
        e +
        `; visit ` +
        t +
        ` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`
      );
    }
    function r() {}
    var i = {
        d: {
          f: r,
          r: function () {
            throw Error(n(522));
          },
          D: r,
          C: r,
          L: r,
          m: r,
          X: r,
          S: r,
          M: r,
        },
        p: 0,
        findDOMNode: null,
      },
      a = Symbol.for(`react.portal`),
      o = Symbol.for(`react.recoverable`),
      s = Symbol.for(`react.optimistic_key`);
    function c(e, t, n) {
      var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
      return {
        $$typeof: a,
        key: r == null ? null : r === s ? s : `` + r,
        children: e,
        containerInfo: t,
        implementation: n,
      };
    }
    var l = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function d(e, t) {
      if (e === `font`) return ``;
      if (typeof t == `string`) return t === `use-credentials` ? t : ``;
    }
    ((e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i),
      (e.browser = function (e) {
        return { $$typeof: o, _reason: e };
      }),
      (e.createPortal = function (e, t) {
        var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
        if (!t || (t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11)) throw Error(n(299));
        return c(e, t, null, r);
      }),
      (e.flushSync = function (e) {
        var t = l.T,
          n = i.p;
        try {
          if (((l.T = null), (i.p = 2), e)) return e();
        } finally {
          ((l.T = t), (i.p = n), i.d.f());
        }
      }),
      (e.preconnect = function (e, t) {
        typeof e == `string` &&
          (t
            ? ((t = t.crossOrigin),
              (t = typeof t == `string` ? (t === `use-credentials` ? t : ``) : void 0))
            : (t = null),
          i.d.C(e, t));
      }),
      (e.prefetchDNS = function (e) {
        typeof e == `string` && i.d.D(e);
      }),
      (e.preinit = function (e, t) {
        if (typeof e == `string` && t && typeof t.as == `string`) {
          var n = t.as,
            r = d(n, t.crossOrigin),
            a = typeof t.integrity == `string` ? t.integrity : void 0,
            o = typeof t.fetchPriority == `string` ? t.fetchPriority : void 0;
          n === `style`
            ? i.d.S(e, typeof t.precedence == `string` ? t.precedence : void 0, {
                crossOrigin: r,
                integrity: a,
                fetchPriority: o,
              })
            : n === `script` &&
              i.d.X(e, {
                crossOrigin: r,
                integrity: a,
                fetchPriority: o,
                nonce: typeof t.nonce == `string` ? t.nonce : void 0,
              });
        }
      }),
      (e.preinitModule = function (e, t) {
        if (typeof e == `string`) {
          if (typeof t == `object` && t) {
            if (t.as == null || t.as === `script`) {
              var n = d(t.as, t.crossOrigin);
              i.d.M(e, {
                crossOrigin: n,
                integrity: typeof t.integrity == `string` ? t.integrity : void 0,
                nonce: typeof t.nonce == `string` ? t.nonce : void 0,
                fetchPriority: typeof t.fetchPriority == `string` ? t.fetchPriority : void 0,
              });
            }
          } else t ?? i.d.M(e);
        }
      }),
      (e.preload = function (e, t) {
        if (typeof e == `string` && typeof t == `object` && t && typeof t.as == `string`) {
          var n = t.as,
            r = d(n, t.crossOrigin);
          i.d.L(e, n, {
            crossOrigin: r,
            integrity: typeof t.integrity == `string` ? t.integrity : void 0,
            nonce: typeof t.nonce == `string` ? t.nonce : void 0,
            type: typeof t.type == `string` ? t.type : void 0,
            fetchPriority: typeof t.fetchPriority == `string` ? t.fetchPriority : void 0,
            referrerPolicy: typeof t.referrerPolicy == `string` ? t.referrerPolicy : void 0,
            imageSrcSet: typeof t.imageSrcSet == `string` ? t.imageSrcSet : void 0,
            imageSizes: typeof t.imageSizes == `string` ? t.imageSizes : void 0,
            media: typeof t.media == `string` ? t.media : void 0,
          });
        }
      }),
      (e.preloadModule = function (e, t) {
        if (typeof e == `string`) {
          if (t) {
            var n = d(t.as, t.crossOrigin);
            i.d.m(e, {
              as: typeof t.as == `string` && t.as !== `script` ? t.as : void 0,
              crossOrigin: n,
              integrity: typeof t.integrity == `string` ? t.integrity : void 0,
              nonce: typeof t.nonce == `string` ? t.nonce : void 0,
              fetchPriority: typeof t.fetchPriority == `string` ? t.fetchPriority : void 0,
            });
          } else i.d.m(e);
        }
      }),
      (e.requestFormReset = function (e) {
        i.d.r(e);
      }),
      (e.unstable_batchedUpdates = function (e, t) {
        return e(t);
      }),
      (e.useFormState = function (e, t, n) {
        return l.H.useFormState(e, t, n);
      }),
      (e.useFormStatus = function () {
        return l.H.useHostTransitionStatus();
      }),
      (e.version = `19.3.0`));
  }),
  f = o((e, t) => {
    function n() {
      if (
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < `u` &&
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == `function`
      )
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
        } catch (e) {
          console.error(e);
        }
    }
    (n(), (t.exports = d()));
  }),
  p = o((e) => {
    var t = Symbol.for(`react.transitional.element`),
      n = Symbol.for(`react.fragment`);
    function r(e, n, r) {
      var i = null;
      if ((r !== void 0 && (i = `` + r), n.key !== void 0 && (i = `` + n.key), `key` in n))
        for (var a in ((r = {}), n)) a !== `key` && (r[a] = n[a]);
      else r = n;
      return (
        (n = r.ref), { $$typeof: t, type: e, key: i, ref: n === void 0 ? null : n, props: r }
      );
    }
    ((e.Fragment = n), (e.jsx = r), (e.jsxs = r));
  }),
  m = o((e, t) => {
    t.exports = p();
  }),
  h = c(u(), 1),
  g = m(),
  _ = h.createContext(void 0),
  v = (e) => {
    let t = h.useContext(_);
    if (e) return e;
    if (!t) throw Error(`No QueryClient set, use QueryClientProvider to set one`);
    return t;
  },
  y = ({ client: e, children: t }) => (
    h.useEffect(
      () => (
        e.mount(),
        () => {
          e.unmount();
        }
      ),
      [e],
    ),
    (0, g.jsx)(_.Provider, { value: e, children: t })
  ),
  b = {
    setTimeout: (e, t) => setTimeout(e, t),
    clearTimeout: (e) => clearTimeout(e),
    setInterval: (e, t) => setInterval(e, t),
    clearInterval: (e) => clearInterval(e),
  },
  x = new (class {
    #e = b;
    setTimeoutProvider(e) {
      this.#e = e;
    }
    setTimeout(e, t) {
      return this.#e.setTimeout(e, t);
    }
    clearTimeout(e) {
      this.#e.clearTimeout(e);
    }
    setInterval(e, t) {
      return this.#e.setInterval(e, t);
    }
    clearInterval(e) {
      this.#e.clearInterval(e);
    }
  })();
function S(e) {
  setTimeout(e, 0);
}
var C = typeof window > `u` || `Deno` in globalThis;
function w() {}
function T(e, t) {
  return typeof e == `function` ? e(t) : e;
}
function E(e) {
  return typeof e == `number` && e >= 0 && e !== 1 / 0;
}
function D(e, t) {
  return Math.max(e + (t || 0) - Date.now(), 0);
}
function O(e, t) {
  return typeof e == `function` ? e(t) : e;
}
function k(e, t) {
  let { type: n = `all`, exact: r, fetchStatus: i, predicate: a, queryKey: o, stale: s } = e;
  if (o) {
    if (r) {
      if (t.queryHash !== ee(o, t.options)) return !1;
    } else if (!M(t.queryKey, o)) return !1;
  }
  if (n !== `all`) {
    let e = t.isActive();
    if ((n === `active` && !e) || (n === `inactive` && e)) return !1;
  }
  return !(
    (typeof s == `boolean` && t.isStale() !== s) ||
    (i && i !== t.state.fetchStatus) ||
    (a && !a(t))
  );
}
function A(e, t) {
  let { exact: n, status: r, predicate: i, mutationKey: a } = e;
  if (a) {
    if (!t.options.mutationKey) return !1;
    if (n) {
      if (j(t.options.mutationKey) !== j(a)) return !1;
    } else if (!M(t.options.mutationKey, a)) return !1;
  }
  return !((r && t.state.status !== r) || (i && !i(t)));
}
function ee(e, t) {
  return (t?.queryKeyHashFn || j)(e);
}
function j(e) {
  return JSON.stringify(e, (e, t) =>
    I(t)
      ? Object.keys(t)
          .sort()
          .reduce((e, n) => ((e[n] = t[n]), e), {})
      : t,
  );
}
function M(e, t) {
  if (e === t) return !0;
  if (typeof e != typeof t) return !1;
  if (e && t && typeof e == `object` && typeof t == `object`) {
    if (Array.isArray(e) && Array.isArray(t)) {
      if (t.length > e.length) return !1;
      for (let n = 0; n < t.length; n++) if (!M(e[n], t[n])) return !1;
      return !0;
    }
    let n = Object.keys(t);
    for (let r of n) if (!M(e[r], t[r])) return !1;
    return !0;
  }
  return !1;
}
var N = Object.prototype.hasOwnProperty;
function P(e, t, n = 0) {
  if (e === t) return e;
  if (n > 500) return t;
  let r = te(e) && te(t);
  if (!r && !(I(e) && I(t))) return t;
  let i = (r ? e : Object.keys(e)).length,
    a = r ? t : Object.keys(t),
    o = a.length,
    s = r ? Array(o) : {},
    c = 0;
  for (let l = 0; l < o; l++) {
    let o = r ? l : a[l],
      u = e[o],
      d = t[o];
    if (u === d) {
      ((s[o] = u), (r ? l < i : N.call(e, o)) && c++);
      continue;
    }
    if (u === null || d === null || typeof u != `object` || typeof d != `object`) {
      s[o] = d;
      continue;
    }
    let f = P(u, d, n + 1);
    ((s[o] = f), f === u && c++);
  }
  return i === o && c === i ? e : s;
}
function F(e, t) {
  if (!t || Object.keys(e).length !== Object.keys(t).length) return !1;
  for (let n in e) if (e[n] !== t[n]) return !1;
  return !0;
}
function te(e) {
  return Array.isArray(e) && e.length === Object.keys(e).length;
}
function I(e) {
  if (!L(e)) return !1;
  let t = Object.getPrototypeOf(e),
    n = t?.constructor;
  if (n === void 0) return !0;
  if (typeof n != `function`) return !1;
  let r = n.prototype;
  return !(!L(r) || !r.hasOwnProperty(`isPrototypeOf`) || t !== Object.prototype);
}
function L(e) {
  return Object.prototype.toString.call(e) === `[object Object]`;
}
function ne(e) {
  return new Promise((t) => {
    x.setTimeout(t, e);
  });
}
function re(e, t, n) {
  return typeof n.structuralSharing == `function`
    ? n.structuralSharing(e, t)
    : n.structuralSharing === !1
      ? t
      : P(e, t);
}
function ie(e) {
  return e;
}
function ae(e, t, n = 0) {
  let r = [...e, t];
  return n && r.length > n ? r.slice(1) : r;
}
function R(e, t, n = 0) {
  let r = [t, ...e];
  return n && r.length > n ? r.slice(0, -1) : r;
}
var oe = Symbol();
function se(e, t) {
  return !e.queryFn && t?.initialPromise
    ? () => t.initialPromise
    : !e.queryFn || e.queryFn === oe
      ? () => Promise.reject(Error(`Missing queryFn: '${e.queryHash}'`))
      : e.queryFn;
}
function ce(e, t) {
  return typeof e == `function` ? e(...t) : !!e;
}
function le(e, t, n) {
  let r = !1,
    i;
  return (
    Object.defineProperty(e, "signal", {
      enumerable: !0,
      get: () => (
        (i ??= t()),
        r ? i : ((r = !0), i.aborted ? n() : i.addEventListener(`abort`, n, { once: !0 }), i)
      ),
    }),
    e
  );
}
var ue = () => C,
  de = () => ue(),
  z = class {
    constructor() {
      ((this.listeners = new Set()), (this.subscribe = this.subscribe.bind(this)));
    }
    subscribe(e) {
      return (
        this.listeners.add(e),
        this.onSubscribe(),
        () => {
          (this.listeners.delete(e), this.onUnsubscribe());
        }
      );
    }
    hasListeners() {
      return this.listeners.size > 0;
    }
    onSubscribe() {}
    onUnsubscribe() {}
  },
  fe = new (class extends z {
    #e;
    #t;
    #n;
    constructor() {
      (super(),
        (this.#n = (e) => {
          if (typeof window < `u` && window.addEventListener) {
            let t = () => e();
            return (
              window.addEventListener(`visibilitychange`, t, !1),
              () => {
                window.removeEventListener(`visibilitychange`, t);
              }
            );
          }
        }));
    }
    onSubscribe() {
      this.#t || this.setEventListener(this.#n);
    }
    onUnsubscribe() {
      this.hasListeners() || (this.#t?.(), (this.#t = void 0));
    }
    setEventListener(e) {
      ((this.#n = e),
        this.#t?.(),
        (this.#t = e((e) => {
          typeof e == `boolean` ? this.setFocused(e) : this.onFocus();
        })));
    }
    setFocused(e) {
      this.#e !== e && ((this.#e = e), this.onFocus());
    }
    onFocus() {
      let e = this.isFocused();
      this.listeners.forEach((t) => {
        t(e);
      });
    }
    isFocused() {
      return typeof this.#e == `boolean`
        ? this.#e
        : globalThis.document?.visibilityState !== `hidden`;
    }
  })(),
  pe = S;
function me() {
  let e = [],
    t = 0,
    n = (e) => {
      e();
    },
    r = (e) => {
      e();
    },
    i = pe,
    a = (r) => {
      t
        ? e.push(r)
        : i(() => {
            n(r);
          });
    },
    o = () => {
      let t = e;
      ((e = []),
        t.length &&
          i(() => {
            r(() => {
              t.forEach((e) => {
                n(e);
              });
            });
          }));
    };
  return {
    batch: (e) => {
      let n;
      t++;
      try {
        n = e();
      } finally {
        (t--, t || o());
      }
      return n;
    },
    batchCalls:
      (e) =>
      (...t) => {
        a(() => {
          e(...t);
        });
      },
    schedule: a,
    setNotifyFunction: (e) => {
      n = e;
    },
    setBatchNotifyFunction: (e) => {
      r = e;
    },
    setScheduler: (e) => {
      i = e;
    },
  };
}
var he = me(),
  ge = new (class extends z {
    #e = !0;
    #t;
    #n;
    constructor() {
      (super(),
        (this.#n = (e) => {
          if (typeof window < `u` && window.addEventListener) {
            let t = () => e(!0),
              n = () => e(!1);
            return (
              window.addEventListener(`online`, t, !1),
              window.addEventListener(`offline`, n, !1),
              () => {
                (window.removeEventListener(`online`, t), window.removeEventListener(`offline`, n));
              }
            );
          }
        }));
    }
    onSubscribe() {
      this.#t || this.setEventListener(this.#n);
    }
    onUnsubscribe() {
      this.hasListeners() || (this.#t?.(), (this.#t = void 0));
    }
    setEventListener(e) {
      ((this.#n = e), this.#t?.(), (this.#t = e(this.setOnline.bind(this))));
    }
    setOnline(e) {
      this.#e !== e &&
        ((this.#e = e),
        this.listeners.forEach((t) => {
          t(e);
        }));
    }
    isOnline() {
      return this.#e;
    }
  })();
function _e(e) {
  return Math.min(1e3 * 2 ** e, 3e4);
}
function ve(e) {
  return (e ?? `online`) !== `online` || ge.isOnline();
}
var ye = class extends Error {
  constructor(e) {
    (super(`CancelledError`), (this.revert = e?.revert), (this.silent = e?.silent));
  }
};
function be(e) {
  let t = !1,
    n = 0,
    r,
    i = `pending`,
    a,
    o,
    s = new Promise((e, t) => {
      ((a = e), (o = t));
    });
  s.catch(w);
  let c = () => i !== `pending`,
    l = (t) => {
      if (!c()) {
        let n = new ye(t);
        (h(n), e.onCancel?.(n));
      }
    },
    u = () => {
      t = !0;
    },
    d = () => {
      t = !1;
    },
    f = () => fe.isFocused() && (e.networkMode === `always` || ge.isOnline()) && e.canRun(),
    p = () => ve(e.networkMode) && e.canRun(),
    m = (e) => {
      c() || (r?.(), (i = `resolved`), a(e));
    },
    h = (e) => {
      c() || (r?.(), (i = `rejected`), o(e));
    },
    g = () =>
      new Promise((t) => {
        ((r = (e) => {
          (c() || f()) && t(e);
        }),
          e.onPause?.());
      }).then(() => {
        ((r = void 0), c() || e.onContinue?.());
      }),
    _ = () => {
      if (c()) return;
      let r,
        i = n === 0 ? e.initialPromise : void 0;
      try {
        r = i ?? e.fn();
      } catch (e) {
        r = Promise.reject(e);
      }
      Promise.resolve(r)
        .then(m)
        .catch((r) => {
          if (c()) return;
          let i = e.retry ?? (de() ? 0 : 3),
            a = e.retryDelay ?? _e,
            o = typeof a == `function` ? a(n, r) : a,
            s = i === !0 || (typeof i == `number` && n < i) || (typeof i == `function` && i(n, r));
          if (t || !s) {
            h(r);
            return;
          }
          (n++,
            e.onFail?.(n, r),
            ne(o)
              .then(() => (f() ? void 0 : g()))
              .then(() => {
                t ? h(r) : _();
              }));
        });
    };
  return {
    promise: s,
    status: () => i,
    cancel: l,
    continue: () => (r?.(), s),
    cancelRetry: u,
    continueRetry: d,
    canStart: p,
    start: () => (p() ? _() : g().then(_), s),
  };
}
var xe = class {
    #e;
    destroy() {
      this.clearGcTimeout();
    }
    scheduleGc() {
      (this.clearGcTimeout(),
        E(this.gcTime) &&
          (this.#e = x.setTimeout(() => {
            this.optionalRemove();
          }, this.gcTime)));
    }
    updateGcTime(e) {
      this.gcTime = Math.max(this.gcTime || 0, e ?? (de() ? 1 / 0 : 3e5));
    }
    clearGcTimeout() {
      this.#e !== void 0 && (x.clearTimeout(this.#e), (this.#e = void 0));
    }
  },
  Se = class extends xe {
    #e;
    #t;
    #n;
    #r;
    constructor(e) {
      (super(),
        (this.#e = e.client),
        (this.mutationId = e.mutationId),
        (this.#n = e.mutationCache),
        (this.#t = []),
        (this.state = e.state || Ce()),
        this.setOptions(e.options),
        this.scheduleGc());
    }
    setOptions(e) {
      ((this.options = e), this.updateGcTime(this.options.gcTime));
    }
    get meta() {
      return this.options.meta;
    }
    addObserver(e) {
      this.#t.includes(e) ||
        (this.#t.push(e),
        this.clearGcTimeout(),
        this.#n.notify({ type: `observerAdded`, mutation: this, observer: e }));
    }
    removeObserver(e) {
      ((this.#t = this.#t.filter((t) => t !== e)),
        this.scheduleGc(),
        this.#n.notify({ type: `observerRemoved`, mutation: this, observer: e }));
    }
    optionalRemove() {
      this.#t.length ||
        (this.state.status === `pending` ? this.scheduleGc() : this.#n.remove(this));
    }
    continue() {
      return (
        this.#r?.continue() ??
        (this.state.status === `pending` ? this.execute(this.state.variables) : Promise.resolve())
      );
    }
    async execute(e) {
      let t = () => {
          this.#i({ type: `continue` });
        },
        n = { client: this.#e, meta: this.options.meta, mutationKey: this.options.mutationKey },
        r = (this.#r = be({
          fn: () =>
            this.options.mutationFn
              ? this.options.mutationFn(e, n)
              : Promise.reject(Error(`No mutationFn found`)),
          onFail: (e, t) => {
            this.#i({ type: `failed`, failureCount: e, error: t });
          },
          onPause: () => {
            this.#i({ type: `pause` });
          },
          onContinue: t,
          retry: this.options.retry ?? 0,
          retryDelay: this.options.retryDelay,
          networkMode: this.options.networkMode,
          canRun: () => this.#n.canRun(this),
        })),
        i = this.state.status === `pending`,
        a = !r.canStart();
      try {
        if (i) t();
        else {
          (this.#i({ type: `pending`, variables: e, isPaused: a }),
            this.#n.config.onMutate && (await this.#n.config.onMutate(e, this, n)));
          let t = await this.options.onMutate?.(e, n);
          t !== this.state.context &&
            this.#i({ type: `pending`, context: t, variables: e, isPaused: a });
        }
        let o = await r.start();
        return (
          await this.#n.config.onSuccess?.(o, e, this.state.context, this, n),
          await this.options.onSuccess?.(o, e, this.state.context, n),
          await this.#n.config.onSettled?.(
            o,
            null,
            this.state.variables,
            this.state.context,
            this,
            n,
          ),
          await this.options.onSettled?.(o, null, e, this.state.context, n),
          this.#i({ type: `success`, data: o }),
          o
        );
      } catch (t) {
        try {
          await this.#n.config.onError?.(t, e, this.state.context, this, n);
        } catch (e) {
          Promise.reject(e);
        }
        try {
          await this.options.onError?.(t, e, this.state.context, n);
        } catch (e) {
          Promise.reject(e);
        }
        try {
          await this.#n.config.onSettled?.(
            void 0,
            t,
            this.state.variables,
            this.state.context,
            this,
            n,
          );
        } catch (e) {
          Promise.reject(e);
        }
        try {
          await this.options.onSettled?.(void 0, t, e, this.state.context, n);
        } catch (e) {
          Promise.reject(e);
        }
        throw (this.#i({ type: `error`, error: t }), t);
      } finally {
        (this.#r === r && (this.#r = void 0), this.#n.runNext(this));
      }
    }
    #i(e) {
      let t = (t) => {
        switch (e.type) {
          case `failed`:
            return { ...t, failureCount: e.failureCount, failureReason: e.error };
          case `pause`:
            return { ...t, isPaused: !0 };
          case `continue`:
            return { ...t, isPaused: !1 };
          case `pending`:
            return {
              ...t,
              context: e.context,
              data: void 0,
              failureCount: 0,
              failureReason: null,
              error: null,
              isPaused: e.isPaused,
              status: `pending`,
              variables: e.variables,
              submittedAt: Date.now(),
            };
          case `success`:
            return {
              ...t,
              data: e.data,
              failureCount: 0,
              failureReason: null,
              error: null,
              status: `success`,
              isPaused: !1,
            };
          case `error`:
            return {
              ...t,
              data: void 0,
              error: e.error,
              failureCount: t.failureCount + 1,
              failureReason: e.error,
              isPaused: !1,
              status: `error`,
            };
        }
      };
      ((this.state = t(this.state)),
        he.batch(() => {
          (this.#t.forEach((t) => {
            t.onMutationUpdate(e);
          }),
            this.#n.notify({ mutation: this, type: `updated`, action: e }));
        }));
    }
  };
function Ce() {
  return {
    context: void 0,
    data: void 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: !1,
    status: `idle`,
    variables: void 0,
    submittedAt: 0,
  };
}
var we = class extends z {
  #e;
  #t = void 0;
  #n;
  #r;
  constructor(e, t) {
    (super(), (this.#e = e), this.setOptions(t), this.bindMethods(), this.#i());
  }
  bindMethods() {
    ((this.mutate = this.mutate.bind(this)), (this.reset = this.reset.bind(this)));
  }
  setOptions(e) {
    let t = this.options;
    ((this.options = this.#e.defaultMutationOptions(e)),
      F(this.options, t) ||
        this.#e
          .getMutationCache()
          .notify({ type: `observerOptionsUpdated`, mutation: this.#n, observer: this }),
      t?.mutationKey && this.options.mutationKey && j(t.mutationKey) !== j(this.options.mutationKey)
        ? this.reset()
        : this.#n?.state.status === `pending` && this.#n.setOptions(this.options));
  }
  onSubscribe() {
    this.listeners.size === 1 && this.#n && (this.#n.addObserver(this), this.#i());
  }
  onUnsubscribe() {
    this.hasListeners() || this.#n?.removeObserver(this);
  }
  onMutationUpdate(e) {
    (this.#i(), this.#a(e));
  }
  getCurrentResult() {
    return this.#t;
  }
  reset() {
    (this.#n?.removeObserver(this), (this.#n = void 0), this.#i(), this.#a());
  }
  mutate(e, t) {
    return (
      (this.#r = t),
      this.#n?.removeObserver(this),
      (this.#n = this.#e.getMutationCache().build(this.#e, this.options)),
      this.#n.addObserver(this),
      this.#n.execute(e)
    );
  }
  #i() {
    let e = this.#n?.state ?? Ce();
    this.#t = {
      ...e,
      isPending: e.status === `pending`,
      isSuccess: e.status === `success`,
      isError: e.status === `error`,
      isIdle: e.status === `idle`,
      mutate: this.mutate,
      reset: this.reset,
    };
  }
  #a(e) {
    he.batch(() => {
      if (this.#r && this.hasListeners()) {
        let t = this.#t.variables,
          n = this.#t.context,
          r = { client: this.#e, meta: this.options.meta, mutationKey: this.options.mutationKey };
        if (e?.type === `success`) {
          try {
            this.#r.onSuccess?.(e.data, t, n, r);
          } catch (e) {
            Promise.reject(e);
          }
          try {
            this.#r.onSettled?.(e.data, null, t, n, r);
          } catch (e) {
            Promise.reject(e);
          }
        } else if (e?.type === `error`) {
          try {
            this.#r.onError?.(e.error, t, n, r);
          } catch (e) {
            Promise.reject(e);
          }
          try {
            this.#r.onSettled?.(void 0, e.error, t, n, r);
          } catch (e) {
            Promise.reject(e);
          }
        }
      }
      this.listeners.forEach((e) => {
        e(this.#t);
      });
    });
  }
};
function Te(e, t) {
  let n = v(t),
    [r] = h.useState(() => new we(n, e));
  h.useEffect(() => {
    r.setOptions(e);
  }, [r, e]);
  let i = h.useSyncExternalStore(
      h.useCallback((e) => r.subscribe(he.batchCalls(e)), [r]),
      () => r.getCurrentResult(),
      () => r.getCurrentResult(),
    ),
    a = h.useCallback(
      (...e) => {
        r.mutate(e[0], e[1]).catch(w);
      },
      [r],
    );
  if (i.error && ce(r.options.throwOnError, [i.error])) throw i.error;
  return { ...i, mutate: a, mutateAsync: i.mutate };
}
function Ee(e) {
  return {
    lang: e?.lang ?? void 0,
    message: e?.message,
    abortEarly: e?.abortEarly ?? void 0,
    abortPipeEarly: e?.abortPipeEarly ?? void 0,
  };
}
var De;
function Oe(e, t, n) {
  ((De ||= new Map()), De.get(e) || De.set(e, new Map()), De.get(e).set(n, t));
}
function ke(e, t) {
  return De?.get(e)?.get(t);
}
function Ae(e) {
  let t = typeof e;
  return t === `string`
    ? `"${e}"`
    : t === `number` || t === `bigint` || t === `boolean`
      ? `${e}`
      : t === `object` || t === `function`
        ? ((e && Object.getPrototypeOf(e)?.constructor?.name) ?? `null`)
        : t;
}
function B(e, t, n, r, i) {
  let a = i && `input` in i ? i.input : n.value,
    o = i?.expected ?? e.expects ?? null,
    s = i?.received ?? Ae(a),
    c = {
      kind: e.kind,
      type: e.type,
      input: a,
      expected: o,
      received: s,
      message: `Invalid ${t}: ${o ? `Expected ${o} but r` : `R`}eceived ${s}`,
      requirement: e.requirement,
      path: i?.path,
      issues: i?.issues,
      lang: r.lang,
      abortEarly: r.abortEarly,
      abortPipeEarly: r.abortPipeEarly,
    },
    l = e.kind === `schema`,
    u =
      i?.message ??
      e.message ??
      ke(e.reference, c.lang) ??
      (l ? (c.lang, void 0) : null) ??
      r.message ??
      (c.lang, void 0);
  (u !== void 0 && (c.message = typeof u == `function` ? u(c) : u),
    l && (n.typed = !1),
    n.issues ? n.issues.push(c) : (n.issues = [c]));
}
function V(e) {
  return {
    version: 1,
    vendor: `valibot`,
    validate(t) {
      return e[`~run`]({ value: t }, Ee());
    },
  };
}
function je(e, t) {
  return Object.hasOwn(e, t) && t !== `__proto__` && t !== `prototype` && t !== `constructor`;
}
function Me(e, t) {
  let n = [...new Set(e)];
  return n.length > 1 ? `(${n.join(` ${t} `)})` : (n[0] ?? `never`);
}
function Ne(e) {
  if (e.path) {
    let t = ``;
    for (let n of e.path)
      if (typeof n.key == `string` || typeof n.key == `number`) t += t ? `.${n.key}` : n.key;
      else return null;
    return t;
  }
  return null;
}
var Pe = class extends Error {
    constructor(e) {
      (super(e[0].message), (this.name = `ValiError`), (this.issues = e));
    }
  },
  Fe = /^[\w+-]+(?:\.[\w+-]+)*@[\da-z]+(?:[.-][\da-z]+)*\.[a-z]{2,}$/iu,
  Ie =
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:[12]\d|0[1-9]|3[01])[T ](?:0\d|1\d|2[0-3])(?::[0-5]\d){2}(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1\d|2[0-3])(?::?[0-5]\d)?)$/u,
  H = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu;
function Le(e) {
  return {
    kind: `transformation`,
    type: `brand`,
    reference: Le,
    async: !1,
    name: e,
    "~run"(e) {
      return e;
    },
  };
}
function Re(e, t) {
  return {
    kind: `validation`,
    type: `check`,
    reference: Re,
    async: !1,
    expects: null,
    requirement: e,
    message: t,
    "~run"(e, t) {
      return (e.typed && !this.requirement(e.value) && B(this, `input`, e, t), e);
    },
  };
}
function ze(e) {
  return {
    kind: `validation`,
    type: `email`,
    reference: ze,
    expects: null,
    async: !1,
    requirement: Fe,
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement.test(e.value) && B(this, `email`, e, t), e);
    },
  };
}
function Be(e) {
  return {
    kind: `validation`,
    type: `finite`,
    reference: Be,
    async: !1,
    expects: null,
    requirement: Number.isFinite,
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement(e.value) && B(this, `finite`, e, t), e);
    },
  };
}
function Ve(e) {
  return {
    kind: `validation`,
    type: `integer`,
    reference: Ve,
    async: !1,
    expects: null,
    requirement: Number.isInteger,
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement(e.value) && B(this, `integer`, e, t), e);
    },
  };
}
function He(e) {
  return {
    kind: `validation`,
    type: `iso_timestamp`,
    reference: He,
    async: !1,
    expects: null,
    requirement: Ie,
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement.test(e.value) && B(this, `timestamp`, e, t), e);
    },
  };
}
function U(e, t) {
  return {
    kind: `validation`,
    type: `max_length`,
    reference: U,
    async: !1,
    expects: `<=${e}`,
    requirement: e,
    message: t,
    "~run"(e, t) {
      return (
        e.typed &&
          e.value.length > this.requirement &&
          B(this, `length`, e, t, { received: `${e.value.length}` }),
        e
      );
    },
  };
}
function Ue(e, t) {
  return {
    kind: `validation`,
    type: `max_value`,
    reference: Ue,
    async: !1,
    expects: `<=${e instanceof Date ? e.toJSON() : Ae(e)}`,
    requirement: e,
    message: t,
    "~run"(e, t) {
      return (
        e.typed &&
          !(e.value <= this.requirement) &&
          B(this, `value`, e, t, {
            received: e.value instanceof Date ? e.value.toJSON() : Ae(e.value),
          }),
        e
      );
    },
  };
}
function We(e, t) {
  return {
    kind: `validation`,
    type: `min_length`,
    reference: We,
    async: !1,
    expects: `>=${e}`,
    requirement: e,
    message: t,
    "~run"(e, t) {
      return (
        e.typed &&
          e.value.length < this.requirement &&
          B(this, `length`, e, t, { received: `${e.value.length}` }),
        e
      );
    },
  };
}
function Ge(e, t) {
  return {
    kind: `validation`,
    type: `min_value`,
    reference: Ge,
    async: !1,
    expects: `>=${e instanceof Date ? e.toJSON() : Ae(e)}`,
    requirement: e,
    message: t,
    "~run"(e, t) {
      return (
        e.typed &&
          !(e.value >= this.requirement) &&
          B(this, `value`, e, t, {
            received: e.value instanceof Date ? e.value.toJSON() : Ae(e.value),
          }),
        e
      );
    },
  };
}
function Ke(e) {
  return {
    kind: `validation`,
    type: `non_empty`,
    reference: Ke,
    async: !1,
    expects: `!0`,
    message: e,
    "~run"(e, t) {
      return (e.typed && e.value.length === 0 && B(this, `length`, e, t, { received: `0` }), e);
    },
  };
}
function qe(e) {
  return {
    kind: `validation`,
    type: `raw_check`,
    reference: qe,
    async: !1,
    expects: null,
    "~run"(t, n) {
      return (
        e({ dataset: t, config: n, addIssue: (e) => B(this, e?.label ?? `input`, t, n, e) }), t
      );
    },
  };
}
function Je(e) {
  return {
    kind: `transformation`,
    type: `raw_transform`,
    reference: Je,
    async: !1,
    "~run"(t, n) {
      let r = e({
        dataset: t,
        config: n,
        addIssue: (e) => B(this, e?.label ?? `input`, t, n, e),
        NEVER: null,
      });
      return (t.issues ? (t.typed = !1) : (t.value = r), t);
    },
  };
}
function W(e, t) {
  return {
    kind: `validation`,
    type: `regex`,
    reference: W,
    async: !1,
    expects: `${e}`,
    requirement: e,
    message: t,
    "~run"(e, t) {
      return (e.typed && !this.requirement.test(e.value) && B(this, `format`, e, t), e);
    },
  };
}
function Ye(e) {
  return {
    kind: `validation`,
    type: `safe_integer`,
    reference: Ye,
    async: !1,
    expects: null,
    requirement: Number.isSafeInteger,
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement(e.value) && B(this, `safe integer`, e, t), e);
    },
  };
}
function Xe() {
  return {
    kind: `transformation`,
    type: `to_lower_case`,
    reference: Xe,
    async: !1,
    "~run"(e) {
      return ((e.value = e.value.toLowerCase()), e);
    },
  };
}
function Ze(e) {
  return {
    kind: `transformation`,
    type: `transform`,
    reference: Ze,
    async: !1,
    operation: e,
    "~run"(e) {
      return ((e.value = this.operation(e.value)), e);
    },
  };
}
function Qe() {
  return {
    kind: `transformation`,
    type: `trim`,
    reference: Qe,
    async: !1,
    "~run"(e) {
      return ((e.value = e.value.trim()), e);
    },
  };
}
function $e(e) {
  return {
    kind: `validation`,
    type: `url`,
    reference: $e,
    async: !1,
    expects: null,
    requirement(e) {
      try {
        return (new URL(e), !0);
      } catch {
        return !1;
      }
    },
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement(e.value) && B(this, `URL`, e, t), e);
    },
  };
}
function G(e) {
  return {
    kind: `validation`,
    type: `uuid`,
    reference: G,
    async: !1,
    expects: null,
    requirement: H,
    message: e,
    "~run"(e, t) {
      return (e.typed && !this.requirement.test(e.value) && B(this, `UUID`, e, t), e);
    },
  };
}
function et(e, t, n) {
  return typeof e.fallback == `function` ? e.fallback(t, n) : e.fallback;
}
function tt(e) {
  let t = {};
  for (let n of e)
    if (n.path) {
      let e = Ne(n);
      e
        ? ((t.nested ||= {}),
          t.nested[e] ? t.nested[e].push(n.message) : (t.nested[e] = [n.message]))
        : t.other
          ? t.other.push(n.message)
          : (t.other = [n.message]);
    } else t.root ? t.root.push(n.message) : (t.root = [n.message]);
  return t;
}
function nt(e, t) {
  return {
    ...e,
    "~run"(n, r) {
      let i = n.issues && [...n.issues];
      if (((n = e[`~run`](n, r)), n.issues)) {
        for (let e of n.issues)
          if (!i?.includes(e)) {
            let r = n.value;
            for (let n of t) {
              let t = r[n],
                i = { type: `unknown`, origin: `value`, input: r, key: n, value: t };
              if ((e.path ? e.path.push(i) : (e.path = [i]), !t)) break;
              r = t;
            }
          }
      }
      return n;
    },
  };
}
function K(e, t, n) {
  return typeof e.default == `function` ? e.default(t, n) : e.default;
}
function rt(e, t) {
  return !e[`~run`]({ value: t }, { abortEarly: !0 }).issues;
}
function it(e, t) {
  return {
    kind: `schema`,
    type: `array`,
    reference: it,
    expects: `Array`,
    async: !1,
    item: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n = e.value;
      if (Array.isArray(n)) {
        ((e.typed = !0), (e.value = []));
        for (let r = 0; r < n.length; r++) {
          let i = n[r],
            a = this.item[`~run`]({ value: i }, t);
          if (a.issues) {
            let o = { type: `array`, origin: `value`, input: n, key: r, value: i };
            for (let t of a.issues)
              (t.path ? t.path.unshift(o) : (t.path = [o]), e.issues?.push(t));
            if (((e.issues ||= a.issues), t.abortEarly)) {
              e.typed = !1;
              break;
            }
          }
          (a.typed || (e.typed = !1), e.value.push(a.value));
        }
      } else B(this, `type`, e, t);
      return e;
    },
  };
}
function at(e) {
  return {
    kind: `schema`,
    type: `boolean`,
    reference: at,
    expects: `boolean`,
    async: !1,
    message: e,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return (typeof e.value == `boolean` ? (e.typed = !0) : B(this, `type`, e, t), e);
    },
  };
}
function q(e) {
  return {
    kind: `schema`,
    type: `lazy`,
    reference: q,
    expects: `unknown`,
    async: !1,
    getter: e,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return this.getter(e.value)[`~run`](e, t);
    },
  };
}
function J(e, t) {
  return {
    kind: `schema`,
    type: `literal`,
    reference: J,
    expects: Ae(e),
    async: !1,
    literal: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return (e.value === this.literal ? (e.typed = !0) : B(this, `type`, e, t), e);
    },
  };
}
function ot(e, t) {
  return {
    kind: `schema`,
    type: `loose_object`,
    reference: ot,
    expects: `Object`,
    async: !1,
    entries: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n = e.value;
      if (n && typeof n == `object`) {
        ((e.typed = !0), (e.value = {}));
        for (let r in this.entries) {
          let i = this.entries[r];
          if (
            r in n ||
            ((i.type === `exact_optional` || i.type === `optional` || i.type === `nullish`) &&
              i.default !== void 0)
          ) {
            let a = r in n ? n[r] : K(i),
              o = i[`~run`]({ value: a }, t);
            if (o.issues) {
              let i = { type: `object`, origin: `value`, input: n, key: r, value: a };
              for (let t of o.issues)
                (t.path ? t.path.unshift(i) : (t.path = [i]), e.issues?.push(t));
              if (((e.issues ||= o.issues), t.abortEarly)) {
                e.typed = !1;
                break;
              }
            }
            (o.typed || (e.typed = !1), (e.value[r] = o.value));
          } else if (i.fallback !== void 0) e.value[r] = et(i);
          else if (
            i.type !== `exact_optional` &&
            i.type !== `optional` &&
            i.type !== `nullish` &&
            (B(this, `key`, e, t, {
              input: void 0,
              expected: `"${r}"`,
              path: [{ type: `object`, origin: `key`, input: n, key: r, value: n[r] }],
            }),
            t.abortEarly)
          )
            break;
        }
        if (!e.issues || !t.abortEarly)
          for (let t in n) je(n, t) && !(t in this.entries) && (e.value[t] = n[t]);
      } else B(this, `type`, e, t);
      return e;
    },
  };
}
function Y(e) {
  return {
    kind: `schema`,
    type: `null`,
    reference: Y,
    expects: `null`,
    async: !1,
    message: e,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return (e.value === null ? (e.typed = !0) : B(this, `type`, e, t), e);
    },
  };
}
function st(e, t) {
  return {
    kind: `schema`,
    type: `nullable`,
    reference: st,
    expects: `(${e.expects} | null)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return e.value === null &&
        (this.default !== void 0 && (e.value = K(this, e, t)), e.value === null)
        ? ((e.typed = !0), e)
        : this.wrapped[`~run`](e, t);
    },
  };
}
function ct(e) {
  return {
    kind: `schema`,
    type: `number`,
    reference: ct,
    expects: `number`,
    async: !1,
    message: e,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return (
        typeof e.value == `number` && !isNaN(e.value) ? (e.typed = !0) : B(this, `type`, e, t), e
      );
    },
  };
}
function X(e, t) {
  return {
    kind: `schema`,
    type: `object`,
    reference: X,
    expects: `Object`,
    async: !1,
    entries: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n = e.value;
      if (n && typeof n == `object`) {
        ((e.typed = !0), (e.value = {}));
        for (let r in this.entries) {
          let i = this.entries[r];
          if (
            r in n ||
            ((i.type === `exact_optional` || i.type === `optional` || i.type === `nullish`) &&
              i.default !== void 0)
          ) {
            let a = r in n ? n[r] : K(i),
              o = i[`~run`]({ value: a }, t);
            if (o.issues) {
              let i = { type: `object`, origin: `value`, input: n, key: r, value: a };
              for (let t of o.issues)
                (t.path ? t.path.unshift(i) : (t.path = [i]), e.issues?.push(t));
              if (((e.issues ||= o.issues), t.abortEarly)) {
                e.typed = !1;
                break;
              }
            }
            (o.typed || (e.typed = !1), (e.value[r] = o.value));
          } else if (i.fallback !== void 0) e.value[r] = et(i);
          else if (
            i.type !== `exact_optional` &&
            i.type !== `optional` &&
            i.type !== `nullish` &&
            (B(this, `key`, e, t, {
              input: void 0,
              expected: `"${r}"`,
              path: [{ type: `object`, origin: `key`, input: n, key: r, value: n[r] }],
            }),
            t.abortEarly)
          )
            break;
        }
      } else B(this, `type`, e, t);
      return e;
    },
  };
}
function lt(e, t) {
  return {
    kind: `schema`,
    type: `optional`,
    reference: lt,
    expects: `(${e.expects} | undefined)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return e.value === void 0 &&
        (this.default !== void 0 && (e.value = K(this, e, t)), e.value === void 0)
        ? ((e.typed = !0), e)
        : this.wrapped[`~run`](e, t);
    },
  };
}
function ut(e, t) {
  return {
    kind: `schema`,
    type: `picklist`,
    reference: ut,
    expects: Me(e.map(Ae), `|`),
    async: !1,
    options: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return (this.options.includes(e.value) ? (e.typed = !0) : B(this, `type`, e, t), e);
    },
  };
}
function dt(e, t, n) {
  return {
    kind: `schema`,
    type: `record`,
    reference: dt,
    expects: `Object`,
    async: !1,
    key: e,
    value: t,
    message: n,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n = e.value;
      if (n && typeof n == `object`) {
        ((e.typed = !0), (e.value = {}));
        for (let r in n)
          if (je(n, r)) {
            let i = n[r],
              a = this.key[`~run`]({ value: r }, t);
            if (a.issues) {
              let o = { type: `object`, origin: `key`, input: n, key: r, value: i };
              for (let t of a.issues) ((t.path = [o]), e.issues?.push(t));
              if (((e.issues ||= a.issues), t.abortEarly)) {
                e.typed = !1;
                break;
              }
            }
            let o = this.value[`~run`]({ value: i }, t);
            if (o.issues) {
              let a = { type: `object`, origin: `value`, input: n, key: r, value: i };
              for (let t of o.issues)
                (t.path ? t.path.unshift(a) : (t.path = [a]), e.issues?.push(t));
              if (((e.issues ||= o.issues), t.abortEarly)) {
                e.typed = !1;
                break;
              }
            }
            ((!a.typed || !o.typed) && (e.typed = !1), a.typed && (e.value[a.value] = o.value));
          }
      } else B(this, `type`, e, t);
      return e;
    },
  };
}
function ft(e, t) {
  return {
    kind: `schema`,
    type: `strict_object`,
    reference: ft,
    expects: `Object`,
    async: !1,
    entries: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n = e.value;
      if (n && typeof n == `object`) {
        ((e.typed = !0), (e.value = {}));
        for (let r in this.entries) {
          let i = this.entries[r];
          if (
            r in n ||
            ((i.type === `exact_optional` || i.type === `optional` || i.type === `nullish`) &&
              i.default !== void 0)
          ) {
            let a = r in n ? n[r] : K(i),
              o = i[`~run`]({ value: a }, t);
            if (o.issues) {
              let i = { type: `object`, origin: `value`, input: n, key: r, value: a };
              for (let t of o.issues)
                (t.path ? t.path.unshift(i) : (t.path = [i]), e.issues?.push(t));
              if (((e.issues ||= o.issues), t.abortEarly)) {
                e.typed = !1;
                break;
              }
            }
            (o.typed || (e.typed = !1), (e.value[r] = o.value));
          } else if (i.fallback !== void 0) e.value[r] = et(i);
          else if (
            i.type !== `exact_optional` &&
            i.type !== `optional` &&
            i.type !== `nullish` &&
            (B(this, `key`, e, t, {
              input: void 0,
              expected: `"${r}"`,
              path: [{ type: `object`, origin: `key`, input: n, key: r, value: n[r] }],
            }),
            t.abortEarly)
          )
            break;
        }
        if (!e.issues || !t.abortEarly) {
          for (let r in n)
            if (!(r in this.entries)) {
              B(this, `key`, e, t, {
                input: r,
                expected: `never`,
                path: [{ type: `object`, origin: `key`, input: n, key: r, value: n[r] }],
              });
              break;
            }
        }
      } else B(this, `type`, e, t);
      return e;
    },
  };
}
function Z(e) {
  return {
    kind: `schema`,
    type: `string`,
    reference: Z,
    expects: `string`,
    async: !1,
    message: e,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      return (typeof e.value == `string` ? (e.typed = !0) : B(this, `type`, e, t), e);
    },
  };
}
function pt(e) {
  let t;
  if (e) for (let n of e) t ? t.push(...n.issues) : (t = n.issues);
  return t;
}
function mt(e, t) {
  return {
    kind: `schema`,
    type: `union`,
    reference: mt,
    expects: Me(
      e.map((e) => e.expects),
      `|`,
    ),
    async: !1,
    options: e,
    message: t,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n, r, i;
      for (let a of this.options) {
        let o = a[`~run`]({ value: e.value }, t);
        if (o.typed) {
          if (o.issues) r ? r.push(o) : (r = [o]);
          else {
            n = o;
            break;
          }
        } else i ? i.push(o) : (i = [o]);
      }
      if (n) return n;
      if (r) {
        if (r.length === 1) return r[0];
        (B(this, `type`, e, t, { issues: pt(r) }), (e.typed = !0));
      } else if (i?.length === 1) return i[0];
      else B(this, `type`, e, t, { issues: pt(i) });
      return e;
    },
  };
}
function ht(e, t, n) {
  return {
    kind: `schema`,
    type: `variant`,
    reference: ht,
    expects: `Object`,
    async: !1,
    key: e,
    options: t,
    message: n,
    get "~standard"() {
      return V(this);
    },
    "~run"(e, t) {
      let n = e.value;
      if (n && typeof n == `object`) {
        let r,
          i = 0,
          a = this.key,
          o = [],
          s = (e, c) => {
            for (let l of e.options) {
              if (l.type === `variant`) s(l, new Set(c).add(l.key));
              else {
                let e = !0,
                  s = 0;
                for (let t of c) {
                  let r = l.entries[t];
                  if (
                    t in n
                      ? r[`~run`]({ typed: !1, value: n[t] }, { abortEarly: !0 }).issues
                      : r.type !== `exact_optional` && r.type !== `optional` && r.type !== `nullish`
                  ) {
                    ((e = !1),
                      a !== t &&
                        (i < s || (i === s && t in n && !(a in n))) &&
                        ((i = s), (a = t), (o = [])),
                      a === t && o.push(l.entries[t].expects));
                    break;
                  }
                  s++;
                }
                if (e) {
                  let e = l[`~run`]({ value: n }, t);
                  (!r || (!r.typed && e.typed)) && (r = e);
                }
              }
              if (r && !r.issues) break;
            }
          };
        if ((s(this, new Set([this.key])), r)) return r;
        B(this, `type`, e, t, {
          input: n[a],
          expected: Me(o, `|`),
          path: [{ type: `object`, origin: `value`, input: n, key: a, value: n[a] }],
        });
      } else B(this, `type`, e, t);
      return e;
    },
  };
}
function gt(e, t) {
  let n = { ...e.entries };
  for (let e of t) delete n[e];
  return {
    ...e,
    entries: n,
    get "~standard"() {
      return V(this);
    },
  };
}
function _t(e, t, n) {
  let r = e[`~run`]({ value: t }, Ee(n));
  if (r.issues) throw new Pe(r.issues);
  return r.value;
}
function vt(e, t) {
  let n = {};
  for (let r in e.entries) n[r] = !t || t.includes(r) ? lt(e.entries[r]) : e.entries[r];
  return {
    ...e,
    entries: n,
    get "~standard"() {
      return V(this);
    },
  };
}
function yt(...e) {
  return {
    ...e[0],
    pipe: e,
    get "~standard"() {
      return V(this);
    },
    "~run"(t, n) {
      for (let r of e)
        if (r.kind !== `metadata`) {
          if (t.issues && (r.kind === `schema` || r.kind === `transformation`)) {
            t.typed = !1;
            break;
          }
          (!t.issues || (!n.abortEarly && !n.abortPipeEarly)) && (t = r[`~run`](t, n));
        }
      return t;
    },
  };
}
function bt(e, t, n) {
  let r = e[`~run`]({ value: t }, Ee(n));
  return { typed: r.typed, success: !r.issues, output: r.value, issues: r.issues };
}
var xt = o((e) => {
    var t = u();
    function n(e, t) {
      return (e === t && (e !== 0 || 1 / e == 1 / t)) || (e !== e && t !== t);
    }
    var r = typeof Object.is == `function` ? Object.is : n,
      i = t.useState,
      a = t.useEffect,
      o = t.useLayoutEffect,
      s = t.useDebugValue;
    function c(e, t) {
      var n = t(),
        r = i({ inst: { value: n, getSnapshot: t } }),
        c = r[0].inst,
        u = r[1];
      return (
        o(
          function () {
            ((c.value = n), (c.getSnapshot = t), l(c) && u({ inst: c }));
          },
          [e, n, t],
        ),
        a(
          function () {
            return (
              l(c) && u({ inst: c }),
              e(function () {
                l(c) && u({ inst: c });
              })
            );
          },
          [e],
        ),
        s(n),
        n
      );
    }
    function l(e) {
      var t = e.getSnapshot;
      e = e.value;
      try {
        var n = t();
        return !r(e, n);
      } catch {
        return !0;
      }
    }
    function d(e, t) {
      return t();
    }
    var f =
      typeof window > `u` || window.document === void 0 || window.document.createElement === void 0
        ? d
        : c;
    e.useSyncExternalStore = t.useSyncExternalStore === void 0 ? f : t.useSyncExternalStore;
  }),
  St = o((e, t) => {
    t.exports = xt();
  }),
  Ct = o((e) => {
    var t = u(),
      n = St();
    function r(e, t) {
      return (e === t && (e !== 0 || 1 / e == 1 / t)) || (e !== e && t !== t);
    }
    var i = typeof Object.is == `function` ? Object.is : r,
      a = n.useSyncExternalStore,
      o = t.useRef,
      s = t.useEffect,
      c = t.useMemo,
      l = t.useDebugValue;
    e.useSyncExternalStoreWithSelector = function (e, t, n, r, u) {
      var d = o(null);
      if (d.current === null) {
        var f = { hasValue: !1, value: null };
        d.current = f;
      } else f = d.current;
      d = c(
        function () {
          function e(e) {
            if (!a) {
              if (((a = !0), (o = e), (e = r(e)), u !== void 0 && f.hasValue)) {
                var t = f.value;
                if (u(t, e)) return (s = t);
              }
              return (s = e);
            }
            if (((t = s), i(o, e))) return t;
            var n = r(e);
            return u !== void 0 && u(t, n) ? ((o = e), t) : ((o = e), (s = n));
          }
          var a = !1,
            o,
            s,
            c = n === void 0 ? null : n;
          return [
            function () {
              return e(t());
            },
            c === null
              ? void 0
              : function () {
                  return e(c());
                },
          ];
        },
        [t, n, r, u],
      );
      var p = a(e, d[0], d[1]);
      return (
        s(
          function () {
            ((f.hasValue = !0), (f.value = p));
          },
          [p],
        ),
        l(p),
        p
      );
    };
  }),
  wt = o((e, t) => {
    t.exports = Ct();
  })();
function Tt(e, t) {
  return e === t;
}
function Et(e, t = (e) => e, n) {
  let r = n?.compare ?? Tt,
    i = (0, h.useCallback)(
      (t) => {
        let { unsubscribe: n } = e.subscribe(t);
        return n;
      },
      [e],
    ),
    a = (0, h.useCallback)(() => e.get(), [e]);
  return (0, wt.useSyncExternalStoreWithSelector)(i, a, a, t, r);
}
var Dt = o((e) => {
    var t = u().__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    e.c = function (e) {
      return t.H.useMemoCache(e);
    };
  }),
  Ot = o((e, t) => {
    t.exports = Dt();
  }),
  kt = Ot(),
  At = 48,
  Q = (e, t = 0) => {
    let n = new Int32Array(e.length);
    for (let r = 0; r < e.length; r++) n[r] = e.charCodeAt(r) - At - t;
    return n;
  },
  jt = (e) => {
    let t = new Int32Array(e.length + 1);
    for (let n = 0; n < e.length; n++) t[n + 1] = t[n] + e[n];
    return t;
  },
  Mt = (e) => {
    let t = new Int32Array(e.length),
      n = 0;
    for (let r = 0; r < e.length; r++) {
      let i = e.charCodeAt(r) - At;
      ((n += (i >>> 1) ^ -(i & 1)), (t[r] = n));
    }
    return t;
  },
  Nt = 384,
  Pt = [],
  Ft = jt(
    Q(
      `E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010`,
    ),
  ),
  It = jt(
    Q(
      `:11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3`,
    ),
  ),
  Lt = `@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom`,
  Rt = (() => {
    let e = Ft.length - 1,
      t = new Int32Array(e);
    for (let n = e - 1; n >= 0; n--) {
      let e = 1,
        r = n + 1;
      for (let i = Ft[n]; i < Ft[n + 1]; i++) ((e += t[r]), (r += t[r]));
      t[n] = e;
    }
    let n = new Int32Array(Ft[e]),
      r = 0;
    for (let i = 0; i < e; i++) {
      let e = i + 1;
      for (let a = Ft[i]; a < Ft[i + 1]; a++) ((n[r++] = e), (e += t[e]));
    }
    return n;
  })(),
  zt = Q(
    `02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000`,
    1,
  ),
  Bt = jt(Q(`123333359346463635126536711576`)),
  Vt = Q(
    `93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032`,
  ),
  Ht = Q(
    `012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199`,
  ),
  Ut = Mt(
    `020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200`,
  ),
  Wt = (() => {
    let e = new Int32Array(319).fill(-1),
      t = Mt(
        `02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222`,
      ),
      n = Mt(
        `02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222`,
      );
    for (let r = 0; r < t.length; r++) e[t[r]] = n[r];
    return e;
  })(),
  Gt =
    `container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover| gradient-to-b gradient-to-bl gradient-to-br gradient-to-l gradient-to-r gradient-to-t gradient-to-tl gradient-to-tr none|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform`
      .split(`|`)
      .map((e) => {
        let t = e.split(` `),
          n = t.shift();
        for (let e = 0; e < t.length; e++) t[e] = n + t[e];
        return t;
      }),
  Kt = Mt(
    `0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422`,
  ),
  qt = Mt(
    `ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>ʶ22ʷʺʷ2ʸʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622`,
  ),
  Jt = Mt(
    `02222222222222222222222222222222222222222222222222222222222222222202022222222222EH2200IL021042222Y\\222IL0cf2e10j2222U00X202[^2y0000120|{~22:22|22222222222G000qOVI00000}2>40000B00000I¨©000¬00000000000000021M®­00°000000000000000000000222HGHa1º222¿2À2222ÉÌ000­°2±`,
  ),
  Yt = new Int32Array(995),
  Xt = new Int32Array(995),
  Zt = new Int32Array(995),
  Qt = ``,
  $t = new Int32Array(1038);
{
  let e = new Map(),
    t = 0,
    n = 0;
  for (let r = 0; r < Kt.length; r++)
    for (let i of Gt[Jt[r]]) {
      let a = e.get(i);
      (a === void 0 &&
        ((a = t++), e.set(i, a), ($t[a * 2] = Qt.length), ($t[a * 2 + 1] = i.length), (Qt += i)),
        (Yt[n] = Kt[r]),
        (Xt[n] = qt[r]),
        (Zt[n] = a),
        n++);
    }
}
var en = Mt(`0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p`),
  tn = jt(Q(`1::24444432:442:44:44>222222:44:4421322511111311111114`)),
  nn = Mt(
    `24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222`,
  ),
  rn = Q(`ĳ`),
  an = Q(``),
  on = Q(`1`),
  sn = {
    GROUP_COUNT: Nt,
    customValidatorNames: Pt,
    edgeStart: Ft,
    labelStart: It,
    labelText: Lt,
    edgeTarget: Rt,
    nodeGroup: zt,
    nodeVlist: Wt,
    vlistPat: Bt,
    vlistOps: Vt,
    vlistRef: Ht,
    vlistGroup: Ut,
    litAnchor: Yt,
    litGroup: Xt,
    litPool: Zt,
    poolOffsets: $t,
    poolText: Qt,
    adjGid: en,
    adjStart: tn,
    adjTgt: nn,
    patGid: rn,
    patTgt: an,
    postfixLookupGroups: on,
    orderSensitiveModifiers: `* ** after backdrop before details-content file first-letter first-line marker placeholder selection`,
  },
  cn = `line` in Error(),
  ln = -1,
  un = -1,
  dn = (e, t, n) => {
    let r = 2166136261;
    for (let i = t; i < n; i++) r = Math.imul(r ^ e.charCodeAt(i), 16777619);
    return r;
  },
  fn = (e, t, n) => {
    let r = n - t,
      i = Math.imul(r, 2654435761) ^ e.charCodeAt(t);
    if (r > 3) {
      let a = r >> 2,
        o = r >> 1;
      ((i = Math.imul(
        i ^ (e.charCodeAt(t + 1) << 8) ^ (e.charCodeAt(t + 2) << 16) ^ e.charCodeAt(t + a),
        2246822507,
      )),
        (i = Math.imul(
          i ^ (e.charCodeAt(t + o) << 8) ^ (e.charCodeAt(t + o + a) << 16) ^ e.charCodeAt(n - 3),
          3266489909,
        )),
        (i ^= (e.charCodeAt(n - 2) << 8) ^ (e.charCodeAt(n - 1) << 16)));
      for (let r = t + 3, a = n - 4; r < t + 8 && r < a; r++, a--)
        i = Math.imul(i ^ e.charCodeAt(r) ^ (e.charCodeAt(a) << 8), 16777619);
    }
    return (i ^ (i >>> 15)) | 0;
  },
  pn = (e, t, n = {}) => {
    let {
        GROUP_COUNT: r,
        edgeStart: i,
        labelStart: a,
        labelText: o,
        edgeTarget: s,
        nodeGroup: c,
        nodeVlist: l,
        vlistPat: u,
        vlistOps: d,
        vlistRef: f,
        vlistGroup: p,
        litAnchor: m,
        litGroup: h,
        litPool: g,
        poolOffsets: _,
        poolText: v,
        adjGid: y,
        adjStart: b,
        adjTgt: x,
        patGid: S,
        patTgt: C,
        postfixLookupGroups: w,
        customValidatorNames: T,
        orderSensitiveModifiers: E,
      } = e,
      D = new Int32Array(r).fill(-1);
    for (let e = 0; e < y.length; e++) D[y[e]] = e;
    let O = 0;
    for (let e = 0; e + 1 < b.length; e++) {
      let t = b[e + 1] - b[e];
      t > O && (O = t);
    }
    let k = 32;
    for (; k < 2 * (1 + O + S.length);) k <<= 1;
    let A = new Int32Array(f.length + 1);
    for (let e = 0; e < f.length; e++) A[e + 1] = A[e] + u[f[e] + 1] - u[f[e]];
    let ee = new Uint8Array(r);
    for (let e = 0; e < w.length; e++) ee[w[e]] = 1;
    let j = i.length - 1,
      M = new Uint8Array(j),
      N = 0,
      P = !0;
    for (let e = 0; e < m.length; e++) {
      M[m[e]] = 1;
      let t = _[g[e] * 2 + 1];
      t > N && (N = t);
      let n = v.charCodeAt(_[g[e] * 2]);
      (n === 91 || n === 40) && (P = !1);
    }
    let F = 1;
    for (; F < m.length * 2;) F <<= 1;
    let te = new Int32Array(F).fill(-1);
    for (let e = 0; e < m.length; e++) {
      let t = _[g[e] * 2],
        n = ((dn(v, t, t + _[g[e] * 2 + 1]) ^ Math.imul(m[e], 2654435761)) | 0) & (F - 1);
      for (; te[n] !== -1;) n = (n + 1) & (F - 1);
      te[n] = e;
    }
    let I = (e, t, n, r) => {
        let i = ((dn(t, n, r) ^ Math.imul(e, 2654435761)) | 0) & (F - 1),
          a = r - n;
        for (;;) {
          let r = te[i];
          if (r === -1) return -1;
          if (m[r] === e && _[g[r] * 2 + 1] === a) {
            let e = _[g[r] * 2],
              i = !0;
            for (let r = 0; r < a; r++)
              if (v.charCodeAt(e + r) !== t.charCodeAt(n + r)) {
                i = !1;
                break;
              }
            if (i) return h[r];
          }
          i = (i + 1) & (F - 1);
        }
      },
      L = n.cacheSize ?? 8192,
      ne = n.prefix ?? e.prefix ?? ``,
      re = ne === `` ? `` : ne + `:`,
      ie = re.length,
      ae = (T ?? []).map((e) => {
        let n = t && t[e];
        if (!n) throw Error(`cn: missing validator ` + e);
        return n;
      }),
      R =
        /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
      oe = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,
      se = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
      ce =
        /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
      le = 0,
      ue = -1,
      de = -1,
      z = -1,
      fe = -1,
      pe = (e) => (e >= 97 && e <= 122) || (e >= 65 && e <= 90) || (e >= 48 && e <= 57) || e === 95,
      me = (e) => /\s/.test(String.fromCharCode(e)),
      he = (e, t, n) => {
        if (((le = 0), (ue = -1), n - t < 3)) return;
        let r = e.charCodeAt(t),
          i = e.charCodeAt(n - 1);
        if (r === 91 && i === 93) le = 1;
        else if (r === 40 && i === 41) le = 2;
        else return;
        ((z = t + 1), (fe = n - 1));
        let a = t + 1;
        if (pe(e.charCodeAt(a))) {
          for (a++; a < n - 1;) {
            let t = e.charCodeAt(a);
            if (!pe(t) && t !== 45) break;
            a++;
          }
          a < n - 2 && e.charCodeAt(a) === 58 && ((ue = t + 1), (de = a), (z = a + 1));
        }
      },
      ge = (e, t, n, r) => {
        if (n - t !== r.length) return !1;
        for (let n = 0; n < r.length; n++) if (e.charCodeAt(t + n) !== r.charCodeAt(n)) return !1;
        return !0;
      },
      _e = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/,
      ve = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
      ye = (e) => !!e && !Number.isNaN(Number(e)),
      be = (e, t, n) => {
        if (n - t < 11 || !ge(e, t, t + 10, `@container`)) return !1;
        if (e.charCodeAt(t + 10) === 47) return n - t >= 12;
        let r = e.charCodeAt(t + 11);
        return (
          (r === 115 && n - t >= 17 && ge(e, t + 10, t + 16, `-size/`)) ||
          (r === 110 && n - t >= 19 && ge(e, t + 10, t + 18, `-normal/`))
        );
      },
      xe = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      Se =
        `length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight`
          .split(`|`)
          .map((e) => e.split(` `)),
      Ce = [2, 3, 1, 0, 0, 0, 4, 5, 0, 0, 0, 0, 0, 1, 1],
      we = (e, t, n, r) => {
        if (e >= 10) {
          if (e >= 25) return ae[e - 25](t.slice(n, r));
          let i = e - 10;
          if (le !== xe[i]) return !1;
          if (ue >= 0) {
            for (let e of Se[i]) if (ge(t, ue, de, e)) return !0;
            return !1;
          }
          switch (Ce[i]) {
            case 0:
              return !1;
            case 1:
              return !0;
            case 2: {
              let e = t.slice(z, fe);
              return R.test(e) && !oe.test(e);
            }
            case 3:
              return ye(t.slice(z, fe));
            case 4:
              return ce.test(t.slice(z, fe));
            default:
              return se.test(t.slice(z, fe));
          }
        }
        switch (e) {
          case 0:
            return !0;
          case 1:
            return le === 0;
          case 2:
            return le === 1;
          case 3:
            return le === 2;
          case 4:
            return _e.test(t.slice(n, r));
          case 5:
            return ye(t.slice(n, r));
          case 6: {
            let e = t.slice(n, r);
            return !!e && Number.isInteger(Number(e));
          }
          case 7:
            return r > n && t.charCodeAt(r - 1) === 37 && ye(t.slice(n, r - 1));
          case 8:
            return ve.test(t.slice(n, r));
          default:
            return be(t, n, r);
        }
      },
      Te = new Set(typeof E == `string` ? E.split(` `) : E),
      Ee = (e, t, n, r, i, a) => {
        let o = (dn(t, n, r) ^ (i ? 2654435769 : 0)) | 0,
          s = e.get(o);
        if (s !== void 0)
          outer: for (let e = 0; e < s.length; e++) {
            let a = s[e];
            if (a.imp === i && a.k.length === r - n) {
              for (let e = 0; e < a.k.length; e++)
                if (a.k.charCodeAt(e) !== t.charCodeAt(n + e)) continue outer;
              return a.id;
            }
          }
        else e.set(o, (s = []));
        let c = t.slice(n, r),
          l = a(c);
        return (s.push({ k: c, imp: i, id: l }), l);
      },
      De = new Map(),
      Oe = new Map(),
      ke = 2,
      Ae = 4096,
      B = (e, t) => {
        let n = [],
          r = 0,
          i = 0,
          a = 0;
        for (let t = 0; t < e.length; t++) {
          let o = e.charCodeAt(t);
          r === 0 && i === 0 && o === 58
            ? (n.push(e.slice(a, t)), (a = t + 1))
            : o === 91
              ? r++
              : o === 93
                ? r--
                : o === 40
                  ? i++
                  : o === 41 && i--;
        }
        n.push(e.slice(a));
        let o = n[0];
        if (n.length > 1) {
          let e = [],
            t = [];
          for (let r of n)
            r.charCodeAt(0) === 91 || Te.has(r)
              ? (t.length && (e.push(...t.sort()), (t = [])), e.push(r))
              : t.push(r);
          (t.length && e.push(...t.sort()), (o = e.join(`:`)));
        }
        let s = t ? o + ` !` : o,
          c = Oe.get(s);
        return (c === void 0 && Oe.set(s, (c = ke++)), c);
      },
      V = new Map(),
      je = r,
      Me = r + 4096,
      Ne = () => je++,
      Pe = 2097152,
      Fe = 8192,
      Ie = new Int32Array(Fe),
      H = Array(Fe).fill(null),
      Le = new Int32Array(Fe),
      Re = new Int32Array(Fe),
      ze = new Uint8Array(Fe),
      Be = 0,
      Ve = (e, t, n, r, i, a, o, s) => {
        let c = e;
        if (H[e] !== null) {
          if (H[e | 1] === null) c = e | 1;
          else if (!(Be++ & 3)) c = e | ((Be >> 2) & 1);
          else return;
        }
        ((H[c] = t.slice(n, r)), (Ie[c] = i), (Le[c] = a), (Re[c] = o), (ze[c] = s));
      },
      He = () => H.fill(null),
      U = 256,
      Ue = [new Int32Array(U), new Int32Array(U), new Int32Array(U), new Int32Array(U)],
      [We, Ge, Ke, qe] = Ue,
      Je = new Uint8Array(U),
      W = new Uint8Array(U),
      Ye = () => {
        ((U *= 2),
          (Ue = Ue.map((e) => {
            let t = new Int32Array(U);
            return (t.set(e), t);
          })),
          ([We, Ge, Ke, qe] = Ue));
        let e = new Uint8Array(U);
        (e.set(Je), (Je = e), (W = new Uint8Array(U)));
      },
      Xe = 64,
      Ze = new Int32Array(Xe),
      Qe = new Int32Array(Xe),
      $e = new Int32Array(r),
      G = 2048,
      et = 21,
      tt = new Float64Array(G),
      nt = new Int32Array(G),
      K = 0,
      rt = (e, t) => {
        if (e === 0 && t < r) return $e[t] === K ? 1 : (($e[t] = K), 0);
        let n = e * 2097152 + t + 1,
          i = Math.imul(n, 2654435761) >>> et;
        for (; nt[i] === K;) {
          if (tt[i] === n) return 1;
          i = (i + 1) & (G - 1);
        }
        return ((tt[i] = n), (nt[i] = K), 0);
      },
      it = (e, t, n, r, i) => {
        if (n - t >= 2 && e.charCodeAt(t) === 91 && e.charCodeAt(n - 1) === 93) {
          let r = -1;
          for (let i = t + 1; i < n - 1; i++)
            if (e.charCodeAt(i) === 58) {
              r = i;
              break;
            }
          return r === -1 || r === t + 1 ? ln : Ee(V, e, t + 1, r, 0, Ne);
        }
        if (r >= 0 && c[r] >= 0) return c[r];
        for (let t = i - 1; t >= 0; t--) {
          let r = Qe[t];
          if (r > n) continue;
          let i = Ze[t],
            a = n - r;
          if (M[i] === 1 && a > 0 && a <= N) {
            let t = e.charCodeAt(r);
            if (P === !1 || (t !== 91 && t !== 40)) {
              let t = I(i, e, r, n);
              if (t >= 0) return t;
            }
          }
          let o = l[i];
          if (o < 0) continue;
          let s = f[o],
            c = u[s],
            m = u[s + 1];
          if (c === m) continue;
          he(e, r, n);
          let h = A[o] - c;
          for (let t = c; t < m; t++) if (we(d[t], e, r, n)) return p[h + t];
        }
        return ln;
      },
      at = (e) => {
        let t = e.length,
          n = 0,
          c = 0,
          u = !1;
        ((ke > Ae || De.size > Ae) && ((De = new Map()), (Oe = new Map()), (ke = 2), He()),
          je > Me && ((V = new Map()), (je = r), He()));
        let d = 0;
        for (; d < t;) {
          let f = e.charCodeAt(d);
          if (f === 32 || (f >= 9 && f <= 13) || (f >= 160 && me(f))) {
            (f !== 32 && (u = !0), d++);
            continue;
          }
          let p = d,
            m = 0;
          for (; d < t;) {
            if (((f = e.charCodeAt(d)), f <= 32)) {
              if (f === 32) break;
              if (f >= 9 && f <= 13) {
                u = !0;
                break;
              }
            } else if (f >= 160 && me(f)) {
              u = !0;
              break;
            }
            ((m = Math.imul(m ^ f, 16777619)), d++);
          }
          let h = d,
            g = h - p;
          n === U && Ye();
          let _ = n++;
          ((We[_] = p), (Ge[_] = h), (c += g), (m ^= Math.imul(g, 2654435761)));
          let v = (m ^ (m >>> 15)) | 0,
            y = v & 8190;
          {
            let t = -1;
            if (
              (Ie[y] === v && H[y] !== null && H[y].length === g
                ? (t = y)
                : Ie[y | 1] === v && H[y | 1] !== null && H[y | 1].length === g && (t = y | 1),
              t >= 0)
            ) {
              let n = H[t],
                r = !0;
              for (let t = 0; t < g; t++)
                if (n.charCodeAt(t) !== e.charCodeAt(p + t)) {
                  r = !1;
                  break;
                }
              if (r) {
                ((Ke[_] = Le[t]), (qe[_] = Re[t]), (Je[_] = ze[t]));
                continue;
              }
            }
          }
          let b = p;
          if (ie !== 0) {
            if (h - p <= ie || !e.startsWith(re, p)) {
              ((Ke[_] = ln), Ve(y, e, p, h, v, ln, 0, 0));
              continue;
            }
            b = p + ie;
          }
          let x = 0,
            S = 0,
            C = -1,
            w = -1;
          for (let t = b; t < h; t++) {
            let n = e.charCodeAt(t);
            if (x === 0 && S === 0) {
              if (n === 58) {
                C = t;
                continue;
              }
              if (n === 47) {
                w = t;
                continue;
              }
            }
            n === 91 ? x++ : n === 93 ? x-- : n === 40 ? S++ : n === 41 && S--;
          }
          let T = C >= b ? C + 1 : b,
            E = T,
            D = h,
            O = !1,
            k = 0;
          D > E && e.charCodeAt(D - 1) === 33
            ? ((O = !0), D--)
            : D > E && e.charCodeAt(E) === 33 && ((O = !0), E++, (k = 1));
          let A = -1;
          w > T && ((A = w + k), A >= D && (A = -1));
          let j = E;
          D - E > 1 && e.charCodeAt(E) === 45 && (j = E + 1);
          let N = 0,
            P = 0,
            F = 0,
            te = -1,
            I = 0;
          (l[0] >= 0 || M[0] === 1) && ((Ze[0] = 0), (Qe[0] = j), (I = 1));
          let L = un,
            ne = 0;
          for (let t = j; t < D; t++)
            if ((t === A && ((L = P < F ? un : N), (ne = I)), N !== un)) {
              let n = e.charCodeAt(t),
                r = -1;
              if (P < F) o.charCodeAt(P) === n ? (P++, P === F && (r = N = te)) : (N = un);
              else {
                let e = i[N],
                  t = i[N + 1],
                  c = un;
                for (let i = e; i < t; i++) {
                  let e = a[i];
                  if (o.charCodeAt(e) === n) {
                    a[i + 1] - e === 1
                      ? (r = c = s[i])
                      : ((P = e + 1), (F = a[i + 1]), (te = s[i]), (c = N));
                    break;
                  }
                }
                N = c;
              }
              if (r >= 0 && (l[r] >= 0 || M[r] === 1) && t + 1 < D && e.charCodeAt(t + 1) === 45) {
                if (I === Xe) {
                  Xe *= 2;
                  let e = new Int32Array(Xe);
                  (e.set(Ze), (Ze = e));
                  let t = new Int32Array(Xe);
                  (t.set(Qe), (Qe = t));
                }
                ((Ze[I] = r), (Qe[I] = t + 2), I++);
              }
            }
          A === D && ((L = P < F ? un : N), (ne = I));
          let ae = P < F ? un : N,
            R,
            oe = !1;
          if (A >= 0) {
            if (((oe = !0), (R = it(e, E, A, L, ne)), R !== ln && R < r && ee[R])) {
              let t = it(e, E, D, ae, I);
              t !== ln && t !== R && ((R = t), (oe = !1));
            } else R === ln && ((R = it(e, E, D, ae, I)), (oe = !1));
          } else R = it(e, E, D, ae, I);
          let se = 0,
            ce = 0;
          (R === ln
            ? (Ke[_] = ln)
            : ((ce = +!!oe),
              (se = b >= C ? +!!O : Ee(De, e, b, C, +!!O, (e) => B(e, O))),
              (Ke[_] = R),
              (Je[_] = ce),
              (qe[_] = se)),
            Ve(y, e, p, h, v, R, se, ce));
        }
        if (n === 0) return ``;
        if (n === 1) return We[0] === 0 && Ge[0] === t ? e : e.slice(We[0], Ge[0]);
        if (n * k > G) {
          for (; n * k > G;) ((G <<= 1), et--);
          ((tt = new Float64Array(G)), (nt = new Int32Array(G)));
        }
        if (ke >= Pe || je >= Pe) throw Error(`cn: too many distinct classes in one merge`);
        ((K = (K + 1) | 0), K === 0 && ($e.fill(0), nt.fill(0), (K = 1)));
        let f = !1;
        for (let e = n - 1; e >= 0; e--) {
          let t = Ke[e];
          if (t === ln) {
            W[e] = 1;
            continue;
          }
          let n = qe[e];
          if (rt(n, t) === 1) {
            ((W[e] = 0), (f = !0));
            continue;
          }
          if (((W[e] = 1), t < r)) {
            let r = D[t];
            if (r >= 0) for (let e = b[r]; e < b[r + 1]; e++) rt(n, x[e]);
            if (Je[e] & 1) for (let e = 0; e < S.length; e++) S[e] === t && rt(n, C[e]);
          }
        }
        if (!f && !u && t === c + n - 1) return e;
        let p = ``,
          m = 0;
        for (; m < n;) {
          if (!W[m]) {
            m++;
            continue;
          }
          let t = We[m],
            r = Ge[m],
            i = m + 1;
          for (; i < n && W[i] && We[i] === r + 1 && e.charCodeAt(r) === 32;) ((r = Ge[i]), i++);
          (p.length > 0 && (p += ` `), (p += e.slice(t, r)), (m = i));
        }
        return p;
      },
      q = 16384,
      J = new Int32Array(q * 2),
      ot = 0,
      Y = 1,
      st = Object.create(null),
      ct = Object.create(null),
      X = new Map(),
      lt = new Map(),
      ut = 0,
      dt = 0,
      ft = () => {
        ((ot ^= q), (Y = (Y + 1) | 0), (dt = 0));
      },
      Z = (e) => {
        let t = st[e];
        if (t !== void 0) return t;
        let n = fn(e, 0, e.length),
          r = (n & 16383) + ot,
          i = J[r] === (n ^ Y) || J[r ^ q] === (n ^ (Y - 1));
        return i && ((t = ct[e]), t !== void 0)
          ? ((st[e] = t), t)
          : ((t = at(e)),
            i
              ? ((st[e] = t), ++ut > L && ((ut = 0), (ct = st), (st = Object.create(null)), ft()))
              : ((J[r] = n ^ Y), ++dt > q && ft()),
            t);
      },
      pt = (e) => {
        let t = X.get(e);
        if (t !== void 0) return t;
        let n = fn(e, 0, e.length),
          r = (n & 16383) + ot,
          i = J[r] === (n ^ Y) || J[r ^ q] === (n ^ (Y - 1));
        return i && ((t = lt.get(e)), t !== void 0)
          ? (X.set(e, t), t)
          : ((t = at(e)),
            i
              ? (X.set(e, t), ++ut > L && ((ut = 0), (lt = X), (X = new Map()), ft()))
              : ((J[r] = n ^ Y), ++dt > q && ft()),
            t);
      },
      mt = (e) => {
        let t = fn(e, 0, e.length),
          n = (t & 16383) + ot;
        return (
          J[n] === (t ^ Y) || J[n ^ q] === (t ^ (Y - 1)) || ((J[n] = t ^ Y), ++dt > q && ft(), !1)
        );
      },
      ht =
        L === 0
          ? at
          : cn
            ? (e) => {
                let t = X.get(e);
                return t === void 0 ? pt(e) : t;
              }
            : Z;
    return {
      merge: function () {
        return arguments.length === 1 && typeof arguments[0] == `string`
          ? ht(arguments[0])
          : ht(gn.apply(null, arguments));
      },
      mergeString: ht,
      seenBefore: L === 0 ? () => !1 : mt,
      mergeUncached: at,
    };
  },
  mn = (e, t) => {
    if (!e) return ``;
    if (typeof e == `string`) return e;
    let n = ``;
    if (typeof e.length == `number` && (!t || Array.isArray(e))) {
      let r = e;
      for (let e = 0; e < r.length; e++) {
        let i = r[e];
        if (!i) continue;
        let a = typeof i == `string` ? i : mn(i, t);
        a && (n && (n += ` `), (n += a));
      }
      return n;
    }
    if (t) {
      if (typeof e == `number`) return `` + e;
      if (typeof e == `object`) for (let t in e) e[t] && (n && (n += ` `), (n += t));
    }
    return n;
  },
  hn = (e, t) => {
    let n = ``;
    for (let r = 0; r < e.length; r++) {
      let i = e[r];
      if (!i) continue;
      let a = typeof i == `string` ? i : mn(i, t);
      a && (n && (n += ` `), (n += a));
    }
    return n;
  },
  gn = function () {
    return hn(arguments, !1);
  },
  _n = 256,
  vn = 16,
  yn = 1024,
  bn = 4096,
  xn = (e, t) => {
    let n = t === void 0 ? () => !0 : t.seenBefore,
      r = t === void 0 ? e : t.mergeUncached,
      i = new Map(),
      a = new Map(),
      o = 0,
      s = null,
      c = null,
      l = [],
      u = [],
      d = 0,
      f = (t, n, r) => {
        c === null &&
          ((c = Array(bn).fill(``)), (l = Array(bn).fill(``)), (u = Array(bn).fill(``)));
        let i = fn(t, 0, t.length) & 4094;
        if (c[i] === t && l[i] === n) return u[i];
        if (c[i | 1] === t && l[i | 1] === n) return u[i | 1];
        let a = e(r ? n + ` ` + t : t),
          o = c[i] === `` ? i : i | (c[i | 1] === `` ? 1 : d++ & 1);
        return ((c[o] = t), (l[o] = n), (u[o] = a), a);
      },
      p = (e, t, n, r) => {
        let i = 0;
        if (t) {
          if (t !== e.a0) return !1;
          i = 1;
        }
        if (n) {
          if (n !== (i === 0 ? e.a0 : e.a1)) return !1;
          i++;
        }
        if (r) {
          if (r !== (i === 0 ? e.a0 : i === 1 ? e.a1 : e.a2)) return !1;
          i++;
        }
        return i === e.t;
      },
      m = (e, t) => {
        let n = e.a,
          r = 0;
        for (let e = 0; e < t.length; e++) {
          let i = t[e];
          if (i) {
            if (i !== n[r]) return !1;
            r++;
          }
        }
        return r === e.t;
      },
      h = (t, c) => {
        let l = t.length,
          u = s === null ? null : s.n;
        if (!c) {
          if (u !== null && m(u, t)) return ((s = u), u.r);
          if (s !== null && s !== u && m(s, t)) return s.r;
        }
        let d = ``,
          p = -1,
          h = 0,
          g = !1;
        for (let e = 0; e < l; e++) {
          let n = t[e];
          if (n) {
            if (typeof n != `string`) {
              if (((n = t[e] = mn(n, !0)), !n)) continue;
              g = !0;
            }
            (p < 0 && ((d = n), (p = e)), h++);
          }
        }
        if (h === 0) return ``;
        if (h === 1) return e(d);
        if (g) {
          if (u !== null && m(u, t)) return ((s = u), u.r);
          if (s !== null && s !== u && m(s, t)) return s.r;
        }
        let _ = i.get(d);
        _ === void 0 && ((_ = a.get(d)), _ !== void 0 && i.set(d, _));
        let v = null;
        if (_ !== void 0) {
          if (_.skip > 0) {
            (_.skip--, (s = null));
            let e = d;
            for (let n = p + 1; n < l; n++) {
              let r = t[n];
              r && (e += ` ` + r);
            }
            return f(e, ``, !1);
          }
          let e = _.e;
          outer: for (let n = 0; n < e.length; n++) {
            let r = e[n];
            if (r.t !== h) continue;
            let i = r.a,
              a = 1;
            for (let e = p + 1; e < l; e++) {
              let n = t[e];
              if (n && n !== i[a++]) continue outer;
            }
            v = r;
            break;
          }
          v !== null && (_.miss = 0);
        }
        if (v === null) {
          let s = d,
            c = [d];
          for (let e = p + 1; e < l; e++) {
            let n = t[e];
            n && ((s += ` ` + n), c.push(n));
          }
          if (!n(s)) return r(s);
          ((v = { r: e(s), t: c.length, a0: c[0], a1: c[1], a2: c[2] ?? ``, a: c, n: null }),
            _ === void 0
              ? i.set(d, (_ = { e: [], miss: 0, skip: 0, at: 0 }))
              : ++_.miss > vn && ((_.miss = vn), (_.skip = yn), (_.e.length = 0), (_.at = 0)));
          let u = _.e;
          (u.length < _n ? u.push(v) : ((u[_.at] = v), (_.at = (_.at + 1) & 255)),
            ++o > 1e3 && ((o = 0), (a = i), (i = new Map())));
        }
        return (s !== null && s !== v && (s.n = v), (s = v), v.r);
      },
      g = (t) => (Array.isArray(t) ? h(t.slice(), !1) : e(mn(t, !0)));
    return function (t, n, r) {
      let a = arguments.length;
      if ((a | 1) == 3) {
        let e = s;
        if (e !== null) {
          let i = e.n;
          if (i !== null && p(i, t, n, r)) return ((s = i), i.r);
          if (e !== i && p(e, t, n, r)) return e.r;
        }
        if (a === 2 && typeof n == `string` && n !== ``) {
          let e = i.get(t);
          if (e !== void 0 && e.skip > 0) return (e.skip--, (s = null), f(n, t, !0));
        }
        return h([t, n, r], !0);
      }
      if (a === 1) return typeof t == `string` ? e(t) : g(t);
      let o = s;
      if (o !== null) {
        let e = o.n;
        if (e !== null) {
          let t = e.a,
            n = 0,
            r = !0;
          for (let e = 0; e < a; e++) {
            let i = arguments[e];
            if (i) {
              if (i !== t[n]) {
                r = !1;
                break;
              }
              n++;
            }
          }
          if (r && n === e.t) return ((s = e), e.r);
        }
        if (o !== e) {
          let e = o.a,
            t = 0,
            n = !0;
          for (let r = 0; r < a; r++) {
            let i = arguments[r];
            if (i) {
              if (i !== e[t]) {
                n = !1;
                break;
              }
              t++;
            }
          }
          if (n && t === o.t) return o.r;
        }
      }
      let c = [];
      for (let e = 0; e < a; e++) c.push(arguments[e]);
      return h(c, !0);
    };
  },
  Sn = pn(sn),
  Cn = xn(Sn.mergeString, Sn);
Sn.merge;
function wn(e) {
  var t,
    n,
    r = ``;
  if (typeof e == `string` || typeof e == `number`) r += e;
  else if (typeof e == `object`) {
    if (Array.isArray(e)) {
      var i = e.length;
      for (t = 0; t < i; t++) e[t] && (n = wn(e[t])) && (r && (r += ` `), (r += n));
    } else for (n in e) e[n] && (r && (r += ` `), (r += n));
  }
  return r;
}
function Tn() {
  for (var e, t, n = 0, r = ``, i = arguments.length; n < i; n++)
    (e = arguments[n]) && (t = wn(e)) && (r && (r += ` `), (r += t));
  return r;
}
var En = (e) => (typeof e == `boolean` ? `${e}` : e === 0 ? `0` : e),
  Dn = Tn,
  On = (e, t) => (n) => {
    if (t?.variants == null) return Dn(e, n?.class, n?.className);
    let { variants: r, defaultVariants: i } = t,
      a = Object.keys(r).map((e) => {
        let t = n?.[e],
          a = i?.[e];
        if (t === null) return null;
        let o = En(t) || En(a);
        return r[e][o];
      }),
      o =
        n &&
        Object.entries(n).reduce((e, t) => {
          let [n, r] = t;
          return (r === void 0 || (e[n] = r), e);
        }, {});
    return Dn(
      e,
      a,
      t?.compoundVariants?.reduce((e, t) => {
        let { class: n, className: r, ...a } = t;
        return Object.entries(a).every((e) => {
          let [t, n] = e;
          return Array.isArray(n) ? n.includes({ ...i, ...o }[t]) : { ...i, ...o }[t] === n;
        })
          ? [...e, n, r]
          : e;
      }, []),
      n?.class,
      n?.className,
    );
  },
  kn = Object.defineProperty,
  An = (e, t) => kn(e, `name`, { value: t, configurable: !0 });
function jn(e, t) {
  if (typeof e == `function`) return e(t);
  e != null && (e.current = t);
}
An(jn, `setRef`);
function Mn(...e) {
  return (t) => {
    let n = !1,
      r = e.map((e) => {
        let r = jn(e, t);
        return (!n && typeof r == `function` && (n = !0), r);
      });
    if (n)
      return () => {
        for (let t = 0; t < r.length; t++) {
          let n = r[t];
          typeof n == `function` ? n() : jn(e[t], null);
        }
      };
  };
}
An(Mn, `composeRefs`);
function Nn(...e) {
  return h.useCallback(Mn(...e), e);
}
An(Nn, `useComposedRefs`);
var Pn = Object.defineProperty,
  $ = (e, t) => Pn(e, `name`, { value: t, configurable: !0 });
function Fn(e) {
  let t = h.forwardRef((t, n) => {
    let { children: r, ...i } = t,
      a = null,
      o = !1,
      s = [];
    (Wn(r) && typeof Yn == `function` && (r = Yn(r._payload)),
      h.Children.forEach(r, (e) => {
        if (Hn(e)) {
          o = !0;
          let t = e,
            n = `child` in t.props ? t.props.child : t.props.children;
          (Wn(n) && typeof Yn == `function` && (n = Yn(n._payload)),
            (a = zn(t, n)),
            s.push(a?.props?.children));
        } else s.push(e);
      }),
      a
        ? (a = h.cloneElement(a, void 0, s))
        : !o && h.Children.count(r) === 1 && h.isValidElement(r) && (a = r));
    let c = a ? Vn(a) : void 0,
      l = Nn(n, c);
    if (!a) {
      if (r || r === 0) throw Error(o ? Jn(e) : qn(e));
      return r;
    }
    let u = Bn(i, a.props ?? {});
    return (a.type !== h.Fragment && (u.ref = n ? l : c), h.cloneElement(a, u));
  });
  return ((t.displayName = `${e}.Slot`), t);
}
$(Fn, `createSlot`);
var In = Fn(`Slot`),
  Ln = Symbol.for(`radix.slottable`);
function Rn(e) {
  let t = $((e) => (`child` in e ? e.children(e.child) : e.children), `Slottable`);
  return ((t.displayName = `${e}.Slottable`), (t.__radixId = Ln), t);
}
$(Rn, `createSlottable`);
var zn = $((e, t) => {
  if (`child` in e.props) {
    let t = e.props.child;
    return h.isValidElement(t)
      ? h.cloneElement(t, void 0, e.props.children(t.props.children))
      : null;
  }
  return h.isValidElement(t) ? t : null;
}, `getSlottableElementFromSlottable`);
function Bn(e, t) {
  let n = { ...t };
  for (let r in t) {
    let i = e[r],
      a = t[r];
    /^on[A-Z]/.test(r)
      ? i && a
        ? (n[r] = (...e) => {
            let t = a(...e);
            return (i(...e), t);
          })
        : i && (n[r] = i)
      : r === `style`
        ? (n[r] = { ...i, ...a })
        : r === `className`
          ? (n[r] = [i, a].filter(Boolean).join(` `))
          : r === `aria-describedby` && (n[r] = Kn(a, i));
  }
  return { ...e, ...n };
}
$(Bn, `mergeProps`);
function Vn(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, `ref`)?.get,
    n = t && `isReactWarning` in t && t.isReactWarning;
  return n
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, `ref`)?.get),
      (n = t && `isReactWarning` in t && t.isReactWarning),
      n ? e.props.ref : e.props.ref || e.ref);
}
$(Vn, `getElementRef`);
function Hn(e) {
  return (
    h.isValidElement(e) &&
    typeof e.type == `function` &&
    `__radixId` in e.type &&
    e.type.__radixId === Ln
  );
}
$(Hn, `isSlottable`);
var Un = Symbol.for(`react.lazy`);
function Wn(e) {
  return (
    typeof e == `object` &&
    !!e &&
    `$$typeof` in e &&
    e.$$typeof === Un &&
    `_payload` in e &&
    Gn(e._payload)
  );
}
$(Wn, `isLazyComponent`);
function Gn(e) {
  return typeof e == `object` && !!e && `then` in e;
}
$(Gn, `isPromiseLike`);
function Kn(...e) {
  let t = new Set();
  for (let n of e)
    if (typeof n == `string`) for (let e of String(n).trim().split(/\s+/)) e && t.add(e);
  return t.size > 0 ? Array.from(t).join(` `) : void 0;
}
$(Kn, `concatAriaDescribedby`);
var qn = $(
    (e) =>
      `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    `createSlotError`,
  ),
  Jn = $(
    (e) =>
      `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    `createSlottableError`,
  ),
  Yn = h.use,
  Xn = On(
    `inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
    {
      variants: {
        variant: {
          default: `bg-primary text-primary-foreground hover:bg-primary/90`,
          destructive: `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40`,
          outline: `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50`,
          secondary: `bg-secondary text-secondary-foreground hover:bg-secondary/80`,
          ghost: `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50`,
          link: `text-primary underline-offset-4 hover:underline`,
        },
        size: {
          default: `h-9 px-4 py-2 has-[>svg]:px-3`,
          xs: `h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3`,
          sm: `h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5`,
          lg: `h-10 rounded-md px-6 has-[>svg]:px-4`,
          touch: `h-11 px-6 has-[>svg]:px-4`,
          icon: `size-9`,
          "icon-xs": `size-6 rounded-md [&_svg:not([class*='size-'])]:size-3`,
          "icon-sm": `size-8`,
          "icon-lg": `size-10`,
          "icon-touch": `size-11`,
        },
      },
      defaultVariants: { variant: `default`, size: `default` },
    },
  );
function Zn(e) {
  let t = (0, kt.c)(16),
    n,
    r,
    i,
    a,
    o;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]), (a = t[4]), (o = t[5]))
    : (({ className: n, variant: i, size: a, asChild: o, ...r } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = i),
      (t[4] = a),
      (t[5] = o));
  let s = i === void 0 ? `default` : i,
    c = a === void 0 ? `default` : a,
    l = o !== void 0 && o ? In : `button`,
    u;
  t[6] !== n || t[7] !== c || t[8] !== s
    ? ((u = Cn(Xn({ variant: s, size: c, className: n }))),
      (t[6] = n),
      (t[7] = c),
      (t[8] = s),
      (t[9] = u))
    : (u = t[9]);
  let d;
  return (
    t[10] !== l || t[11] !== r || t[12] !== c || t[13] !== u || t[14] !== s
      ? ((d = (0, g.jsx)(l, {
          "data-slot": `button`,
          "data-variant": s,
          "data-size": c,
          className: u,
          ...r,
        })),
        (t[10] = l),
        (t[11] = r),
        (t[12] = c),
        (t[13] = u),
        (t[14] = s),
        (t[15] = d))
      : (d = t[15]),
    d
  );
}
var Qn = X({ error: lt(Z()), message: lt(Z()), field: lt(Z()) }),
  $n = X({ shops: it(X({ id: Z(), slug: Z(), name: Z() })), currentId: st(Z()) }),
  er = `shopper.shops`,
  tr = new Set(),
  nr = ur();
function rr() {
  return (0, h.useSyncExternalStore)(dr, ar, ir);
}
function ir() {
  return nr;
}
function ar() {
  return nr;
}
function or() {
  return nr.shops.find((e) => e.id === nr.currentId);
}
function sr(e) {
  lr({ shops: [...nr.shops.filter((t) => t.id !== e.id), e], currentId: e.id });
}
function cr(e) {
  lr({ ...nr, currentId: e });
}
function lr(e) {
  nr = e;
  try {
    localStorage.setItem(er, JSON.stringify(e));
  } catch {}
  for (let e of tr) e();
}
function ur() {
  try {
    let e = bt($n, JSON.parse(localStorage.getItem(er) ?? `null`));
    if (e.success) return e.output;
  } catch {}
  return { shops: [], currentId: null };
}
function dr(e) {
  let t = (t) => {
    t.key === er && ((nr = ur()), e());
  };
  return (
    tr.add(e),
    addEventListener(`storage`, t),
    () => {
      (tr.delete(e), removeEventListener(`storage`, t));
    }
  );
}
var fr = `/api`,
  pr = class extends Error {
    status;
    field;
    constructor(e, t, n, r) {
      (super(t, r), (this.status = e), (this.field = n));
    }
  },
  mr = `Can't reach the server. Check your connection and try again.`,
  hr = `The server's reply couldn't be read. Refresh to see whether your change was saved.`,
  gr = `The server's reply couldn't be read. Refresh and try again.`,
  _r = 200,
  vr = [`token`, `resendToken`, `password`, `pin`];
function yr(e) {
  let t = new URL(e, `http://shopper.invalid`);
  for (let e of vr) t.searchParams.has(e) && t.searchParams.set(e, `redacted`);
  return `${t.pathname}${t.search}`;
}
async function br(e, t, { method: n = `GET`, body: r, shopId: i = or()?.id } = {}) {
  let a = new URL(e, `http://shopper.invalid`).searchParams,
    o =
      /^\/(onboarding|invitations|auth)(?:\/|$)/.test(e) ||
      e.split(`?`)[0] === `/catalogue/imports/uploads` ||
      vr.some((e) => a.has(e) || (typeof r == `object` && !!r && e in r)),
    s = new Headers();
  (r !== void 0 && s.set(`Content-Type`, `application/json`), i && s.set(`X-Shopper-Org`, i));
  let c = await fetch(`${fr}${e}`, {
      method: n,
      headers: s,
      credentials: `include`,
      body: r === void 0 ? void 0 : JSON.stringify(r),
    }).catch((t) => {
      throw (
        console.error(`[api] ${n} ${yr(e)} was not sent`, o ? `Request details withheld` : t),
        new pr(0, mr, void 0, o ? void 0 : { cause: t })
      );
    }),
    l = c.clone(),
    u = await c
      .json()
      .catch(
        async () => (
          c.ok ||
            console.error(
              `[api] ${n} ${yr(e)} failed with ${c.status} and a body that is not JSON`,
              o ? `Response details withheld` : (await l.text().catch(() => ``)).slice(0, _r),
            ),
          null
        ),
      );
  if (!c.ok) {
    let t = bt(Qn, u),
      n = t.success ? t.output : {};
    throw new pr(
      c.status,
      xr(n.message ?? n.error ?? `Request failed (${c.status})`, e, r),
      n.field,
    );
  }
  let d = bt(t, u);
  if (!d.success)
    throw (
      console.error(
        `[api] ${n} ${yr(e)} replied ${c.status} with an unexpected shape`,
        o ? `Response details withheld` : tt(d.issues),
      ),
      new pr(c.status, n === `GET` ? gr : hr)
    );
  return d.output;
}
function xr(e, t, n) {
  let r = new URL(t, `http://shopper.invalid`);
  for (let t of vr) {
    let i = r.searchParams.get(t);
    if ((i && (e = e.replaceAll(i, `[redacted]`)), n && typeof n == `object` && t in n)) {
      let r = n[t];
      typeof r == `string` && r && (e = e.replaceAll(r, `[redacted]`));
    }
  }
  return e;
}
var Sr = q(() => mt([Y(), at(), yt(ct(), Be()), Z(), it(Sr), dt(Z(), Sr)])),
  Cr = yt(Z(), G(), W(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)),
  wr = yt(Z(), W(/^\d{1,19}$/));
new TextEncoder();
var Tr = (e) => e?.replace(/([a-z0-9])([A-Z])/g, `$1-$2`).toLowerCase();
function Er(e, t, n = []) {
  if (t == null) throw Error(`[lucide]: iconNode is required when icon name is used`);
  return { name: Tr(e), size: 24, node: t, ...(n.length > 0 ? { aliases: n } : {}) };
}
var Dr = (e) => {
    let t = ``,
      n = !1;
    for (let r of e) {
      if (r === `-` || r === `_` || r <= ` `) {
        n = t.length > 0;
        continue;
      }
      (t.length === 0 ? (t += r.toLowerCase()) : (t += n ? r.toUpperCase() : r), (n = !1));
    }
    return t;
  },
  Or = (e) => {
    let t = Dr(e);
    return t.charAt(0).toUpperCase() + t.slice(1);
  },
  kr = (...e) =>
    e
      .filter((e, t, n) => !!e && e.trim() !== `` && n.indexOf(e) === t)
      .join(` `)
      .trim(),
  Ar = {
    xmlns: `http://www.w3.org/2000/svg`,
    width: 24,
    height: 24,
    viewBox: `0 0 24 24`,
    fill: `none`,
    stroke: `currentColor`,
    "stroke-width": 2,
    "stroke-linecap": `round`,
    "stroke-linejoin": `round`,
  };
function jr(e) {
  return e != null;
}
function Mr(e, t = {}) {
  let n = t.attributeNames ?? {},
    r = (e) => n[e] ?? e,
    i = e.size ?? e.width ?? Ar.width,
    a = e.size ?? e.height ?? Ar.height,
    o =
      e.aliases?.filter((e) => typeof e == `string` && e.trim() !== ``).map((e) => `lucide-${e}`) ??
      [],
    s = [...(e.name ? [`lucide-${e.name}`] : []), ...o],
    c = t.className?.split(` `).filter(Boolean) ?? [],
    l = t.includeDefaultClasses === !1 ? kr(...c) : kr(`lucide`, ...s, ...c),
    u = t.absoluteStrokeWidth
      ? (Number(t.strokeWidth ?? Ar[`stroke-width`]) * Number(e.size ?? e.width ?? Ar.width)) /
        Number(t.size ?? t.width ?? Ar.width)
      : (t.strokeWidth ?? Ar[`stroke-width`]);
  return [
    `svg`,
    {
      ...Object.entries(Ar).reduce((e, [t, n]) => ((e[r(t)] = n), e), {}),
      ...(`color` in t && t.color && { [r(`stroke`)]: t.color }),
      ...(`size` in t && jr(t.size) && { [r(`width`)]: t.size, [r(`height`)]: t.size }),
      ...(`width` in t && jr(t.width) && { [r(`width`)]: t.width }),
      ...(`height` in t && jr(t.height) && { [r(`height`)]: t.height }),
      [r(`stroke-width`)]: u,
      ...(l && { [r(`class`)]: l }),
      [r(`viewBox`)]: `0 0 ${i} ${a}`,
      ...(t.hasA11yProp === !1 ? { [r(`aria-hidden`)]: `true` } : {}),
      ...(`attributes` in t && t.attributes),
    },
    e.node.map((e) => {
      let [n, i, a] = e,
        o = t.nonScalingStroke ? { [r(`vector-effect`)]: `non-scaling-stroke`, ...i } : i;
      return a ? [n, o, a] : [n, o];
    }),
  ];
}
function Nr(e, t = {}) {
  return Mr(e, {
    ...t,
    attributeNames: {
      ...t.attributeNames,
      class: `className`,
      "stroke-width": `strokeWidth`,
      "stroke-linecap": `strokeLinecap`,
      "stroke-linejoin": `strokeLinejoin`,
      "vector-effect": `vectorEffect`,
    },
  });
}
var Pr = (e) => {
    for (let t in e) if (t.startsWith(`aria-`) || t === `role` || t === `title`) return !0;
    return !1;
  },
  Fr = (0, h.createContext)({}),
  Ir = () => (0, h.useContext)(Fr),
  Lr = (0, h.forwardRef)(
    (
      {
        color: e,
        size: t,
        width: n,
        height: r,
        strokeWidth: i,
        absoluteStrokeWidth: a,
        nonScalingStroke: o,
        className: s = ``,
        children: c,
        iconNode: l = [],
        icon: u = { node: l, aliases: [], size: 24 },
        ...d
      },
      f,
    ) => {
      let {
          size: p = 24,
          strokeWidth: m = 2,
          absoluteStrokeWidth: g = !1,
          nonScalingStroke: _ = !1,
          color: v = `currentColor`,
          className: y = ``,
        } = Ir() ?? {},
        b = !!c || Pr(d),
        [x, S, C = []] = Nr(u, {
          color: e ?? v,
          width: n ?? t ?? p,
          height: r ?? t ?? p,
          strokeWidth: i ?? m,
          absoluteStrokeWidth: a ?? g,
          nonScalingStroke: o ?? _,
          className: kr(y, s),
          hasA11yProp: b,
          attributes: d,
        });
      return (0, h.createElement)(x, { ref: f, ...S }, [
        ...C.map(([e, t]) => (0, h.createElement)(e, t)),
        ...(Array.isArray(c) ? c : [c]),
      ]);
    },
  );
function Rr(e, t = [], n = []) {
  let r = typeof e == `string` ? Er(e, t, n) : e,
    i = (0, h.forwardRef)(({ className: e, ...t }, n) =>
      (0, h.createElement)(Lr, { ref: n, icon: r, className: e, ...t }),
    );
  return (r.name && (i.displayName = Or(r.name)), i);
}
export {
  Z as $,
  U as A,
  M as At,
  lt as B,
  m as Bt,
  ze as C,
  j as Ct,
  He as D,
  A as Dt,
  rt as E,
  ie as Et,
  Y as F,
  oe as Ft,
  qe as G,
  vt as H,
  u as Ht,
  st as I,
  D as It,
  W as J,
  Je as K,
  ct as L,
  x as Lt,
  We as M,
  O as Mt,
  Ge as N,
  F as Nt,
  J as O,
  k as Ot,
  Ke as P,
  ce as Pt,
  ft as Q,
  X as R,
  y as Rt,
  Re as S,
  T as St,
  Ve as T,
  E as Tt,
  ut as U,
  o as Ut,
  _t as V,
  f as Vt,
  yt as W,
  c as Wt,
  bt as X,
  Ye as Y,
  Oe as Z,
  Ot as _,
  de as _t,
  br as a,
  G as at,
  at as b,
  R as bt,
  cr as c,
  Se as ct,
  In as d,
  ve as dt,
  Xe as et,
  Fn as f,
  be as ft,
  Cn as g,
  z as gt,
  On as h,
  fe as ht,
  pr as i,
  $e as it,
  Ue as j,
  re as jt,
  ot as k,
  w as kt,
  rr as l,
  xe as lt,
  Nn as m,
  he as mt,
  wr as n,
  Qe as nt,
  or as o,
  ht as ot,
  Mn as p,
  ge as pt,
  dt as q,
  Cr as r,
  mt as rt,
  sr as s,
  Te as st,
  Rr as t,
  Ze as tt,
  Zn as u,
  ye as ut,
  Et as v,
  le as vt,
  nt as w,
  ee as wt,
  Le as x,
  se as xt,
  it as y,
  ae as yt,
  gt as z,
  v as zt,
};
