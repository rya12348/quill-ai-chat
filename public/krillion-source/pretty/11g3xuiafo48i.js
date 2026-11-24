(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 91915, (e, t, r) => {
  "use strict";
  function n(e2, t2 = {}) {
    if (t2.onlyHashChange) return void e2();
    let r2 = document.documentElement;
    if ("smooth" !== r2.dataset.scrollBehavior) return void e2();
    let a = r2.style.scrollBehavior;
    r2.style.scrollBehavior = "auto", t2.dontForceLayout || r2.getClientRects(), e2(), r2.style.scrollBehavior = a;
  }
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "disableSmoothScrollDuringRouteTransition", { enumerable: true, get: function() {
    return n;
  } }), e.r(33525);
}, 68017, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "HTTPAccessFallbackBoundary", { enumerable: true, get: function() {
    return u;
  } });
  let n = e.r(90809), a = e.r(43476), o = n._(e.r(71645)), i = e.r(90373), s = e.r(54394);
  e.r(33525);
  let l = e.r(65347);
  class c extends o.default.Component {
    constructor(e2) {
      super(e2), this.state = { triggeredStatus: void 0, previousPathname: e2.pathname };
    }
    componentDidCatch() {
    }
    static getDerivedStateFromError(e2) {
      if ((0, s.isHTTPAccessFallbackError)(e2)) return { triggeredStatus: (0, s.getAccessFallbackHTTPStatus)(e2) };
      throw e2;
    }
    static getDerivedStateFromProps(e2, t2) {
      return e2.pathname !== t2.previousPathname && t2.triggeredStatus ? { triggeredStatus: void 0, previousPathname: e2.pathname } : { triggeredStatus: t2.triggeredStatus, previousPathname: e2.pathname };
    }
    render() {
      let { notFound: e2, forbidden: t2, unauthorized: r2, children: n2 } = this.props, { triggeredStatus: o2 } = this.state, i2 = { [s.HTTPAccessErrorStatus.NOT_FOUND]: e2, [s.HTTPAccessErrorStatus.FORBIDDEN]: t2, [s.HTTPAccessErrorStatus.UNAUTHORIZED]: r2 };
      if (o2) {
        let l2 = o2 === s.HTTPAccessErrorStatus.NOT_FOUND && e2, c2 = o2 === s.HTTPAccessErrorStatus.FORBIDDEN && t2, u2 = o2 === s.HTTPAccessErrorStatus.UNAUTHORIZED && r2;
        return l2 || c2 || u2 ? (0, a.jsxs)(a.Fragment, { children: [(0, a.jsx)("meta", { name: "robots", content: "noindex" }), false, i2[o2]] }) : n2;
      }
      return n2;
    }
  }
  function u({ notFound: e2, forbidden: t2, unauthorized: r2, children: n2 }) {
    let s2 = (0, i.useUntrackedPathname)(), d = (0, o.useContext)(l.MissingSlotContext);
    return e2 || t2 || r2 ? (0, a.jsx)(c, { pathname: s2, notFound: e2, forbidden: t2, unauthorized: r2, missingSlots: d, children: n2 }) : (0, a.jsx)(a.Fragment, { children: n2 });
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 28298, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "useRouterBFCache", { enumerable: true, get: function() {
    return a;
  } });
  let n = e.r(71645);
  function a(e2, t2, r2) {
    let [a2, o] = (0, n.useState)(() => ({ tree: e2, cacheNode: t2, stateKey: r2, next: null }));
    if (a2.tree === e2) return a2;
    let i = { tree: e2, cacheNode: t2, stateKey: r2, next: null }, s = 1, l = a2, c = i;
    for (; null !== l && s < 1; ) {
      if (l.stateKey === r2) {
        c.next = l.next;
        break;
      }
      {
        s++;
        let e3 = { tree: l.tree, cacheNode: l.cacheNode, stateKey: l.stateKey, next: null };
        c.next = e3, c = e3;
      }
      l = l.next;
    }
    return o(i), i;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 39756, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { LoadingBoundaryProvider: function() {
    return j;
  }, default: function() {
    return A;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(55682), i = e.r(90809), s = e.r(43476), l = i._(e.r(71645)), c = o._(e.r(74080)), u = e.r(65347), d = e.r(1244), f = e.r(72383), p = e.r(91915), m = e.r(58442), h = e.r(68017), g = e.r(70725), y = e.r(28298);
  e.r(74180);
  let b = e.r(61994), P = e.r(33906), _ = e.r(95871), v = c.default.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, E = ["bottom", "height", "left", "right", "top", "width", "x", "y"];
  function R(e2, t2) {
    let r2 = e2.getClientRects();
    if (0 === r2.length) return false;
    let n2 = 1 / 0;
    for (let e3 = 0; e3 < r2.length; e3++) {
      let t3 = r2[e3];
      t3.top < n2 && (n2 = t3.top);
    }
    return n2 >= 0 && n2 <= t2;
  }
  class O extends l.default.Component {
    componentDidMount() {
      this.handlePotentialScroll();
    }
    componentDidUpdate() {
      this.handlePotentialScroll();
    }
    render() {
      return this.props.children;
    }
    constructor(...e2) {
      super(...e2), this.handlePotentialScroll = () => {
        let { focusAndScrollRef: e3, cacheNode: t2 } = this.props, r2 = e3.forceScroll ? e3.scrollRef : t2.scrollRef;
        if (null === r2 || !r2.current) return;
        let n2 = null, a2 = e3.hashFragment;
        if (a2 && (n2 = "top" === a2 ? document.body : document.getElementById(a2) ?? document.getElementsByName(a2)[0]), n2 || (n2 = "u" < typeof window ? null : (0, v.findDOMNode)(this)), n2 instanceof Element) {
          for (; !(n2 instanceof HTMLElement) || (function(e4) {
            if (["sticky", "fixed"].includes(getComputedStyle(e4).position)) return true;
            let t3 = e4.getBoundingClientRect();
            return E.every((e5) => 0 === t3[e5]);
          })(n2); ) {
            if (null === n2.nextElementSibling) return;
            n2 = n2.nextElementSibling;
          }
          r2.current = false, (0, p.disableSmoothScrollDuringRouteTransition)(() => {
            if (a2) return void n2.scrollIntoView();
            let e4 = document.documentElement, t3 = e4.clientHeight;
            !R(n2, t3) && (e4.scrollTop = 0, R(n2, t3) || n2.scrollIntoView());
          }, { dontForceLayout: true, onlyHashChange: e3.onlyHashChange }), e3.onlyHashChange = false, e3.hashFragment = null, n2.focus();
        }
      };
    }
  }
  function w({ children: e2, cacheNode: t2 }) {
    let r2 = (0, l.useContext)(u.GlobalLayoutRouterContext);
    if (!r2) throw Object.defineProperty(Error("invariant global layout router not mounted"), "__NEXT_ERROR_CODE", { value: "E473", enumerable: false, configurable: true });
    return (0, s.jsx)(O, { focusAndScrollRef: r2.focusAndScrollRef, cacheNode: t2, children: e2 });
  }
  function S({ tree: e2, segmentPath: t2, debugNameContext: r2, cacheNode: n2, params: a2, url: o2, isActive: i2 }) {
    let c2, f2 = (0, l.useContext)(u.GlobalLayoutRouterContext);
    if ((0, l.useContext)(b.NavigationPromisesContext), !f2) throw Object.defineProperty(Error("invariant global layout router not mounted"), "__NEXT_ERROR_CODE", { value: "E473", enumerable: false, configurable: true });
    let p2 = null !== n2 ? n2 : (0, l.use)(d.unresolvedThenable), m2 = null !== p2.prefetchRsc ? p2.prefetchRsc : p2.rsc, h2 = (0, l.useDeferredValue)(p2.rsc, m2);
    if ((0, _.isDeferredRsc)(h2)) {
      let e3 = (0, l.use)(h2);
      null === e3 && (0, l.use)(d.unresolvedThenable), c2 = e3;
    } else null === h2 && (0, l.use)(d.unresolvedThenable), c2 = h2;
    let g2 = c2;
    return (0, s.jsx)(u.LayoutRouterContext.Provider, { value: { parentTree: e2, parentCacheNode: p2, parentSegmentPath: t2, parentParams: a2, parentLoadingData: null, debugNameContext: r2, url: o2, isActive: i2 }, children: g2 });
  }
  function j({ loading: e2, children: t2 }) {
    let r2 = (0, l.use)(u.LayoutRouterContext);
    return null === r2 ? t2 : (0, s.jsx)(u.LayoutRouterContext.Provider, { value: { parentTree: r2.parentTree, parentCacheNode: r2.parentCacheNode, parentSegmentPath: r2.parentSegmentPath, parentParams: r2.parentParams, parentLoadingData: e2, debugNameContext: r2.debugNameContext, url: r2.url, isActive: r2.isActive }, children: t2 });
  }
  function C({ name: e2, loading: t2, children: r2 }) {
    if (null !== t2) {
      let n2 = t2[0], a2 = t2[1], o2 = t2[2];
      return (0, s.jsx)(l.Suspense, { name: e2, fallback: (0, s.jsxs)(s.Fragment, { children: [a2, o2, n2] }), children: r2 });
    }
    return (0, s.jsx)(s.Fragment, { children: r2 });
  }
  function A({ parallelRouterKey: e2, error: t2, errorStyles: r2, errorScripts: n2, templateStyles: a2, templateScripts: o2, template: i2, notFound: c2, forbidden: p2, unauthorized: b2, segmentViewBoundaries: _2 }) {
    let v2 = (0, l.useContext)(u.LayoutRouterContext);
    if (!v2) throw Object.defineProperty(Error("invariant expected layout router to be mounted"), "__NEXT_ERROR_CODE", { value: "E56", enumerable: false, configurable: true });
    let { parentTree: E2, parentCacheNode: R2, parentSegmentPath: O2, parentParams: j2, parentLoadingData: x, url: k, isActive: T, debugNameContext: N } = v2, D = E2[0], M = null === O2 ? [e2] : O2.concat([D, e2]), I = E2[1][e2], F = R2.slots;
    (void 0 === I || null === F) && (0, l.use)(d.unresolvedThenable);
    let $ = I[0], L = F[e2] ?? null, U = (0, g.createRouterCacheKey)($, true), X = (0, y.useRouterBFCache)(I, L, U), H = [];
    do {
      let e3 = X.tree, l2 = X.cacheNode, d2 = X.stateKey, g2 = e3[0], y2 = j2;
      if (Array.isArray(g2)) {
        let e4 = g2[0], t3 = g2[1], r3 = g2[2], n3 = (0, P.getParamValueFromCacheKey)(t3, r3);
        null !== n3 && (y2 = { ...j2, [e4]: n3 });
      }
      let _3 = (function(e4) {
        if ("/" === e4) return "/";
        if ("string" == typeof e4) if ("(__SLOT__)" === e4) return;
        else return e4 + "/";
        return e4[1] + "/";
      })(g2), v3 = _3 ?? N, E3 = void 0 === _3 ? void 0 : N, R3 = (0, s.jsxs)(w, { cacheNode: l2, children: [(0, s.jsx)(f.ErrorBoundary, { errorComponent: t2, errorStyles: r2, errorScripts: n2, children: (0, s.jsx)(C, { name: E3, loading: x, children: (0, s.jsx)(h.HTTPAccessFallbackBoundary, { notFound: c2, forbidden: p2, unauthorized: b2, children: (0, s.jsxs)(m.RedirectBoundary, { children: [(0, s.jsx)(S, { url: k, tree: e3, params: y2, cacheNode: l2, segmentPath: M, debugNameContext: v3, isActive: T && d2 === U }), null] }) }) }) }), null] }), O3 = (0, s.jsxs)(u.TemplateContext.Provider, { value: R3, children: [a2, o2, i2] }, d2);
      H.push(O3), X = X.next;
    } while (null !== X);
    return H;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 37457, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "default", { enumerable: true, get: function() {
    return s;
  } });
  let n = e.r(90809), a = e.r(43476), o = n._(e.r(71645)), i = e.r(65347);
  function s() {
    let e2 = (0, o.useContext)(i.TemplateContext);
    return (0, a.jsx)(a.Fragment, { children: e2 });
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 93504, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "createRenderSearchParamsFromClient", { enumerable: true, get: function() {
    return a;
  } });
  let n = /* @__PURE__ */ new WeakMap();
  function a(e2) {
    let t2 = n.get(e2);
    if (t2) return t2;
    let r2 = Promise.resolve(e2);
    return n.set(e2, r2), r2;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 66996, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "createRenderSearchParamsFromClient", { enumerable: true, get: function() {
    return n;
  } });
  let n = e.r(93504).createRenderSearchParamsFromClient;
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 6831, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "createRenderParamsFromClient", { enumerable: true, get: function() {
    return a;
  } });
  let n = /* @__PURE__ */ new WeakMap();
  function a(e2) {
    let t2 = n.get(e2);
    if (t2) return t2;
    let r2 = Promise.resolve(e2);
    return n.set(e2, r2), r2;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 97689, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "createRenderParamsFromClient", { enumerable: true, get: function() {
    return n;
  } });
  let n = e.r(6831).createRenderParamsFromClient;
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 66373, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { accumulateRootVaryParam: function() {
    return y;
  }, accumulateVaryParam: function() {
    return g;
  }, createResponseVaryParamsAccumulator: function() {
    return c;
  }, createVaryParamsAccumulator: function() {
    return u;
  }, createVaryingParams: function() {
    return b;
  }, createVaryingSearchParams: function() {
    return P;
  }, emptyVaryParamsAccumulator: function() {
    return l;
  }, finishAccumulatingVaryParams: function() {
    return _;
  }, getMetadataVaryParamsAccumulator: function() {
    return d;
  }, getMetadataVaryParamsThenable: function() {
    return p;
  }, getRootParamsVaryParamsAccumulator: function() {
    return h;
  }, getVaryParamsThenable: function() {
    return f;
  }, getViewportVaryParamsAccumulator: function() {
    return m;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(62141);
  function i() {
    let e2 = { varyParams: /* @__PURE__ */ new Set(), status: "pending", value: /* @__PURE__ */ new Set(), then(t2) {
      t2 && ("pending" === e2.status ? e2.resolvers.push(t2) : t2(e2.value));
    }, resolvers: [] };
    return e2;
  }
  let s = /* @__PURE__ */ new Set(), l = { varyParams: s, status: "fulfilled", value: s, then(e2) {
    e2 && e2(s);
  }, resolvers: [] };
  function c() {
    let e2 = i();
    return { head: e2, rootParams: i(), segments: /* @__PURE__ */ new Set() };
  }
  function u() {
    let e2 = o.workUnitAsyncStorage.getStore();
    if (e2) switch (e2.type) {
      case "prerender":
      case "prerender-runtime": {
        let t2 = e2.varyParamsAccumulator;
        if (null !== t2) {
          let e3 = i();
          return t2.segments.add(e3), e3;
        }
      }
    }
    return null;
  }
  function d() {
    let e2 = o.workUnitAsyncStorage.getStore();
    if (e2) switch (e2.type) {
      case "prerender":
      case "prerender-runtime": {
        let t2 = e2.varyParamsAccumulator;
        if (null !== t2) return t2.head;
      }
    }
    return null;
  }
  function f(e2) {
    return e2;
  }
  function p() {
    let e2 = d();
    return null !== e2 ? e2 : null;
  }
  let m = d;
  function h() {
    let e2 = o.workUnitAsyncStorage.getStore();
    if (e2) switch (e2.type) {
      case "prerender":
      case "prerender-runtime": {
        let t2 = e2.varyParamsAccumulator;
        if (null !== t2) return t2.rootParams;
      }
    }
    return null;
  }
  function g(e2, t2) {
    e2.varyParams.add(t2);
  }
  function y(e2) {
    let t2 = h();
    null !== t2 && g(t2, e2);
  }
  function b(e2, t2, r2) {
    if (null !== r2) return new Proxy(t2, { get: (t3, n3, a2) => ("string" == typeof n3 && (n3 === r2 || Object.prototype.hasOwnProperty.call(t3, n3)) && g(e2, n3), Reflect.get(t3, n3, a2)), has: (t3, n3) => (n3 === r2 && g(e2, r2), Reflect.has(t3, n3)), ownKeys: (t3) => (g(e2, r2), Reflect.ownKeys(t3)) });
    let n2 = {};
    for (let r3 in t2) Object.defineProperty(n2, r3, { get: () => (g(e2, r3), t2[r3]), enumerable: true });
    return n2;
  }
  function P(e2, t2) {
    let r2 = {};
    for (let n2 in t2) Object.defineProperty(r2, n2, { get: () => (g(e2, "?"), t2[n2]), enumerable: true });
    return r2;
  }
  async function _(e2) {
    let t2 = e2.rootParams.varyParams;
    for (let r2 of (v(e2.head, t2), e2.segments)) v(r2, t2);
    await Promise.resolve(), await Promise.resolve(), await Promise.resolve();
  }
  function v(e2, t2) {
    if ("pending" !== e2.status) return;
    let r2 = new Set(e2.varyParams);
    for (let e3 of t2) r2.add(e3);
    for (let t3 of (e2.value = r2, e2.status = "fulfilled", e2.resolvers)) t3(r2);
    e2.resolvers = [];
  }
}, 42715, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "ReflectAdapter", { enumerable: true, get: function() {
    return n;
  } });
  class n {
    static get(e2, t2, r2) {
      let n2 = Reflect.get(e2, t2, r2);
      return "function" == typeof n2 ? n2.bind(e2) : n2;
    }
    static set(e2, t2, r2, n2) {
      return Reflect.set(e2, t2, r2, n2);
    }
    static has(e2, t2) {
      return Reflect.has(e2, t2);
    }
    static deleteProperty(e2, t2) {
      return Reflect.deleteProperty(e2, t2);
    }
  }
}, 76361, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "createDedupedByCallsiteServerErrorLoggerDev", { enumerable: true, get: function() {
    return l;
  } });
  let n = (function(e2) {
    if (e2 && e2.__esModule) return e2;
    if (null === e2 || "object" != typeof e2 && "function" != typeof e2) return { default: e2 };
    var t2 = a(void 0);
    if (t2 && t2.has(e2)) return t2.get(e2);
    var r2 = { __proto__: null }, n2 = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for (var o2 in e2) if ("default" !== o2 && Object.prototype.hasOwnProperty.call(e2, o2)) {
      var i2 = n2 ? Object.getOwnPropertyDescriptor(e2, o2) : null;
      i2 && (i2.get || i2.set) ? Object.defineProperty(r2, o2, i2) : r2[o2] = e2[o2];
    }
    return r2.default = e2, t2 && t2.set(e2, r2), r2;
  })(e.r(71645));
  function a(e2) {
    if ("function" != typeof WeakMap) return null;
    var t2 = /* @__PURE__ */ new WeakMap(), r2 = /* @__PURE__ */ new WeakMap();
    return (a = function(e3) {
      return e3 ? r2 : t2;
    })(e2);
  }
  let o = { current: null }, i = "function" == typeof n.cache ? n.cache : (e2) => e2, s = console.warn;
  function l(e2) {
    return function(...t2) {
      s(e2(...t2));
    };
  }
  i((e2) => {
    try {
      s(o.current);
    } finally {
      o.current = null;
    }
  });
}, 65932, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { describeHasCheckingStringProperty: function() {
    return s;
  }, describeStringPropertyAccess: function() {
    return i;
  }, wellKnownProperties: function() {
    return l;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  function i(e2, t2) {
    return o.test(t2) ? `\`${e2}.${t2}\`` : `\`${e2}[${JSON.stringify(t2)}]\``;
  }
  function s(e2, t2) {
    let r2 = JSON.stringify(t2);
    return `\`Reflect.has(${e2}, ${r2})\`, \`${r2} in ${e2}\`, or similar`;
  }
  let l = /* @__PURE__ */ new Set(["hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toString", "valueOf", "toLocaleString", "then", "catch", "finally", "status", "displayName", "_debugInfo", "toJSON", "$$typeof", "__esModule", "@@iterator"]);
}, 83066, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "afterTaskAsyncStorageInstance", { enumerable: true, get: function() {
    return n;
  } });
  let n = (0, e.r(90317).createAsyncLocalStorage)();
}, 41643, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "afterTaskAsyncStorage", { enumerable: true, get: function() {
    return n.afterTaskAsyncStorageInstance;
  } });
  let n = e.r(83066);
}, 50999, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { isRequestAPICallableInsideAfter: function() {
    return c;
  }, throwForSearchParamsAccessInUseCache: function() {
    return l;
  }, throwWithStaticGenerationBailoutErrorWithDynamicError: function() {
    return s;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(43248), i = e.r(41643);
  function s(e2, t2) {
    throw Object.defineProperty(new o.StaticGenBailoutError(`Route ${e2} with \`dynamic = "error"\` couldn't be rendered statically because it used ${t2}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", { value: "E543", enumerable: false, configurable: true });
  }
  function l(e2, t2) {
    let r2 = Object.defineProperty(Error(`Route ${e2.route} used \`searchParams\` inside "use cache". Accessing dynamic request data inside a cache scope is not supported. If you need some search params inside a cached function await \`searchParams\` outside of the cached function and pass only the required search params as arguments to the cached function. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", { value: "E842", enumerable: false, configurable: true });
    throw Error.captureStackTrace(r2, t2), e2.invalidDynamicUsageError ??= r2, r2;
  }
  function c() {
    let e2 = i.afterTaskAsyncStorage.getStore();
    return (null == e2 ? void 0 : e2.rootTaskSpawnPhase) === "action";
  }
}, 28649, (e, t, r) => {
  "use strict";
  var n = Object.defineProperty, a = Object.getOwnPropertyDescriptor, o = Object.getOwnPropertyNames, i = Object.prototype.hasOwnProperty, s = {}, l = { RequestCookies: () => h, ResponseCookies: () => g, parseCookie: () => d, parseSetCookie: () => f, stringifyCookie: () => u };
  for (var c in l) n(s, c, { get: l[c], enumerable: true });
  function u(e2) {
    var t2;
    let r2 = ["path" in e2 && e2.path && `Path=${e2.path}`, "expires" in e2 && (e2.expires || 0 === e2.expires) && `Expires=${("number" == typeof e2.expires ? new Date(e2.expires) : e2.expires).toUTCString()}`, "maxAge" in e2 && "number" == typeof e2.maxAge && `Max-Age=${e2.maxAge}`, "domain" in e2 && e2.domain && `Domain=${e2.domain}`, "secure" in e2 && e2.secure && "Secure", "httpOnly" in e2 && e2.httpOnly && "HttpOnly", "sameSite" in e2 && e2.sameSite && `SameSite=${e2.sameSite}`, "partitioned" in e2 && e2.partitioned && "Partitioned", "priority" in e2 && e2.priority && `Priority=${e2.priority}`].filter(Boolean), n2 = `${e2.name}=${encodeURIComponent(null != (t2 = e2.value) ? t2 : "")}`;
    return 0 === r2.length ? n2 : `${n2}; ${r2.join("; ")}`;
  }
  function d(e2) {
    let t2 = /* @__PURE__ */ new Map();
    for (let r2 of e2.split(/; */)) {
      if (!r2) continue;
      let e3 = r2.indexOf("=");
      if (-1 === e3) {
        t2.set(r2, "true");
        continue;
      }
      let [n2, a2] = [r2.slice(0, e3), r2.slice(e3 + 1)];
      try {
        t2.set(n2, decodeURIComponent(null != a2 ? a2 : "true"));
      } catch {
      }
    }
    return t2;
  }
  function f(e2) {
    if (!e2) return;
    let [[t2, r2], ...n2] = d(e2), { domain: a2, expires: o2, httponly: i2, maxage: s2, path: l2, samesite: c2, secure: u2, partitioned: f2, priority: h2 } = Object.fromEntries(n2.map(([e3, t3]) => [e3.toLowerCase().replace(/-/g, ""), t3]));
    {
      var g2, y, b = { name: t2, value: decodeURIComponent(r2), domain: a2, ...o2 && { expires: new Date(o2) }, ...i2 && { httpOnly: true }, ..."string" == typeof s2 && { maxAge: Number(s2) }, path: l2, ...c2 && { sameSite: p.includes(g2 = (g2 = c2).toLowerCase()) ? g2 : void 0 }, ...u2 && { secure: true }, ...h2 && { priority: m.includes(y = (y = h2).toLowerCase()) ? y : void 0 }, ...f2 && { partitioned: true } };
      let e3 = {};
      for (let t3 in b) b[t3] && (e3[t3] = b[t3]);
      return e3;
    }
  }
  t.exports = ((e2, t2, r2) => {
    if (t2 && "object" == typeof t2 || "function" == typeof t2) for (let s2 of o(t2)) i.call(e2, s2) || void 0 === s2 || n(e2, s2, { get: () => t2[s2], enumerable: !(r2 = a(t2, s2)) || r2.enumerable });
    return e2;
  })(n({}, "__esModule", { value: true }), s);
  var p = ["strict", "lax", "none"], m = ["low", "medium", "high"], h = class {
    constructor(e2) {
      this._parsed = /* @__PURE__ */ new Map(), this._headers = e2;
      const t2 = e2.get("cookie");
      if (t2) for (const [e3, r2] of d(t2)) this._parsed.set(e3, { name: e3, value: r2 });
    }
    [Symbol.iterator]() {
      return this._parsed[Symbol.iterator]();
    }
    get size() {
      return this._parsed.size;
    }
    get(...e2) {
      let t2 = "string" == typeof e2[0] ? e2[0] : e2[0].name;
      return this._parsed.get(t2);
    }
    getAll(...e2) {
      var t2;
      let r2 = Array.from(this._parsed);
      if (!e2.length) return r2.map(([e3, t3]) => t3);
      let n2 = "string" == typeof e2[0] ? e2[0] : null == (t2 = e2[0]) ? void 0 : t2.name;
      return r2.filter(([e3]) => e3 === n2).map(([e3, t3]) => t3);
    }
    has(e2) {
      return this._parsed.has(e2);
    }
    set(...e2) {
      let [t2, r2] = 1 === e2.length ? [e2[0].name, e2[0].value] : e2, n2 = this._parsed;
      return n2.set(t2, { name: t2, value: r2 }), this._headers.set("cookie", Array.from(n2).map(([e3, t3]) => u(t3)).join("; ")), this;
    }
    delete(e2) {
      let t2 = this._parsed, r2 = Array.isArray(e2) ? e2.map((e3) => t2.delete(e3)) : t2.delete(e2);
      return this._headers.set("cookie", Array.from(t2).map(([e3, t3]) => u(t3)).join("; ")), r2;
    }
    clear() {
      return this.delete(Array.from(this._parsed.keys())), this;
    }
    [/* @__PURE__ */ Symbol.for("edge-runtime.inspect.custom")]() {
      return `RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
    }
    toString() {
      return [...this._parsed.values()].map((e2) => `${e2.name}=${encodeURIComponent(e2.value)}`).join("; ");
    }
  }, g = class {
    constructor(e2) {
      var t2, r2, n2;
      this._parsed = /* @__PURE__ */ new Map(), this._headers = e2;
      const a2 = null != (n2 = null != (r2 = null == (t2 = e2.getSetCookie) ? void 0 : t2.call(e2)) ? r2 : e2.get("set-cookie")) ? n2 : [];
      for (const e3 of Array.isArray(a2) ? a2 : (function(e4) {
        if (!e4) return [];
        var t3, r3, n3, a3, o2, i2 = [], s2 = 0;
        function l2() {
          for (; s2 < e4.length && /\s/.test(e4.charAt(s2)); ) s2 += 1;
          return s2 < e4.length;
        }
        for (; s2 < e4.length; ) {
          for (t3 = s2, o2 = false; l2(); ) if ("," === (r3 = e4.charAt(s2))) {
            for (n3 = s2, s2 += 1, l2(), a3 = s2; s2 < e4.length && "=" !== (r3 = e4.charAt(s2)) && ";" !== r3 && "," !== r3; ) s2 += 1;
            s2 < e4.length && "=" === e4.charAt(s2) ? (o2 = true, s2 = a3, i2.push(e4.substring(t3, n3)), t3 = s2) : s2 = n3 + 1;
          } else s2 += 1;
          (!o2 || s2 >= e4.length) && i2.push(e4.substring(t3, e4.length));
        }
        return i2;
      })(a2)) {
        const t3 = f(e3);
        t3 && this._parsed.set(t3.name, t3);
      }
    }
    get(...e2) {
      let t2 = "string" == typeof e2[0] ? e2[0] : e2[0].name;
      return this._parsed.get(t2);
    }
    getAll(...e2) {
      var t2;
      let r2 = Array.from(this._parsed.values());
      if (!e2.length) return r2;
      let n2 = "string" == typeof e2[0] ? e2[0] : null == (t2 = e2[0]) ? void 0 : t2.name;
      return r2.filter((e3) => e3.name === n2);
    }
    has(e2) {
      return this._parsed.has(e2);
    }
    set(...e2) {
      let [t2, r2, n2] = 1 === e2.length ? [e2[0].name, e2[0].value, e2[0]] : e2, a2 = this._parsed;
      return a2.set(t2, (function(e3 = { name: "", value: "" }) {
        return "number" == typeof e3.expires && (e3.expires = new Date(e3.expires)), e3.maxAge && (e3.expires = new Date(Date.now() + 1e3 * e3.maxAge)), (null === e3.path || void 0 === e3.path) && (e3.path = "/"), e3;
      })({ name: t2, value: r2, ...n2 })), (function(e3, t3) {
        for (let [, r3] of (t3.delete("set-cookie"), e3)) {
          let e4 = u(r3);
          t3.append("set-cookie", e4);
        }
      })(a2, this._headers), this;
    }
    delete(...e2) {
      let [t2, r2] = "string" == typeof e2[0] ? [e2[0]] : [e2[0].name, e2[0]];
      return this.set({ ...r2, name: t2, value: "", expires: /* @__PURE__ */ new Date(0) });
    }
    [/* @__PURE__ */ Symbol.for("edge-runtime.inspect.custom")]() {
      return `ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
    }
    toString() {
      return [...this._parsed.values()].map(u).join("; ");
    }
  };
}, 96883, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { RequestCookies: function() {
    return o.RequestCookies;
  }, ResponseCookies: function() {
    return o.ResponseCookies;
  }, stringifyCookie: function() {
    return o.stringifyCookie;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(28649);
}, 97270, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { MutableRequestCookiesAdapter: function() {
    return m;
  }, ReadonlyRequestCookiesError: function() {
    return c;
  }, RequestCookiesAdapter: function() {
    return u;
  }, appendMutableCookies: function() {
    return p;
  }, areCookiesMutableInCurrentPhase: function() {
    return g;
  }, createCookiesWithMutableAccessCheck: function() {
    return h;
  }, getModifiedCookieValues: function() {
    return f;
  }, responseCookiesToRequestCookies: function() {
    return b;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(96883), i = e.r(42715), s = e.r(63599), l = e.r(39146);
  class c extends Error {
    constructor() {
      super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
    }
    static callable() {
      throw new c();
    }
  }
  class u {
    static seal(e2) {
      return new Proxy(e2, { get(e3, t2, r2) {
        switch (t2) {
          case "clear":
          case "delete":
          case "set":
            return c.callable;
          default:
            return i.ReflectAdapter.get(e3, t2, r2);
        }
      } });
    }
  }
  let d = /* @__PURE__ */ Symbol.for("next.mutated.cookies");
  function f(e2) {
    let t2 = e2[d];
    return t2 && Array.isArray(t2) && 0 !== t2.length ? t2 : [];
  }
  function p(e2, t2) {
    let r2 = f(t2);
    if (0 === r2.length) return false;
    let n2 = new o.ResponseCookies(e2), a2 = n2.getAll();
    for (let e3 of r2) n2.set(e3);
    for (let e3 of a2) n2.set(e3);
    return true;
  }
  class m {
    static wrap(e2, t2) {
      let r2 = new o.ResponseCookies(new Headers());
      for (let t3 of e2.getAll()) r2.set(t3);
      let n2 = [], a2 = /* @__PURE__ */ new Set(), c2 = () => {
        let e3 = s.workAsyncStorage.getStore();
        if (e3 && (e3.pathWasRevalidated = l.ActionDidRevalidateStaticAndDynamic), n2 = r2.getAll().filter((e4) => a2.has(e4.name)), t2) {
          let e4 = [];
          for (let t3 of n2) {
            let r3 = new o.ResponseCookies(new Headers());
            r3.set(t3), e4.push(r3.toString());
          }
          t2(e4);
        }
      }, u2 = new Proxy(r2, { get(e3, t3, r3) {
        switch (t3) {
          case d:
            return n2;
          case "delete":
            return function(...t4) {
              a2.add("string" == typeof t4[0] ? t4[0] : t4[0].name);
              try {
                return e3.delete(...t4), u2;
              } finally {
                c2();
              }
            };
          case "set":
            return function(...t4) {
              a2.add("string" == typeof t4[0] ? t4[0] : t4[0].name);
              try {
                return e3.set(...t4), u2;
              } finally {
                c2();
              }
            };
          default:
            return i.ReflectAdapter.get(e3, t3, r3);
        }
      } });
      return u2;
    }
  }
  function h(e2) {
    let t2 = new Proxy(e2.mutableCookies, { get(r2, n2, a2) {
      switch (n2) {
        case "delete":
          return function(...n3) {
            return y(e2, "cookies().delete"), r2.delete(...n3), t2;
          };
        case "set":
          return function(...n3) {
            return y(e2, "cookies().set"), r2.set(...n3), t2;
          };
        default:
          return i.ReflectAdapter.get(r2, n2, a2);
      }
    } });
    return t2;
  }
  function g(e2) {
    return "action" === e2.phase;
  }
  function y(e2, t2) {
    if (!g(e2)) throw new c();
  }
  function b(e2) {
    let t2 = new o.RequestCookies(new Headers());
    for (let r2 of e2.getAll()) t2.set(r2);
    return t2;
  }
}, 87720, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { HeadersAdapter: function() {
    return s;
  }, ReadonlyHeadersError: function() {
    return i;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(42715);
  class i extends Error {
    constructor() {
      super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
    }
    static callable() {
      throw new i();
    }
  }
  class s extends Headers {
    constructor(e2) {
      super(), this.headers = new Proxy(e2, { get(t2, r2, n2) {
        if ("symbol" == typeof r2) return o.ReflectAdapter.get(t2, r2, n2);
        let a2 = r2.toLowerCase(), i2 = Object.keys(e2).find((e3) => e3.toLowerCase() === a2);
        if (void 0 !== i2) return o.ReflectAdapter.get(t2, i2, n2);
      }, set(t2, r2, n2, a2) {
        if ("symbol" == typeof r2) return o.ReflectAdapter.set(t2, r2, n2, a2);
        let i2 = r2.toLowerCase(), s2 = Object.keys(e2).find((e3) => e3.toLowerCase() === i2);
        return o.ReflectAdapter.set(t2, s2 ?? r2, n2, a2);
      }, has(t2, r2) {
        if ("symbol" == typeof r2) return o.ReflectAdapter.has(t2, r2);
        let n2 = r2.toLowerCase(), a2 = Object.keys(e2).find((e3) => e3.toLowerCase() === n2);
        return void 0 !== a2 && o.ReflectAdapter.has(t2, a2);
      }, deleteProperty(t2, r2) {
        if ("symbol" == typeof r2) return o.ReflectAdapter.deleteProperty(t2, r2);
        let n2 = r2.toLowerCase(), a2 = Object.keys(e2).find((e3) => e3.toLowerCase() === n2);
        return void 0 === a2 || o.ReflectAdapter.deleteProperty(t2, a2);
      } });
    }
    static seal(e2) {
      return new Proxy(e2, { get(e3, t2, r2) {
        switch (t2) {
          case "append":
          case "delete":
          case "set":
            return i.callable;
          default:
            return o.ReflectAdapter.get(e3, t2, r2);
        }
      } });
    }
    merge(e2) {
      return Array.isArray(e2) ? e2.join(", ") : e2;
    }
    static from(e2) {
      return e2 instanceof Headers ? e2 : new s(e2);
    }
    append(e2, t2) {
      let r2 = this.headers[e2];
      "string" == typeof r2 ? this.headers[e2] = [r2, t2] : Array.isArray(r2) ? r2.push(t2) : this.headers[e2] = t2;
    }
    delete(e2) {
      delete this.headers[e2];
    }
    get(e2) {
      let t2 = this.headers[e2];
      return void 0 !== t2 ? this.merge(t2) : null;
    }
    has(e2) {
      return void 0 !== this.headers[e2];
    }
    set(e2, t2) {
      this.headers[e2] = t2;
    }
    forEach(e2, t2) {
      for (let [r2, n2] of this.entries()) e2.call(t2, n2, r2, this);
    }
    *entries() {
      for (let e2 of Object.keys(this.headers)) {
        let t2 = e2.toLowerCase(), r2 = this.get(t2);
        yield [t2, r2];
      }
    }
    *keys() {
      for (let e2 of Object.keys(this.headers)) {
        let t2 = e2.toLowerCase();
        yield t2;
      }
    }
    *values() {
      for (let e2 of Object.keys(this.headers)) {
        let t2 = this.get(e2);
        yield t2;
      }
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  }
}, 1643, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { getParamProperties: function() {
    return l;
  }, getSegmentParam: function() {
    return i;
  }, isCatchAll: function() {
    return s;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(91463);
  function i(e2) {
    let t2 = o.INTERCEPTION_ROUTE_MARKERS.find((t3) => e2.startsWith(t3));
    return (t2 && (e2 = e2.slice(t2.length)), e2.startsWith("[[...") && e2.endsWith("]]")) ? { paramType: "optional-catchall", paramName: e2.slice(5, -2) } : e2.startsWith("[...") && e2.endsWith("]") ? { paramType: t2 ? `catchall-intercepted-${t2}` : "catchall", paramName: e2.slice(4, -1) } : e2.startsWith("[") && e2.endsWith("]") ? { paramType: t2 ? `dynamic-intercepted-${t2}` : "dynamic", paramName: e2.slice(1, -1) } : null;
  }
  function s(e2) {
    return "catchall" === e2 || "catchall-intercepted-(..)(..)" === e2 || "catchall-intercepted-(.)" === e2 || "catchall-intercepted-(..)" === e2 || "catchall-intercepted-(...)" === e2 || "optional-catchall" === e2;
  }
  function l(e2) {
    let t2 = false, r2 = false;
    switch (e2) {
      case "catchall":
      case "catchall-intercepted-(..)(..)":
      case "catchall-intercepted-(.)":
      case "catchall-intercepted-(..)":
      case "catchall-intercepted-(...)":
        t2 = true;
        break;
      case "optional-catchall":
        t2 = true, r2 = true;
    }
    return { repeat: t2, optional: r2 };
  }
}, 90929, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "parseRelativeUrl", { enumerable: true, get: function() {
    return o;
  } });
  let n = e.r(18967), a = e.r(98183);
  function o(e2, t2, r2 = true) {
    let i = new URL("u" < typeof window ? "http://n" : (0, n.getLocationOrigin)()), s = t2 ? new URL(t2, i) : e2.startsWith(".") ? new URL("u" < typeof window ? "http://n" : window.location.href) : i, { pathname: l, searchParams: c, search: u, hash: d, href: f, origin: p } = e2.startsWith("/") ? new URL(`${s.protocol}//${s.host}${e2}`) : new URL(e2, s);
    if (p !== i.origin) throw Object.defineProperty(Error(`invariant: invalid relative URL, router received ${e2}`), "__NEXT_ERROR_CODE", { value: "E159", enumerable: false, configurable: true });
    return { auth: null, host: null, hostname: null, pathname: l, port: null, protocol: null, query: r2 ? (0, a.searchParamsToUrlQuery)(c) : void 0, search: u, hash: d, href: f.slice(p.length), slashes: null };
  }
}, 13770, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { InstantValidationError: function() {
    return s;
  }, isInstantValidationError: function() {
    return i;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = "INSTANT_VALIDATION_ERROR";
  function i(e2) {
    return !!(e2 && "object" == typeof e2 && e2 instanceof Error && e2.digest === o);
  }
  class s extends Error {
    constructor(...e2) {
      super(...e2), this.digest = o;
    }
  }
}, 18450, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { assertRootParamInSamples: function() {
    return S;
  }, createCookiesFromSample: function() {
    return y;
  }, createDraftModeForValidation: function() {
    return _;
  }, createExhaustiveParamsProxy: function() {
    return v;
  }, createExhaustiveSearchParamsProxy: function() {
    return E;
  }, createExhaustiveURLSearchParamsProxy: function() {
    return R;
  }, createHeadersFromSample: function() {
    return P;
  }, createRelativeURLFromSamples: function() {
    return w;
  }, createValidationSampleTracking: function() {
    return m;
  }, trackMissingSampleError: function() {
    return h;
  }, trackMissingSampleErrorAndThrow: function() {
    return g;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(96883), i = e.r(97270), s = e.r(87720), l = e.r(1643), c = e.r(90929), u = e.r(12718), d = e.r(13770), f = e.r(62141), p = e.r(65932);
  function m() {
    return { missingSampleErrors: [] };
  }
  function h(e2) {
    (function() {
      let e3 = null, t2 = f.workUnitAsyncStorage.getStore();
      if (t2) switch (t2.type) {
        case "request":
        case "validation-client":
          e3 = t2.validationSampleTracking ?? null;
      }
      if (!e3) throw Object.defineProperty(new u.InvariantError("Expected to have a workUnitStore that provides validationSampleTracking"), "__NEXT_ERROR_CODE", { value: "E1110", enumerable: false, configurable: true });
      return e3;
    })().missingSampleErrors.push(e2);
  }
  function g(e2) {
    throw h(e2), e2;
  }
  function y(e2, t2) {
    let r2 = /* @__PURE__ */ new Set(), n2 = new o.RequestCookies(new Headers());
    if (e2) for (let t3 of e2) r2.add(t3.name), null !== t3.value && n2.set(t3.name, t3.value);
    return new Proxy(i.RequestCookiesAdapter.seal(n2), { get(e3, n3, a2) {
      if ("has" === n3) {
        let o2 = Reflect.get(e3, n3, a2);
        return function(n4) {
          return r2.has(n4) || g(b(t2, n4)), o2.call(e3, n4);
        };
      }
      if ("get" === n3) {
        let o2 = Reflect.get(e3, n3, a2);
        return function(n4) {
          let a3;
          if ("string" == typeof n4) a3 = n4;
          else {
            if (!n4 || "object" != typeof n4 || "string" != typeof n4.name) return o2.call(e3, n4);
            a3 = n4.name;
          }
          return r2.has(a3) || g(b(t2, a3)), o2.call(e3, a3);
        };
      }
      return Reflect.get(e3, n3, a2);
    } });
  }
  function b(e2, t2) {
    return Object.defineProperty(new d.InstantValidationError(`Route "${e2}" accessed cookie "${t2}" which is not defined in the \`samples\` of \`unstable_instant\`. Add it to the sample's \`cookies\` array, or \`{ name: "${t2}", value: null }\` if it should be absent.`), "__NEXT_ERROR_CODE", { value: "E1115", enumerable: false, configurable: true });
  }
  function P(e2, t2, r2) {
    let n2 = e2 ? [...e2] : [];
    if (n2.find(([e3]) => "cookie" === e3.toLowerCase())) throw Object.defineProperty(new d.InstantValidationError('Invalid sample: Defining cookies via a "cookie" header is not supported. Use `cookies: [{ name: ..., value: ... }]` instead.'), "__NEXT_ERROR_CODE", { value: "E1111", enumerable: false, configurable: true });
    if (t2) {
      let e3 = t2.toString();
      n2.push(["cookie", "" !== e3 ? e3 : null]);
    }
    let a2 = /* @__PURE__ */ new Set(), o2 = {};
    for (let [e3, t3] of n2) a2.add(e3.toLowerCase()), null !== t3 && (o2[e3.toLowerCase()] = t3);
    return new Proxy(s.HeadersAdapter.seal(s.HeadersAdapter.from(o2)), { get(e3, t3, n3) {
      if ("get" === t3 || "has" === t3) {
        let o3 = Reflect.get(e3, t3, n3);
        return function(t4) {
          let n4 = t4.toLowerCase();
          return a2.has(n4) || g(Object.defineProperty(new d.InstantValidationError(`Route "${r2}" accessed header "${n4}" which is not defined in the \`samples\` of \`unstable_instant\`. Add it to the sample's \`headers\` array, or \`["${n4}", null]\` if it should be absent.`), "__NEXT_ERROR_CODE", { value: "E1116", enumerable: false, configurable: true })), o3.call(e3, n4);
        };
      }
      return Reflect.get(e3, t3, n3);
    } });
  }
  function _() {
    return { get isEnabled() {
      return false;
    }, enable() {
      throw Object.defineProperty(Error("Draft mode cannot be enabled during build-time instant validation."), "__NEXT_ERROR_CODE", { value: "E1092", enumerable: false, configurable: true });
    }, disable() {
      throw Object.defineProperty(Error("Draft mode cannot be disabled during build-time instant validation."), "__NEXT_ERROR_CODE", { value: "E1094", enumerable: false, configurable: true });
    } };
  }
  function v(e2, t2, r2) {
    return new Proxy(e2, { get: (n2, a2, o2) => ("string" == typeof a2 && !p.wellKnownProperties.has(a2) && a2 in e2 && !t2.has(a2) && g(Object.defineProperty(new d.InstantValidationError(`Route "${r2}" accessed param "${a2}" which is not defined in the \`samples\` of \`unstable_instant\`. Add it to the sample's \`params\` object.`), "__NEXT_ERROR_CODE", { value: "E1095", enumerable: false, configurable: true })), Reflect.get(n2, a2, o2)) });
  }
  function E(e2, t2, r2) {
    return new Proxy(e2, { get: (e3, n2, a2) => ("string" != typeof n2 || p.wellKnownProperties.has(n2) || t2.has(n2) || g(O(r2, n2)), Reflect.get(e3, n2, a2)), has: (e3, n2) => ("string" != typeof n2 || p.wellKnownProperties.has(n2) || t2.has(n2) || g(O(r2, n2)), Reflect.has(e3, n2)) });
  }
  function R(e2, t2, r2) {
    return new Proxy(e2, { get(e3, n2, a2) {
      if ("get" === n2 || "getAll" === n2 || "has" === n2) {
        let o3 = Reflect.get(e3, n2, a2);
        return (n3) => ("string" != typeof n3 || t2.has(n3) || g(O(r2, n3)), o3.call(e3, n3));
      }
      let o2 = Reflect.get(e3, n2, a2);
      return "function" != typeof o2 || Object.hasOwn(e3, n2) ? o2 : o2.bind(e3);
    } });
  }
  function O(e2, t2) {
    return Object.defineProperty(new d.InstantValidationError(`Route "${e2}" accessed searchParam "${t2}" which is not defined in the \`samples\` of \`unstable_instant\`. Add it to the sample's \`searchParams\` object, or \`{ "${t2}": null }\` if it should be absent.`), "__NEXT_ERROR_CODE", { value: "E1098", enumerable: false, configurable: true });
  }
  function w(e2, t2, r2) {
    let n2 = (function(e3, t3) {
      let r3 = [];
      for (let n3 of e3.split("/")) {
        let e4 = (0, l.getSegmentParam)(n3);
        if (e4) switch (e4.paramType) {
          case "catchall":
          case "optional-catchall": {
            let a3 = t3[e4.paramName];
            if (void 0 === a3) a3 = [n3];
            else if (!Array.isArray(a3)) throw Object.defineProperty(new d.InstantValidationError(`Expected sample param value for segment '${n3}' to be an array of strings, got ${typeof a3}`), "__NEXT_ERROR_CODE", { value: "E1104", enumerable: false, configurable: true });
            r3.push(...a3.map((e5) => encodeURIComponent(e5)));
            break;
          }
          case "dynamic": {
            let a3 = t3[e4.paramName];
            if (void 0 === a3) a3 = n3;
            else if ("string" != typeof a3) throw Object.defineProperty(new d.InstantValidationError(`Expected sample param value for segment '${n3}' to be a string, got ${typeof a3}`), "__NEXT_ERROR_CODE", { value: "E1108", enumerable: false, configurable: true });
            r3.push(encodeURIComponent(a3));
            break;
          }
          case "catchall-intercepted-(..)(..)":
          case "catchall-intercepted-(.)":
          case "catchall-intercepted-(..)":
          case "catchall-intercepted-(...)":
          case "dynamic-intercepted-(..)(..)":
          case "dynamic-intercepted-(.)":
          case "dynamic-intercepted-(..)":
          case "dynamic-intercepted-(...)":
            throw Object.defineProperty(new u.InvariantError("Not implemented: Validation of interception routes"), "__NEXT_ERROR_CODE", { value: "E1106", enumerable: false, configurable: true });
          default:
            e4.paramType;
        }
        else r3.push(n3);
      }
      return r3.join("/");
    })(e2, t2 ?? {}), a2 = "";
    if (r2) {
      let e3 = (function(e4) {
        let t3 = new URLSearchParams();
        if (e4) {
          for (let [r3, n3] of Object.entries(e4)) if (null != n3) if (Array.isArray(n3)) for (let e5 of n3) t3.append(r3, e5);
          else t3.set(r3, n3);
        }
        return t3;
      })(r2).toString();
      e3 && (a2 = "?" + e3);
    }
    return (0, c.parseRelativeUrl)(n2 + a2, void 0, true);
  }
  function S(e2, t2, r2) {
    if (t2 && r2 in t2) ;
    else {
      let t3 = e2.route;
      g(Object.defineProperty(new d.InstantValidationError(`Route "${t3}" accessed root param "${r2}" which is not defined in the \`samples\` of \`unstable_instant\`. Add it to the sample's \`params\` object.`), "__NEXT_ERROR_CODE", { value: "E1114", enumerable: false, configurable: true }));
    }
  }
}, 69882, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { createPrerenderSearchParamsForClientPage: function() {
    return P;
  }, createSearchParamsFromClient: function() {
    return g;
  }, createServerSearchParamsForMetadata: function() {
    return y;
  }, createServerSearchParamsForServerPage: function() {
    return b;
  }, makeErroringSearchParamsForUseCache: function() {
    return O;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(63599), i = e.r(66373), s = e.r(42715), l = e.r(67673), c = e.r(62141), u = e.r(12718), d = e.r(63138), f = e.r(76361), p = e.r(65932), m = e.r(50999), h = e.r(42852);
  function g(t2) {
    let r2 = o.workAsyncStorage.getStore();
    if (!r2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    let n2 = c.workUnitAsyncStorage.getStore();
    if (n2) switch (n2.type) {
      case "prerender":
      case "prerender-client":
      case "prerender-ppr":
      case "prerender-legacy":
        return _(r2, n2);
      case "validation-client":
        return (function(t3, r3, n3) {
          var a2;
          let { createExhaustiveSearchParamsProxy: o2 } = e.r(18450);
          return Promise.resolve(t3 = o2(t3, new Set(Object.keys((null == (a2 = n3.validationSamples) ? void 0 : a2.searchParams) ?? {})), r3.route));
        })(t2, r2, n2);
      case "prerender-runtime":
        throw Object.defineProperty(new u.InvariantError("createSearchParamsFromClient should not be called in a runtime prerender."), "__NEXT_ERROR_CODE", { value: "E769", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createSearchParamsFromClient should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E739", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createSearchParamsFromClient should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1133", enumerable: false, configurable: true });
      case "request":
        return v(t2, r2, n2, false);
    }
    (0, c.throwInvariantForMissingStore)();
  }
  function y(e2, t2) {
    return b(e2, (0, i.getMetadataVaryParamsAccumulator)(), t2);
  }
  function b(e2, t2, r2) {
    let n2 = o.workAsyncStorage.getStore();
    if (!n2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    let a2 = c.workUnitAsyncStorage.getStore();
    if (a2) switch (a2.type) {
      case "prerender":
      case "prerender-client":
      case "prerender-ppr":
      case "prerender-legacy":
        return _(n2, a2);
      case "validation-client":
        throw Object.defineProperty(new u.InvariantError("createServerSearchParamsForServerPage should not be called in a client validation."), "__NEXT_ERROR_CODE", { value: "E1066", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createServerSearchParamsForServerPage should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E747", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createServerSearchParamsForServerPage should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1128", enumerable: false, configurable: true });
      case "prerender-runtime":
        return (function(e3, t3, r3, n3) {
          let a3 = w(null !== r3 ? (0, i.createVaryingSearchParams)(r3, e3) : e3), { stagedRendering: o2 } = t3;
          if (!o2) return a3;
          let s2 = n3 ? h.RenderStage.EarlyRuntime : h.RenderStage.Runtime;
          return o2.waitForStage(s2).then(() => a3);
        })(e2, a2, t2, r2);
      case "request":
        return v(e2, n2, a2, r2);
    }
    (0, c.throwInvariantForMissingStore)();
  }
  function P() {
    let e2 = o.workAsyncStorage.getStore();
    if (!e2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    if (e2.forceStatic) return Promise.resolve({});
    let t2 = c.workUnitAsyncStorage.getStore();
    if (t2) switch (t2.type) {
      case "prerender":
      case "prerender-client":
        return (0, d.makeHangingPromise)(t2.renderSignal, e2.route, "`searchParams`");
      case "validation-client":
        throw Object.defineProperty(new u.InvariantError("createPrerenderSearchParamsForClientPage should not be called in a client validation."), "__NEXT_ERROR_CODE", { value: "E1061", enumerable: false, configurable: true });
      case "prerender-runtime":
        throw Object.defineProperty(new u.InvariantError("createPrerenderSearchParamsForClientPage should not be called in a runtime prerender."), "__NEXT_ERROR_CODE", { value: "E768", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createPrerenderSearchParamsForClientPage should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E746", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createPrerenderSearchParamsForClientPage should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1124", enumerable: false, configurable: true });
      case "prerender-ppr":
      case "prerender-legacy":
      case "request":
        return Promise.resolve({});
    }
    (0, c.throwInvariantForMissingStore)();
  }
  function _(e2, t2) {
    if (e2.forceStatic) return Promise.resolve({});
    switch (t2.type) {
      case "prerender":
      case "prerender-client":
        var r2 = e2, n2 = t2;
        let a2 = E.get(n2);
        if (a2) return a2;
        let o2 = (0, d.makeHangingPromise)(n2.renderSignal, r2.route, "`searchParams`"), i2 = new Proxy(o2, { get(e3, t3, r3) {
          if (Object.hasOwn(o2, t3)) return s.ReflectAdapter.get(e3, t3, r3);
          switch (t3) {
            case "then":
              return (0, l.annotateDynamicAccess)("`await searchParams`, `searchParams.then`, or similar", n2), s.ReflectAdapter.get(e3, t3, r3);
            case "status":
              return (0, l.annotateDynamicAccess)("`use(searchParams)`, `searchParams.status`, or similar", n2), s.ReflectAdapter.get(e3, t3, r3);
            default:
              return s.ReflectAdapter.get(e3, t3, r3);
          }
        } });
        return E.set(n2, i2), i2;
      case "prerender-ppr":
      case "prerender-legacy":
        var c2 = e2, u2 = t2;
        let f2 = E.get(c2);
        if (f2) return f2;
        let p2 = Promise.resolve({}), h2 = new Proxy(p2, { get(e3, t3, r3) {
          if (Object.hasOwn(p2, t3)) return s.ReflectAdapter.get(e3, t3, r3);
          if ("string" == typeof t3 && "then" === t3) {
            let e4 = "`await searchParams`, `searchParams.then`, or similar";
            c2.dynamicShouldError ? (0, m.throwWithStaticGenerationBailoutErrorWithDynamicError)(c2.route, e4) : "prerender-ppr" === u2.type ? (0, l.postponeWithTracking)(c2.route, e4, u2.dynamicTracking) : (0, l.throwToInterruptStaticGeneration)(e4, c2, u2);
          }
          return s.ReflectAdapter.get(e3, t3, r3);
        } });
        return E.set(c2, h2), h2;
      default:
        return t2;
    }
  }
  function v(t2, r2, n2, a2) {
    if (r2.forceStatic) return Promise.resolve({});
    if (!n2.asyncApiPromises) return w(t2);
    if (n2.validationSamples) {
      let { createExhaustiveSearchParamsProxy: a3 } = e.r(18450), o2 = new Set(Object.keys(n2.validationSamples.searchParams ?? {}));
      t2 = a3(t2, o2, r2.route);
    }
    return (a2 ? n2.asyncApiPromises.earlySharedSearchParamsParent : n2.asyncApiPromises.sharedSearchParamsParent).then(() => t2);
  }
  let E = /* @__PURE__ */ new WeakMap(), R = /* @__PURE__ */ new WeakMap();
  function O() {
    let e2 = o.workAsyncStorage.getStore();
    if (!e2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    let t2 = R.get(e2);
    if (t2) return t2;
    let r2 = Promise.resolve({}), n2 = new Proxy(r2, { get: function t3(n3, a2, o2) {
      return Object.hasOwn(r2, a2) || "string" != typeof a2 || "then" !== a2 && p.wellKnownProperties.has(a2) || (0, m.throwForSearchParamsAccessInUseCache)(e2, t3), s.ReflectAdapter.get(n3, a2, o2);
    } });
    return R.set(e2, n2), n2;
  }
  function w(e2) {
    let t2 = E.get(e2);
    if (t2) return t2;
    let r2 = Promise.resolve(e2);
    return E.set(e2, r2), r2;
  }
  (0, f.createDedupedByCallsiteServerErrorLoggerDev)(function(e2, t2) {
    let r2 = e2 ? `Route "${e2}" ` : "This route ";
    return Object.defineProperty(Error(`${r2}used ${t2}. \`searchParams\` is a Promise and must be unwrapped with \`await\` or \`React.use()\` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", { value: "E848", enumerable: false, configurable: true });
  });
}, 74804, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "dynamicAccessAsyncStorageInstance", { enumerable: true, get: function() {
    return n;
  } });
  let n = (0, e.r(90317).createAsyncLocalStorage)();
}, 88276, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "dynamicAccessAsyncStorage", { enumerable: true, get: function() {
    return n.dynamicAccessAsyncStorageInstance;
  } });
  let n = e.r(74804);
}, 41489, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { createParamsFromClient: function() {
    return g;
  }, createPrerenderParamsForClientSegment: function() {
    return _;
  }, createServerParamsForMetadata: function() {
    return y;
  }, createServerParamsForRoute: function() {
    return b;
  }, createServerParamsForServerSegment: function() {
    return P;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let o = e.r(63599), i = e.r(66373), s = e.r(42715), l = e.r(67673), c = e.r(62141), u = e.r(12718), d = e.r(65932), f = e.r(63138), p = e.r(76361), m = e.r(88276), h = e.r(42852);
  function g(e2) {
    let t2 = o.workAsyncStorage.getStore();
    if (!t2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    let r2 = c.workUnitAsyncStorage.getStore();
    if (r2) switch (r2.type) {
      case "prerender":
      case "prerender-client":
      case "prerender-ppr":
      case "prerender-legacy":
        return v(e2, null, t2, r2, null);
      case "validation-client":
        return R(e2, t2, r2.validationSamples);
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createParamsFromClient should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E736", enumerable: false, configurable: true });
      case "prerender-runtime":
        throw Object.defineProperty(new u.InvariantError("createParamsFromClient should not be called in a runtime prerender."), "__NEXT_ERROR_CODE", { value: "E770", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createParamsFromClient should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1122", enumerable: false, configurable: true });
      case "request":
        if (r2.validationSamples) return R(e2, t2, r2.validationSamples);
        return S(e2);
    }
    (0, c.throwInvariantForMissingStore)();
  }
  function y(e2, t2, r2) {
    return P(e2, t2, (0, i.getMetadataVaryParamsAccumulator)(), r2);
  }
  function b(e2, t2 = null) {
    let r2 = o.workAsyncStorage.getStore();
    if (!r2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    let n2 = c.workUnitAsyncStorage.getStore();
    if (n2) switch (n2.type) {
      case "prerender":
      case "prerender-ppr":
      case "prerender-legacy":
        return v(e2, null, r2, n2, t2);
      case "prerender-client":
      case "validation-client":
        throw Object.defineProperty(new u.InvariantError("createServerParamsForRoute should not be called in client contexts."), "__NEXT_ERROR_CODE", { value: "E1064", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createServerParamsForRoute should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E738", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createServerParamsForRoute should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1131", enumerable: false, configurable: true });
      case "prerender-runtime":
        return E(e2, null, n2, t2, false);
      case "request":
        return S(e2);
    }
    (0, c.throwInvariantForMissingStore)();
  }
  function P(t2, r2, n2, a2) {
    let i2 = o.workAsyncStorage.getStore();
    if (!i2) throw Object.defineProperty(new u.InvariantError("Expected workStore to be initialized"), "__NEXT_ERROR_CODE", { value: "E1068", enumerable: false, configurable: true });
    let s2 = c.workUnitAsyncStorage.getStore();
    if (s2) switch (s2.type) {
      case "prerender":
      case "prerender-client":
      case "prerender-ppr":
      case "prerender-legacy":
        return v(t2, r2, i2, s2, n2);
      case "validation-client":
        throw Object.defineProperty(new u.InvariantError("createServerParamsForServerSegment should not be called in client contexts."), "__NEXT_ERROR_CODE", { value: "E1101", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createServerParamsForServerSegment should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E743", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createServerParamsForServerSegment should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1120", enumerable: false, configurable: true });
      case "prerender-runtime":
        return E(t2, r2, s2, n2, a2);
      case "request":
        if (s2.asyncApiPromises && s2.validationSamples) return (function(t3, r3, n3, a3, o2) {
          let { createExhaustiveParamsProxy: i3 } = e.r(18450), s3 = i3(t3, new Set(Object.keys(n3.params ?? {})), r3.route);
          return (o2 ? a3.earlySharedParamsParent : a3.sharedParamsParent).then(() => s3);
        })(t2, i2, s2.validationSamples, s2.asyncApiPromises, a2);
        if (s2.asyncApiPromises && (function(e2, t3) {
          if (t3) {
            for (let r3 in e2) if (t3.has(r3)) return true;
          }
          return false;
        })(t2, s2.fallbackParams)) return (a2 ? s2.asyncApiPromises.earlySharedParamsParent : s2.asyncApiPromises.sharedParamsParent).then(() => t2);
        return S(t2);
    }
    (0, c.throwInvariantForMissingStore)();
  }
  function _(e2) {
    let t2 = o.workAsyncStorage.getStore();
    if (!t2) throw Object.defineProperty(new u.InvariantError("Missing workStore in createPrerenderParamsForClientSegment"), "__NEXT_ERROR_CODE", { value: "E773", enumerable: false, configurable: true });
    let r2 = c.workUnitAsyncStorage.getStore();
    if (r2) switch (r2.type) {
      case "prerender":
      case "prerender-client":
        let n2 = r2.fallbackRouteParams;
        if (n2) {
          for (let a2 in e2) if (n2.has(a2)) return (0, f.makeHangingPromise)(r2.renderSignal, t2.route, "`params`");
        }
        break;
      case "validation-client":
        throw Object.defineProperty(new u.InvariantError("createPrerenderParamsForClientSegment should not be called in validation contexts."), "__NEXT_ERROR_CODE", { value: "E1099", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
      case "unstable-cache":
        throw Object.defineProperty(new u.InvariantError("createPrerenderParamsForClientSegment should not be called in cache contexts."), "__NEXT_ERROR_CODE", { value: "E734", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new u.InvariantError("createPrerenderParamsForClientSegment should not be called inside generateStaticParams."), "__NEXT_ERROR_CODE", { value: "E1126", enumerable: false, configurable: true });
    }
    return Promise.resolve(e2);
  }
  function v(e2, t2, r2, n2, a2) {
    let o2 = null !== a2 ? (0, i.createVaryingParams)(a2, e2, t2) : e2;
    switch (n2.type) {
      case "prerender":
      case "prerender-client": {
        let t3 = n2.fallbackRouteParams;
        if (t3) {
          for (let a3 in e2) if (t3.has(a3)) return (function(e3, t4, r3) {
            let n3 = O.get(e3);
            if (n3) return n3;
            let a4 = new Proxy((0, f.makeHangingPromise)(r3.renderSignal, t4.route, "`params`"), w);
            return O.set(e3, a4), a4;
          })(o2, r2, n2);
        }
        break;
      }
      case "prerender-ppr": {
        let t3 = n2.fallbackRouteParams;
        if (t3) {
          for (let a3 in e2) if (t3.has(a3)) return (function(e3, t4, r3, n3) {
            let a4 = O.get(e3);
            if (a4) return a4;
            let o3 = { ...e3 }, i2 = Promise.resolve(o3);
            return O.set(e3, i2), Object.keys(e3).forEach((e4) => {
              d.wellKnownProperties.has(e4) || t4.has(e4) && Object.defineProperty(o3, e4, { get() {
                let t5 = (0, d.describeStringPropertyAccess)("params", e4);
                "prerender-ppr" === n3.type ? (0, l.postponeWithTracking)(r3.route, t5, n3.dynamicTracking) : (0, l.throwToInterruptStaticGeneration)(t5, r3, n3);
              }, enumerable: true });
            }), i2;
          })(o2, t3, r2, n2);
        }
      }
    }
    return S(o2);
  }
  function E(e2, t2, r2, n2, a2) {
    let o2 = S(null !== n2 ? (0, i.createVaryingParams)(n2, e2, t2) : e2), { stagedRendering: s2 } = r2;
    if (!s2) return o2;
    let l2 = a2 ? h.RenderStage.EarlyRuntime : h.RenderStage.Runtime;
    return s2.waitForStage(l2).then(() => o2);
  }
  function R(t2, r2, n2) {
    let { createExhaustiveParamsProxy: a2 } = e.r(18450);
    return Promise.resolve(a2(t2, new Set(Object.keys((null == n2 ? void 0 : n2.params) ?? {})), r2.route));
  }
  let O = /* @__PURE__ */ new WeakMap(), w = { get: function(e2, t2, r2) {
    if ("then" === t2 || "catch" === t2 || "finally" === t2) {
      let n2 = s.ReflectAdapter.get(e2, t2, r2);
      return { [t2]: (...t3) => {
        let r3 = m.dynamicAccessAsyncStorage.getStore();
        return r3 && r3.abortController.abort(Object.defineProperty(Error("Accessed fallback `params` during prerendering."), "__NEXT_ERROR_CODE", { value: "E691", enumerable: false, configurable: true })), new Proxy(n2.apply(e2, t3), w);
      } }[t2];
    }
    return s.ReflectAdapter.get(e2, t2, r2);
  } };
  function S(e2) {
    let t2 = O.get(e2);
    if (t2) return t2;
    let r2 = Promise.resolve(e2);
    return O.set(e2, r2), r2;
  }
  (0, p.createDedupedByCallsiteServerErrorLoggerDev)(function(e2, t2) {
    let r2 = e2 ? `Route "${e2}" ` : "This route ";
    return Object.defineProperty(Error(`${r2}used ${t2}. \`params\` is a Promise and must be unwrapped with \`await\` or \`React.use()\` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", { value: "E834", enumerable: false, configurable: true });
  });
}, 47257, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "ClientPageRoot", { enumerable: true, get: function() {
    return l;
  } });
  let n = e.r(43476), a = e.r(65347), o = e.r(71645), i = e.r(33906), s = e.r(61994);
  function l({ Component: t2, serverProvidedParams: r2 }) {
    let c, u;
    if (null !== r2) c = r2.searchParams, u = r2.params;
    else {
      let e2 = (0, o.use)(a.LayoutRouterContext);
      u = null !== e2 ? e2.parentParams : {}, c = (0, i.urlSearchParamsToParsedUrlQuery)((0, o.use)(s.SearchParamsContext));
    }
    if ("u" < typeof window) {
      let r3, a2, { createSearchParamsFromClient: o2 } = e.r(69882);
      r3 = o2(c);
      let { createParamsFromClient: i2 } = e.r(41489);
      return a2 = i2(u), (0, n.jsx)(t2, { params: a2, searchParams: r3 });
    }
    {
      let { createRenderSearchParamsFromClient: r3 } = e.r(66996), a2 = r3(c), { createRenderParamsFromClient: o2 } = e.r(97689), i2 = o2(u);
      return (0, n.jsx)(t2, { params: i2, searchParams: a2 });
    }
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 92825, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "ClientSegmentRoot", { enumerable: true, get: function() {
    return i;
  } });
  let n = e.r(43476), a = e.r(65347), o = e.r(71645);
  function i({ Component: t2, slots: r2, serverProvidedParams: s }) {
    let l;
    if (null !== s) l = s.params;
    else {
      let e2 = (0, o.use)(a.LayoutRouterContext);
      l = null !== e2 ? e2.parentParams : {};
    }
    if ("u" < typeof window) {
      let { createParamsFromClient: a2 } = e.r(41489), o2 = a2(l);
      return (0, n.jsx)(t2, { ...r2, params: o2 });
    }
    {
      let { createRenderParamsFromClient: a2 } = e.r(97689), o2 = a2(l);
      return (0, n.jsx)(t2, { ...r2, params: o2 });
    }
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 27201, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "IconMark", { enumerable: true, get: function() {
    return a;
  } });
  let n = e.r(43476), a = () => "u" > typeof window ? null : (0, n.jsx)("meta", { name: "\xABnxt-icon\xBB" });
}]);
