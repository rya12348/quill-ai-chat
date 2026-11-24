(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 32061, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { BailoutToCSRError: function() {
    return o;
  }, isBailoutToCSRError: function() {
    return s;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
  class o extends Error {
    constructor(e2) {
      super(`Bail out to client-side rendering: ${e2}`), this.reason = e2, this.digest = i;
    }
  }
  function s(e2) {
    return "object" == typeof e2 && null !== e2 && "digest" in e2 && e2.digest === i;
  }
}, 54394, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { HTTPAccessErrorStatus: function() {
    return i;
  }, HTTP_ERROR_FALLBACK_ERROR_CODE: function() {
    return s;
  }, getAccessFallbackErrorTypeByStatus: function() {
    return l;
  }, getAccessFallbackHTTPStatus: function() {
    return c;
  }, isHTTPAccessFallbackError: function() {
    return u;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = { NOT_FOUND: 404, FORBIDDEN: 403, UNAUTHORIZED: 401 }, o = new Set(Object.values(i)), s = "NEXT_HTTP_ERROR_FALLBACK";
  function u(e2) {
    if ("object" != typeof e2 || null === e2 || !("digest" in e2) || "string" != typeof e2.digest) return false;
    let [t2, r2] = e2.digest.split(";");
    return t2 === s && o.has(Number(r2));
  }
  function c(e2) {
    return Number(e2.digest.split(";")[1]);
  }
  function l(e2) {
    switch (e2) {
      case 401:
        return "unauthorized";
      case 403:
        return "forbidden";
      case 404:
        return "not-found";
      default:
        return;
    }
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 65713, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "isNextRouterError", { enumerable: true, get: function() {
    return i;
  } });
  let n = e.r(54394), a = e.r(68391);
  function i(e2) {
    return (0, a.isRedirectError)(e2) || (0, n.isHTTPAccessFallbackError)(e2);
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 3680, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "ReadonlyURLSearchParams", { enumerable: true, get: function() {
    return a;
  } });
  class n extends Error {
    constructor() {
      super("Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams");
    }
  }
  class a extends URLSearchParams {
    append() {
      throw new n();
    }
    delete() {
      throw new n();
    }
    set() {
      throw new n();
    }
    sort() {
      throw new n();
    }
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 61994, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { NavigationPromisesContext: function() {
    return l;
  }, PathParamsContext: function() {
    return c;
  }, PathnameContext: function() {
    return u;
  }, ReadonlyURLSearchParams: function() {
    return o.ReadonlyURLSearchParams;
  }, SearchParamsContext: function() {
    return s;
  }, createDevToolsInstrumentedPromise: function() {
    return d;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = e.r(71645), o = e.r(3680), s = (0, i.createContext)(null), u = (0, i.createContext)(null), c = (0, i.createContext)(null), l = (0, i.createContext)(null);
  function d(e2, t2) {
    let r2 = Promise.resolve(t2);
    return r2.status = "fulfilled", r2.value = t2, r2.displayName = `${e2} (SSR)`, r2;
  }
}, 45955, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "workUnitAsyncStorageInstance", { enumerable: true, get: function() {
    return n;
  } });
  let n = (0, e.r(90317).createAsyncLocalStorage)();
}, 42852, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n, a = { RenderStage: function() {
    return u;
  }, StagedRenderingController: function() {
    return c;
  } };
  for (var i in a) Object.defineProperty(r, i, { enumerable: true, get: a[i] });
  let o = e.r(12718), s = e.r(39470);
  var u = ((n = {})[n.Before = 1] = "Before", n[n.EarlyStatic = 2] = "EarlyStatic", n[n.Static = 3] = "Static", n[n.EarlyRuntime = 4] = "EarlyRuntime", n[n.Runtime = 5] = "Runtime", n[n.Dynamic = 6] = "Dynamic", n[n.Abandoned = 7] = "Abandoned", n);
  class c {
    constructor(e2, t2, r2) {
      this.abortSignal = e2, this.abandonController = t2, this.shouldTrackSyncIO = r2, this.currentStage = 1, this.syncInterruptReason = null, this.staticStageEndTime = 1 / 0, this.runtimeStageEndTime = 1 / 0, this.staticStageListeners = [], this.earlyRuntimeStageListeners = [], this.runtimeStageListeners = [], this.dynamicStageListeners = [], this.staticStagePromise = (0, s.createPromiseWithResolvers)(), this.earlyRuntimeStagePromise = (0, s.createPromiseWithResolvers)(), this.runtimeStagePromise = (0, s.createPromiseWithResolvers)(), this.dynamicStagePromise = (0, s.createPromiseWithResolvers)(), e2 && e2.addEventListener("abort", () => {
        let { reason: t3 } = e2;
        this.staticStagePromise.promise.catch(l), this.staticStagePromise.reject(t3), this.earlyRuntimeStagePromise.promise.catch(l), this.earlyRuntimeStagePromise.reject(t3), this.runtimeStagePromise.promise.catch(l), this.runtimeStagePromise.reject(t3), this.dynamicStagePromise.promise.catch(l), this.dynamicStagePromise.reject(t3);
      }, { once: true }), t2 && t2.signal.addEventListener("abort", () => {
        this.abandonRender();
      }, { once: true });
    }
    onStage(e2, t2) {
      if (this.currentStage >= e2) t2();
      else if (3 === e2) this.staticStageListeners.push(t2);
      else if (4 === e2) this.earlyRuntimeStageListeners.push(t2);
      else if (5 === e2) this.runtimeStageListeners.push(t2);
      else if (6 === e2) this.dynamicStageListeners.push(t2);
      else throw Object.defineProperty(new o.InvariantError(`Invalid render stage: ${e2}`), "__NEXT_ERROR_CODE", { value: "E881", enumerable: false, configurable: true });
    }
    shouldTrackSyncInterrupt() {
      if (!this.shouldTrackSyncIO) return false;
      switch (this.currentStage) {
        case 1:
        case 5:
        case 6:
        case 7:
        default:
          return false;
        case 2:
        case 3:
        case 4:
          return true;
      }
    }
    syncInterruptCurrentStageWithReason(e2) {
      if (1 !== this.currentStage && 7 !== this.currentStage) {
        if (this.abandonController) return void this.abandonController.abort();
        if (this.abortSignal) {
          this.syncInterruptReason = e2, this.currentStage = 7;
          return;
        }
        switch (this.currentStage) {
          case 2:
          case 3:
          case 4:
            this.syncInterruptReason = e2, this.advanceStage(6);
            return;
          case 5:
            return;
        }
      }
    }
    getSyncInterruptReason() {
      return this.syncInterruptReason;
    }
    getStaticStageEndTime() {
      return this.staticStageEndTime;
    }
    getRuntimeStageEndTime() {
      return this.runtimeStageEndTime;
    }
    abandonRender() {
      let { currentStage: e2 } = this;
      switch (e2) {
        case 2:
          this.resolveStaticStage();
        case 3:
          this.resolveEarlyRuntimeStage();
        case 4:
          this.resolveRuntimeStage();
        case 5:
          this.currentStage = 7;
          return;
      }
    }
    advanceStage(e2) {
      if (e2 <= this.currentStage) return;
      let t2 = this.currentStage;
      if (this.currentStage = e2, t2 < 3 && e2 >= 3 && this.resolveStaticStage(), t2 < 4 && e2 >= 4 && this.resolveEarlyRuntimeStage(), t2 < 5 && e2 >= 5 && (this.staticStageEndTime = performance.now() + performance.timeOrigin, this.resolveRuntimeStage()), t2 < 6 && e2 >= 6) {
        this.runtimeStageEndTime = performance.now() + performance.timeOrigin, this.resolveDynamicStage();
        return;
      }
    }
    resolveStaticStage() {
      let e2 = this.staticStageListeners;
      for (let t2 = 0; t2 < e2.length; t2++) e2[t2]();
      e2.length = 0, this.staticStagePromise.resolve();
    }
    resolveEarlyRuntimeStage() {
      let e2 = this.earlyRuntimeStageListeners;
      for (let t2 = 0; t2 < e2.length; t2++) e2[t2]();
      e2.length = 0, this.earlyRuntimeStagePromise.resolve();
    }
    resolveRuntimeStage() {
      let e2 = this.runtimeStageListeners;
      for (let t2 = 0; t2 < e2.length; t2++) e2[t2]();
      e2.length = 0, this.runtimeStagePromise.resolve();
    }
    resolveDynamicStage() {
      let e2 = this.dynamicStageListeners;
      for (let t2 = 0; t2 < e2.length; t2++) e2[t2]();
      e2.length = 0, this.dynamicStagePromise.resolve();
    }
    getStagePromise(e2) {
      switch (e2) {
        case 3:
          return this.staticStagePromise.promise;
        case 4:
          return this.earlyRuntimeStagePromise.promise;
        case 5:
          return this.runtimeStagePromise.promise;
        case 6:
          return this.dynamicStagePromise.promise;
        default:
          throw Object.defineProperty(new o.InvariantError(`Invalid render stage: ${e2}`), "__NEXT_ERROR_CODE", { value: "E881", enumerable: false, configurable: true });
      }
    }
    waitForStage(e2) {
      return this.getStagePromise(e2);
    }
    delayUntilStage(e2, t2, r2) {
      var n2, a2, i2;
      let o2, s2 = (n2 = this.getStagePromise(e2), a2 = t2, i2 = r2, o2 = new Promise((e3, t3) => {
        n2.then(e3.bind(null, i2), t3);
      }), void 0 !== a2 && (o2.displayName = a2), o2);
      return this.abortSignal && s2.catch(l), s2;
    }
  }
  function l() {
  }
}, 62141, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { getCacheSignal: function() {
    return b;
  }, getDraftModeProviderForCacheScope: function() {
    return g;
  }, getHmrRefreshHash: function() {
    return m;
  }, getPrerenderResumeDataCache: function() {
    return d;
  }, getRenderResumeDataCache: function() {
    return f;
  }, getServerComponentsHmrCache: function() {
    return p;
  }, getStagedRenderingController: function() {
    return y;
  }, isHmrRefresh: function() {
    return h;
  }, isInEarlyRenderStage: function() {
    return u;
  }, throwForMissingRequestStore: function() {
    return c;
  }, throwInvariantForMissingStore: function() {
    return l;
  }, workUnitAsyncStorage: function() {
    return i.workUnitAsyncStorageInstance;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = e.r(45955);
  e.r(84689);
  let o = e.r(12718), s = e.r(42852);
  function u(e2) {
    let t2 = e2.stagedRendering;
    return !!t2 && (t2.currentStage === s.RenderStage.EarlyStatic || t2.currentStage === s.RenderStage.EarlyRuntime);
  }
  function c(e2) {
    throw Object.defineProperty(Error(`\`${e2}\` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", { value: "E251", enumerable: false, configurable: true });
  }
  function l() {
    throw Object.defineProperty(new o.InvariantError("Expected workUnitAsyncStorage to have a store."), "__NEXT_ERROR_CODE", { value: "E696", enumerable: false, configurable: true });
  }
  function d(e2) {
    switch (e2.type) {
      case "prerender":
      case "prerender-runtime":
      case "prerender-ppr":
      case "prerender-client":
      case "validation-client":
        return e2.prerenderResumeDataCache;
      case "request":
        if (e2.prerenderResumeDataCache) return e2.prerenderResumeDataCache;
      case "prerender-legacy":
      case "cache":
      case "private-cache":
      case "unstable-cache":
      case "generate-static-params":
        return null;
      default:
        return e2;
    }
  }
  function f(e2) {
    switch (e2.type) {
      case "request":
      case "prerender":
      case "prerender-runtime":
      case "prerender-client":
      case "validation-client":
        if (e2.renderResumeDataCache) return e2.renderResumeDataCache;
      case "prerender-ppr":
        return e2.prerenderResumeDataCache ?? null;
      case "cache":
      case "private-cache":
      case "unstable-cache":
      case "prerender-legacy":
      case "generate-static-params":
        return null;
      default:
        return e2;
    }
  }
  function m(e2) {
  }
  function h(e2) {
    return false;
  }
  function p(e2) {
  }
  function g(e2, t2) {
    if (e2.isDraftMode) switch (t2.type) {
      case "cache":
      case "private-cache":
      case "unstable-cache":
      case "prerender-runtime":
      case "request":
        return t2.draftMode;
    }
  }
  function y(e2) {
    switch (e2.type) {
      case "request":
      case "prerender-runtime":
        return e2.stagedRendering ?? null;
      case "prerender":
      case "prerender-client":
      case "validation-client":
      case "prerender-ppr":
      case "prerender-legacy":
      case "cache":
      case "private-cache":
      case "unstable-cache":
      case "generate-static-params":
        return null;
      default:
        return e2;
    }
  }
  function b(e2) {
    switch (e2.type) {
      case "prerender":
      case "prerender-client":
      case "validation-client":
      case "prerender-runtime":
        return e2.cacheSignal;
      case "request":
        if (e2.cacheSignal) return e2.cacheSignal;
      case "prerender-ppr":
      case "prerender-legacy":
      case "cache":
      case "private-cache":
      case "unstable-cache":
      case "generate-static-params":
        return null;
      default:
        return e2;
    }
  }
}, 13957, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { ServerInsertedHTMLContext: function() {
    return o;
  }, useServerInsertedHTML: function() {
    return s;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = e.r(90809)._(e.r(71645)), o = i.default.createContext(null);
  function s(e2) {
    let t2 = (0, i.useContext)(o);
    t2 && t2(e2);
  }
}, 22783, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "notFound", { enumerable: true, get: function() {
    return i;
  } });
  let n = e.r(54394), a = `${n.HTTP_ERROR_FALLBACK_ERROR_CODE};404`;
  function i() {
    let e2 = Object.defineProperty(Error(a), "__NEXT_ERROR_CODE", { value: "E1041", enumerable: false, configurable: true });
    throw e2.digest = a, e2;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 79854, (e, t, r) => {
  "use strict";
  function n() {
    throw Object.defineProperty(Error("`forbidden()` is experimental and only allowed to be enabled when `experimental.authInterrupts` is enabled."), "__NEXT_ERROR_CODE", { value: "E488", enumerable: false, configurable: true });
  }
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "forbidden", { enumerable: true, get: function() {
    return n;
  } }), e.r(54394).HTTP_ERROR_FALLBACK_ERROR_CODE, ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 22683, (e, t, r) => {
  "use strict";
  function n() {
    throw Object.defineProperty(Error("`unauthorized()` is experimental and only allowed to be used when `experimental.authInterrupts` is enabled."), "__NEXT_ERROR_CODE", { value: "E411", enumerable: false, configurable: true });
  }
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "unauthorized", { enumerable: true, get: function() {
    return n;
  } }), e.r(54394).HTTP_ERROR_FALLBACK_ERROR_CODE, ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 15507, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "unstable_rethrow", { enumerable: true, get: function() {
    return function e2(t2) {
      if ((0, a.isNextRouterError)(t2) || (0, n.isBailoutToCSRError)(t2)) throw t2;
      t2 instanceof Error && "cause" in t2 && e2(t2.cause);
    };
  } });
  let n = e.r(32061), a = e.r(65713);
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 63138, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { delayUntilRuntimeStage: function() {
    return h;
  }, getRuntimeStage: function() {
    return m;
  }, isHangingPromiseRejectionError: function() {
    return o;
  }, makeDevtoolsIOAwarePromise: function() {
    return f;
  }, makeHangingPromise: function() {
    return l;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = e.r(42852);
  function o(e2) {
    return "object" == typeof e2 && null !== e2 && "digest" in e2 && e2.digest === s;
  }
  let s = "HANGING_PROMISE_REJECTION";
  class u extends Error {
    constructor(e2, t2) {
      super(`During prerendering, ${t2} rejects when the prerender is complete. Typically these errors are handled by React but if you move ${t2} to a different context by using \`setTimeout\`, \`after\`, or similar functions you may observe this error and you should handle it in that context. This occurred at route "${e2}".`), this.route = e2, this.expression = t2, this.digest = s;
    }
  }
  let c = /* @__PURE__ */ new WeakMap();
  function l(e2, t2, r2) {
    if (e2.aborted) return Promise.reject(new u(t2, r2));
    {
      let n2 = new Promise((n3, a2) => {
        let i2 = a2.bind(null, new u(t2, r2)), o2 = c.get(e2);
        if (o2) o2.push(i2);
        else {
          let t3 = [i2];
          c.set(e2, t3), e2.addEventListener("abort", () => {
            for (let e3 = 0; e3 < t3.length; e3++) t3[e3]();
          }, { once: true });
        }
      });
      return n2.catch(d), n2;
    }
  }
  function d() {
  }
  function f(e2, t2, r2) {
    return t2.stagedRendering ? t2.stagedRendering.delayUntilStage(r2, void 0, e2) : new Promise((t3) => {
      setTimeout(() => {
        t3(e2);
      }, 0);
    });
  }
  function m(e2) {
    return e2.currentStage === i.RenderStage.EarlyStatic || e2.currentStage === i.RenderStage.EarlyRuntime ? i.RenderStage.EarlyRuntime : i.RenderStage.Runtime;
  }
  function h(e2, t2) {
    let { stagedRendering: r2 } = e2;
    return r2 ? r2.waitForStage(m(r2)).then(() => t2) : t2;
  }
}, 67287, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "isPostpone", { enumerable: true, get: function() {
    return a;
  } });
  let n = /* @__PURE__ */ Symbol.for("react.postpone");
  function a(e2) {
    return "object" == typeof e2 && null !== e2 && e2.$$typeof === n;
  }
}, 76353, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { DynamicServerError: function() {
    return o;
  }, isDynamicServerError: function() {
    return s;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = "DYNAMIC_SERVER_USAGE";
  class o extends Error {
    constructor(e2) {
      super(`Dynamic server usage: ${e2}`), this.description = e2, this.digest = i;
    }
  }
  function s(e2) {
    return "object" == typeof e2 && null !== e2 && "digest" in e2 && "string" == typeof e2.digest && e2.digest === i;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 43248, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { StaticGenBailoutError: function() {
    return o;
  }, isStaticGenBailoutError: function() {
    return s;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = "NEXT_STATIC_GEN_BAILOUT";
  class o extends Error {
    constructor(...e2) {
      super(...e2), this.code = i;
    }
  }
  function s(e2) {
    return "object" == typeof e2 && null !== e2 && "code" in e2 && e2.code === i;
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 54839, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { METADATA_BOUNDARY_NAME: function() {
    return i;
  }, OUTLET_BOUNDARY_NAME: function() {
    return s;
  }, ROOT_LAYOUT_BOUNDARY_NAME: function() {
    return u;
  }, VIEWPORT_BOUNDARY_NAME: function() {
    return o;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = "__next_metadata_boundary__", o = "__next_viewport_boundary__", s = "__next_outlet_boundary__", u = "__next_root_layout_boundary__";
}, 29419, (e, t, r) => {
  "use strict";
  var n = e.i(47167);
  Object.defineProperty(r, "__esModule", { value: true });
  var a = { atLeastOneTask: function() {
    return u;
  }, scheduleImmediate: function() {
    return s;
  }, scheduleOnNextTick: function() {
    return o;
  }, waitAtLeastOneReactRenderTask: function() {
    return c;
  } };
  for (var i in a) Object.defineProperty(r, i, { enumerable: true, get: a[i] });
  let o = (e2) => {
    Promise.resolve().then(() => {
      n.default.nextTick(e2);
    });
  }, s = (e2) => {
    setImmediate(e2);
  };
  function u() {
    return new Promise((e2) => s(e2));
  }
  function c() {
    return new Promise((e2) => setImmediate(e2));
  }
}, 2897, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "INSTANT_VALIDATION_BOUNDARY_NAME", { enumerable: true, get: function() {
    return n;
  } });
  let n = "__next_instant_validation_boundary__";
}, 67673, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n, a, i, o = { DynamicHoleKind: function() {
    return Z;
  }, Postpone: function() {
    return T;
  }, PreludeState: function() {
    return ei;
  }, abortAndThrowOnSynchronousRequestDataAccess: function() {
    return D;
  }, abortOnSynchronousPlatformIOAccess: function() {
    return j;
  }, accessedDynamicData: function() {
    return L;
  }, annotateDynamicAccess: function() {
    return H;
  }, consumeDynamicAccess: function() {
    return $;
  }, createDynamicTrackingState: function() {
    return E;
  }, createDynamicValidationState: function() {
    return R;
  }, createHangingInputAbortSignal: function() {
    return X;
  }, createInstantValidationState: function() {
    return Q;
  }, createRenderInBrowserAbortSignal: function() {
    return B;
  }, formatDynamicAPIAccesses: function() {
    return U;
  }, getFirstDynamicReason: function() {
    return v;
  }, getNavigationDisallowedDynamicReasons: function() {
    return ec;
  }, getStaticShellDisallowedDynamicReasons: function() {
    return eu;
  }, isDynamicPostpone: function() {
    return C;
  }, isPrerenderInterruptedError: function() {
    return I;
  }, logDisallowedDynamicError: function() {
    return eo;
  }, markCurrentScopeAsDynamic: function() {
    return S;
  }, postponeWithTracking: function() {
    return x;
  }, throwIfDisallowedDynamic: function() {
    return es;
  }, throwToInterruptStaticGeneration: function() {
    return O;
  }, trackAllowedDynamicAccess: function() {
    return J;
  }, trackDynamicDataInDynamicRender: function() {
    return w;
  }, trackDynamicHoleInNavigation: function() {
    return ee;
  }, trackDynamicHoleInRuntimeShell: function() {
    return er;
  }, trackDynamicHoleInStaticShell: function() {
    return en;
  }, trackThrownErrorInNavigation: function() {
    return et;
  }, useDynamicRouteParams: function() {
    return F;
  }, useDynamicSearchParams: function() {
    return W;
  } };
  for (var s in o) Object.defineProperty(r, s, { enumerable: true, get: o[s] });
  let u = (n = e.r(71645)) && n.__esModule ? n : { default: n }, c = e.r(76353), l = e.r(43248), d = e.r(62141), f = e.r(63599), m = e.r(63138), h = e.r(54839), p = e.r(29419), g = e.r(32061), y = e.r(12718), b = e.r(2897), _ = "function" == typeof u.default.unstable_postpone;
  function E(e2) {
    return { isDebugDynamicAccesses: e2, dynamicAccesses: [], syncDynamicErrorWithStack: null };
  }
  function R() {
    return { hasSuspenseAboveBody: false, hasDynamicMetadata: false, dynamicMetadata: null, hasDynamicViewport: false, hasAllowedDynamic: false, dynamicErrors: [] };
  }
  function v(e2) {
    var t2;
    return null == (t2 = e2.dynamicAccesses[0]) ? void 0 : t2.expression;
  }
  function S(e2, t2, r2) {
    if (t2) switch (t2.type) {
      case "cache":
      case "unstable-cache":
      case "private-cache":
        return;
    }
    if (!e2.forceDynamic && !e2.forceStatic) {
      if (e2.dynamicShouldError) throw Object.defineProperty(new l.StaticGenBailoutError(`Route ${e2.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`${r2}\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", { value: "E553", enumerable: false, configurable: true });
      if (t2) switch (t2.type) {
        case "prerender-ppr":
          return x(e2.route, r2, t2.dynamicTracking);
        case "prerender-legacy":
          t2.revalidate = 0;
          let n2 = Object.defineProperty(new c.DynamicServerError(`Route ${e2.route} couldn't be rendered statically because it used ${r2}. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", { value: "E550", enumerable: false, configurable: true });
          throw e2.dynamicUsageDescription = r2, e2.dynamicUsageStack = n2.stack, n2;
      }
    }
  }
  function O(e2, t2, r2) {
    let n2 = Object.defineProperty(new c.DynamicServerError(`Route ${t2.route} couldn't be rendered statically because it used \`${e2}\`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", { value: "E558", enumerable: false, configurable: true });
    throw r2.revalidate = 0, t2.dynamicUsageDescription = e2, t2.dynamicUsageStack = n2.stack, n2;
  }
  function w(e2) {
    switch (e2.type) {
      case "cache":
      case "unstable-cache":
      case "private-cache":
        return;
    }
  }
  function P(e2, t2, r2) {
    let n2 = M(`Route ${e2} needs to bail out of prerendering at this point because it used ${t2}.`);
    r2.controller.abort(n2);
    let a2 = r2.dynamicTracking;
    a2 && a2.dynamicAccesses.push({ stack: a2.isDebugDynamicAccesses ? Error().stack : void 0, expression: t2 });
  }
  function j(e2, t2, r2, n2) {
    let a2 = n2.dynamicTracking;
    P(e2, t2, n2), a2 && null === a2.syncDynamicErrorWithStack && (a2.syncDynamicErrorWithStack = r2);
  }
  function D(e2, t2, r2, n2) {
    if (false === n2.controller.signal.aborted) {
      P(e2, t2, n2);
      let a2 = n2.dynamicTracking;
      a2 && null === a2.syncDynamicErrorWithStack && (a2.syncDynamicErrorWithStack = r2);
    }
    throw M(`Route ${e2} needs to bail out of prerendering at this point because it used ${t2}.`);
  }
  function T({ reason: e2, route: t2 }) {
    let r2 = d.workUnitAsyncStorage.getStore();
    x(t2, e2, r2 && "prerender-ppr" === r2.type ? r2.dynamicTracking : null);
  }
  function x(e2, t2, r2) {
    (function() {
      if (!_) throw Object.defineProperty(Error("Invariant: React.unstable_postpone is not defined. This suggests the wrong version of React was loaded. This is a bug in Next.js"), "__NEXT_ERROR_CODE", { value: "E224", enumerable: false, configurable: true });
    })(), r2 && r2.dynamicAccesses.push({ stack: r2.isDebugDynamicAccesses ? Error().stack : void 0, expression: t2 }), u.default.unstable_postpone(A(e2, t2));
  }
  function A(e2, t2) {
    return `Route ${e2} needs to bail out of prerendering at this point because it used ${t2}. React throws this special object to indicate where. It should not be caught by your own try/catch. Learn more: https://nextjs.org/docs/messages/ppr-caught-error`;
  }
  function C(e2) {
    return "object" == typeof e2 && null !== e2 && "string" == typeof e2.message && N(e2.message);
  }
  function N(e2) {
    return e2.includes("needs to bail out of prerendering at this point because it used") && e2.includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error");
  }
  if (false === N(A("%%%", "^^^"))) throw Object.defineProperty(Error("Invariant: isDynamicPostpone misidentified a postpone reason. This is a bug in Next.js"), "__NEXT_ERROR_CODE", { value: "E296", enumerable: false, configurable: true });
  let k = "NEXT_PRERENDER_INTERRUPTED";
  function M(e2) {
    let t2 = Object.defineProperty(Error(e2), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
    return t2.digest = k, t2;
  }
  function I(e2) {
    return "object" == typeof e2 && null !== e2 && e2.digest === k && "name" in e2 && "message" in e2 && e2 instanceof Error;
  }
  function L(e2) {
    return e2.length > 0;
  }
  function $(e2, t2) {
    return e2.dynamicAccesses.push(...t2.dynamicAccesses), e2.dynamicAccesses;
  }
  function U(e2) {
    return e2.filter((e3) => "string" == typeof e3.stack && e3.stack.length > 0).map(({ expression: e3, stack: t2 }) => (t2 = t2.split("\n").slice(4).filter((e4) => !(e4.includes("node_modules/next/") || e4.includes(" (<anonymous>)") || e4.includes(" (node:"))).join("\n"), `Dynamic API Usage Debug - ${e3}:
${t2}`));
  }
  function B() {
    let e2 = new AbortController();
    return e2.abort(Object.defineProperty(new g.BailoutToCSRError("Render in Browser"), "__NEXT_ERROR_CODE", { value: "E721", enumerable: false, configurable: true })), e2.signal;
  }
  function X(e2) {
    switch (e2.type) {
      case "prerender":
      case "prerender-runtime":
        let t2 = new AbortController();
        if (e2.cacheSignal) e2.cacheSignal.inputReady().then(() => {
          t2.abort();
        });
        else if ("prerender-runtime" === e2.type && e2.stagedRendering) {
          let { stagedRendering: r2 } = e2;
          r2.waitForStage((0, m.getRuntimeStage)(r2)).then(() => (0, p.scheduleOnNextTick)(() => t2.abort()));
        } else (0, p.scheduleOnNextTick)(() => t2.abort());
        return t2.signal;
      case "prerender-client":
      case "validation-client":
      case "prerender-ppr":
      case "prerender-legacy":
      case "request":
      case "cache":
      case "private-cache":
      case "unstable-cache":
      case "generate-static-params":
        return;
    }
  }
  function H(e2, t2) {
    let r2 = t2.dynamicTracking;
    r2 && r2.dynamicAccesses.push({ stack: r2.isDebugDynamicAccesses ? Error().stack : void 0, expression: e2 });
  }
  function F(e2) {
    let t2 = f.workAsyncStorage.getStore(), r2 = d.workUnitAsyncStorage.getStore();
    if (t2 && r2) switch (r2.type) {
      case "prerender-client":
      case "prerender": {
        let n2 = r2.fallbackRouteParams;
        n2 && n2.size > 0 && u.default.use((0, m.makeHangingPromise)(r2.renderSignal, t2.route, e2));
        break;
      }
      case "prerender-ppr": {
        let n2 = r2.fallbackRouteParams;
        if (n2 && n2.size > 0) return x(t2.route, e2, r2.dynamicTracking);
        break;
      }
      case "validation-client":
      case "prerender-legacy":
      case "request":
      case "unstable-cache":
        break;
      case "prerender-runtime":
        throw Object.defineProperty(new y.InvariantError(`\`${e2}\` was called during a runtime prerender. Next.js should be preventing ${e2} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", { value: "E771", enumerable: false, configurable: true });
      case "cache":
      case "private-cache":
        throw Object.defineProperty(new y.InvariantError(`\`${e2}\` was called inside a cache scope. Next.js should be preventing ${e2} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", { value: "E745", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new y.InvariantError(`\`${e2}\` was called in \`generateStaticParams\`. Next.js should be preventing ${e2} from being included in server component files statically, but did not in this case.`), "__NEXT_ERROR_CODE", { value: "E1130", enumerable: false, configurable: true });
    }
  }
  function W(e2) {
    let t2 = f.workAsyncStorage.getStore(), r2 = d.workUnitAsyncStorage.getStore();
    if (t2) switch (!r2 && (0, d.throwForMissingRequestStore)(e2), r2.type) {
      case "validation-client":
      case "request":
        return;
      case "prerender-client":
        u.default.use((0, m.makeHangingPromise)(r2.renderSignal, t2.route, e2));
        break;
      case "prerender-legacy":
      case "prerender-ppr":
        if (t2.forceStatic) return;
        throw Object.defineProperty(new g.BailoutToCSRError(e2), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
      case "prerender":
      case "prerender-runtime":
        throw Object.defineProperty(new y.InvariantError(`\`${e2}\` was called from a Server Component. Next.js should be preventing ${e2} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", { value: "E795", enumerable: false, configurable: true });
      case "cache":
      case "unstable-cache":
      case "private-cache":
        throw Object.defineProperty(new y.InvariantError(`\`${e2}\` was called inside a cache scope. Next.js should be preventing ${e2} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", { value: "E745", enumerable: false, configurable: true });
      case "generate-static-params":
        throw Object.defineProperty(new y.InvariantError(`\`${e2}\` was called in \`generateStaticParams\`. Next.js should be preventing ${e2} from being included in server component files statically, but did not in this case.`), "__NEXT_ERROR_CODE", { value: "E1130", enumerable: false, configurable: true });
    }
  }
  let z = /\n\s+at Suspense \(<anonymous>\)/, V = RegExp(`\\n\\s+at Suspense \\(<anonymous>\\)(?:(?!\\n\\s+at (?:body|div|main|section|article|aside|header|footer|nav|form|p|span|h1|h2|h3|h4|h5|h6) \\(<anonymous>\\))[\\s\\S])*?\\n\\s+at ${h.ROOT_LAYOUT_BOUNDARY_NAME} \\([^\\n]*\\)`), q = RegExp(`\\n\\s+at ${h.METADATA_BOUNDARY_NAME}[\\n\\s]`), G = RegExp(`\\n\\s+at ${h.VIEWPORT_BOUNDARY_NAME}[\\n\\s]`), Y = RegExp(`\\n\\s+at ${h.OUTLET_BOUNDARY_NAME}[\\n\\s]`), K = RegExp(`\\n\\s+at ${b.INSTANT_VALIDATION_BOUNDARY_NAME}[\\n\\s]`);
  function J(e2, t2, r2, n2) {
    if (!Y.test(t2)) {
      if (q.test(t2)) {
        r2.hasDynamicMetadata = true;
        return;
      }
      if (G.test(t2)) {
        r2.hasDynamicViewport = true;
        return;
      }
      if (V.test(t2)) {
        r2.hasAllowedDynamic = true, r2.hasSuspenseAboveBody = true;
        return;
      } else if (z.test(t2)) {
        r2.hasAllowedDynamic = true;
        return;
      } else {
        if (n2.syncDynamicErrorWithStack) return void r2.dynamicErrors.push(n2.syncDynamicErrorWithStack);
        let a2 = ea(Object.defineProperty(Error(`Route "${e2.route}": Uncached data was accessed outside of <Suspense>. This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/blocking-route`), "__NEXT_ERROR_CODE", { value: "E1079", enumerable: false, configurable: true }), t2, null);
        return void r2.dynamicErrors.push(a2);
      }
    }
  }
  var Z = ((a = {})[a.Runtime = 1] = "Runtime", a[a.Dynamic = 2] = "Dynamic", a);
  function Q(e2) {
    return { hasDynamicMetadata: false, hasAllowedClientDynamicAboveBoundary: false, dynamicMetadata: null, hasDynamicViewport: false, hasAllowedDynamic: false, dynamicErrors: [], validationPreventingErrors: [], thrownErrorsOutsideBoundary: [], createInstantStack: e2 };
  }
  function ee(e2, t2, r2, n2, a2, i2) {
    if (Y.test(t2)) return;
    if (q.test(t2)) {
      let n3 = ea(Object.defineProperty(Error(`Route "${e2.route}": ${1 === a2 ? "Runtime data such as `cookies()`, `headers()`, `params`, or `searchParams` was accessed inside `generateMetadata` or you have file-based metadata such as icons that depend on dynamic params segments." : "Uncached data or `connection()` was accessed inside `generateMetadata`."} Except for this instance, the page would have been entirely prerenderable which may have been the intended behavior. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-metadata`), "__NEXT_ERROR_CODE", { value: "E1076", enumerable: false, configurable: true }), t2, r2.createInstantStack);
      r2.dynamicMetadata = n3;
      return;
    }
    if (G.test(t2)) {
      let n3 = ea(Object.defineProperty(Error(`Route "${e2.route}": ${1 === a2 ? "Runtime data such as `cookies()`, `headers()`, `params`, or `searchParams` was accessed inside `generateViewport`." : "Uncached data or `connection()` was accessed inside `generateViewport`."} This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/next-prerender-dynamic-viewport`), "__NEXT_ERROR_CODE", { value: "E1086", enumerable: false, configurable: true }), t2, r2.createInstantStack);
      r2.dynamicErrors.push(n3);
      return;
    }
    let o2 = K.exec(t2);
    if (o2) {
      let e3 = z.exec(t2);
      if (e3 && e3.index < o2.index) {
        r2.hasAllowedDynamic = true;
        return;
      }
    } else if (i2.expectedIds.size === i2.renderedIds.size) {
      r2.hasAllowedClientDynamicAboveBoundary = true, r2.hasAllowedDynamic = true;
      return;
    } else {
      let n3 = ea(Object.defineProperty(Error(`Route "${e2.route}": Could not validate \`unstable_instant\` because a Client Component in a parent segment prevented the page from rendering.`), "__NEXT_ERROR_CODE", { value: "E1082", enumerable: false, configurable: true }), t2, r2.createInstantStack);
      r2.validationPreventingErrors.push(n3);
      return;
    }
    if (n2.syncDynamicErrorWithStack) {
      let e3 = n2.syncDynamicErrorWithStack;
      null !== r2.createInstantStack && void 0 === e3.cause && (e3.cause = r2.createInstantStack()), r2.dynamicErrors.push(e3);
      return;
    }
    let s2 = ea(Object.defineProperty(Error(`Route "${e2.route}": ${1 === a2 ? "Runtime data such as `cookies()`, `headers()`, `params`, or `searchParams` was accessed outside of `<Suspense>`." : "Uncached data or `connection()` was accessed outside of `<Suspense>`."} This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/blocking-route`), "__NEXT_ERROR_CODE", { value: "E1078", enumerable: false, configurable: true }), t2, r2.createInstantStack);
    r2.dynamicErrors.push(s2);
  }
  function et(e2, t2, r2, n2) {
    let a2 = K.exec(n2);
    if (a2) {
      let i2 = z.exec(n2);
      if (i2 && i2.index < a2.index) return;
      let o2 = ea(Object.defineProperty(Error(`Route "${e2.route}": Could not validate \`unstable_instant\` because an error prevented the target segment from rendering.`, { cause: r2 }), "__NEXT_ERROR_CODE", { value: "E1112", enumerable: false, configurable: true }), n2, null);
      t2.validationPreventingErrors.push(o2);
    } else {
      let e3 = ea(Object.defineProperty(Error("An error occurred while attempting to validate instant UI. This error may be preventing the validation from completing.", { cause: r2 }), "__NEXT_ERROR_CODE", { value: "E1118", enumerable: false, configurable: true }), n2, null);
      t2.thrownErrorsOutsideBoundary.push(e3);
    }
  }
  function er(e2, t2, r2, n2) {
    if (Y.test(t2)) return;
    if (q.test(t2)) {
      r2.dynamicMetadata = ea(Object.defineProperty(Error(`Route "${e2.route}": Uncached data or \`connection()\` was accessed inside \`generateMetadata\`. Except for this instance, the page would have been entirely prerenderable which may have been the intended behavior. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-metadata`), "__NEXT_ERROR_CODE", { value: "E1080", enumerable: false, configurable: true }), t2, null);
      return;
    }
    if (G.test(t2)) {
      let n3 = ea(Object.defineProperty(Error(`Route "${e2.route}": Uncached data or \`connection()\` was accessed inside \`generateViewport\`. This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/next-prerender-dynamic-viewport`), "__NEXT_ERROR_CODE", { value: "E1077", enumerable: false, configurable: true }), t2, null);
      r2.dynamicErrors.push(n3);
      return;
    }
    if (V.test(t2)) {
      r2.hasAllowedDynamic = true, r2.hasSuspenseAboveBody = true;
      return;
    }
    if (z.test(t2)) {
      r2.hasAllowedDynamic = true;
      return;
    } else if (n2.syncDynamicErrorWithStack) return void r2.dynamicErrors.push(n2.syncDynamicErrorWithStack);
    let a2 = ea(Object.defineProperty(Error(`Route "${e2.route}": Uncached data or \`connection()\` was accessed outside of \`<Suspense>\`. This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/blocking-route`), "__NEXT_ERROR_CODE", { value: "E1084", enumerable: false, configurable: true }), t2, null);
    r2.dynamicErrors.push(a2);
  }
  function en(e2, t2, r2, n2) {
    if (!Y.test(t2)) {
      if (q.test(t2)) {
        r2.dynamicMetadata = ea(Object.defineProperty(Error(`Route "${e2.route}": Runtime data such as \`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` was accessed inside \`generateMetadata\` or you have file-based metadata such as icons that depend on dynamic params segments. Except for this instance, the page would have been entirely prerenderable which may have been the intended behavior. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-metadata`), "__NEXT_ERROR_CODE", { value: "E1085", enumerable: false, configurable: true }), t2, null);
        return;
      }
      if (G.test(t2)) {
        let n3 = ea(Object.defineProperty(Error(`Route "${e2.route}": Runtime data such as \`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` was accessed inside \`generateViewport\`. This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/next-prerender-dynamic-viewport`), "__NEXT_ERROR_CODE", { value: "E1081", enumerable: false, configurable: true }), t2, null);
        r2.dynamicErrors.push(n3);
        return;
      }
      if (V.test(t2)) {
        r2.hasAllowedDynamic = true, r2.hasSuspenseAboveBody = true;
        return;
      } else if (z.test(t2)) {
        r2.hasAllowedDynamic = true;
        return;
      } else {
        if (n2.syncDynamicErrorWithStack) return void r2.dynamicErrors.push(n2.syncDynamicErrorWithStack);
        let a2 = ea(Object.defineProperty(Error(`Route "${e2.route}": Runtime data such as \`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` was accessed outside of \`<Suspense>\`. This delays the entire page from rendering, resulting in a slow user experience. Learn more: https://nextjs.org/docs/messages/blocking-route`), "__NEXT_ERROR_CODE", { value: "E1083", enumerable: false, configurable: true }), t2, null);
        return void r2.dynamicErrors.push(a2);
      }
    }
  }
  function ea(e2, t2, r2) {
    return null !== r2 && (e2.cause = r2()), e2.stack = e2.name + ": " + e2.message + t2, e2;
  }
  var ei = ((i = {})[i.Full = 0] = "Full", i[i.Empty = 1] = "Empty", i[i.Errored = 2] = "Errored", i);
  function eo(e2, t2) {
    console.error(t2), console.error(`To get a more detailed stack trace and pinpoint the issue, try one of the following:
  - Start the app in development mode by running \`next dev\`, then open "${e2.route}" in your browser to investigate the error.
  - Rerun the production build with \`next build --debug-prerender\` to generate better stack traces.`);
  }
  function es(e2, t2, r2, n2) {
    if (n2.syncDynamicErrorWithStack) throw eo(e2, n2.syncDynamicErrorWithStack), new l.StaticGenBailoutError();
    if (0 !== t2) {
      if (r2.hasSuspenseAboveBody) return;
      let n3 = r2.dynamicErrors;
      if (n3.length > 0) {
        for (let t3 = 0; t3 < n3.length; t3++) eo(e2, n3[t3]);
        throw new l.StaticGenBailoutError();
      }
      if (r2.hasDynamicViewport) throw console.error(`Route "${e2.route}" has a \`generateViewport\` that depends on Request data (\`cookies()\`, etc...) or uncached external data (\`fetch(...)\`, etc...) without explicitly allowing fully dynamic rendering. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-viewport`), new l.StaticGenBailoutError();
      if (1 === t2) throw console.error(`Route "${e2.route}" did not produce a static shell and Next.js was unable to determine a reason. This is a bug in Next.js.`), new l.StaticGenBailoutError();
    } else if (false === r2.hasAllowedDynamic && r2.hasDynamicMetadata) throw console.error(`Route "${e2.route}" has a \`generateMetadata\` that depends on Request data (\`cookies()\`, etc...) or uncached external data (\`fetch(...)\`, etc...) when the rest of the route does not. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-metadata`), new l.StaticGenBailoutError();
  }
  function eu(e2, t2, r2, n2) {
    if (n2 || r2.hasSuspenseAboveBody) return [];
    if (0 !== t2) {
      let n3 = r2.dynamicErrors;
      if (n3.length > 0) return n3;
      if (1 === t2) return [Object.defineProperty(new y.InvariantError(`Route "${e2.route}" did not produce a static shell and Next.js was unable to determine a reason.`), "__NEXT_ERROR_CODE", { value: "E936", enumerable: false, configurable: true })];
    } else if (false === r2.hasAllowedDynamic && 0 === r2.dynamicErrors.length && r2.dynamicMetadata) return [r2.dynamicMetadata];
    return [];
  }
  function ec(e2, t2, r2, n2, a2) {
    if (n2) {
      let { missingSampleErrors: e3 } = n2;
      if (e3.length > 0) return e3;
    }
    let { validationPreventingErrors: i2 } = r2;
    if (i2.length > 0) return i2;
    if (a2.renderedIds.size < a2.expectedIds.size) {
      let { thrownErrorsOutsideBoundary: t3, createInstantStack: n3 } = r2;
      if (0 === t3.length) {
        let t4 = `Route "${e2.route}": Could not validate \`unstable_instant\` because the target segment was prevented from rendering for an unknown reason.`, r3 = null !== n3 ? n3() : Error();
        return r3.name = "Error", r3.message = t4, [r3];
      }
      if (1 === t3.length) {
        let r3 = `Route "${e2.route}": Could not validate \`unstable_instant\` because the target segment was prevented from rendering, likely due to the following error.`, a3 = null !== n3 ? n3() : Error();
        return a3.name = "Error", a3.message = r3, [a3, t3[0]];
      }
      {
        let r3 = `Route "${e2.route}": Could not validate \`unstable_instant\` because the target segment was prevented from rendering, likely due to one of the following errors.`, a3 = null !== n3 ? n3() : Error();
        return a3.name = "Error", a3.message = r3, [a3, ...t3];
      }
    }
    if (0 !== t2) {
      let n3 = r2.dynamicErrors;
      if (n3.length > 0) return n3;
      if (1 === t2) return r2.hasAllowedClientDynamicAboveBoundary ? [] : [Object.defineProperty(new y.InvariantError(`Route "${e2.route}" failed to render during instant validation and Next.js was unable to determine a reason.`), "__NEXT_ERROR_CODE", { value: "E1055", enumerable: false, configurable: true })];
    } else {
      let e3 = r2.dynamicErrors;
      if (e3.length > 0) return e3;
      if (false === r2.hasAllowedDynamic && r2.dynamicMetadata) return [r2.dynamicMetadata];
    }
    return [];
  }
}, 91414, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "unstable_rethrow", { enumerable: true, get: function() {
    return function e2(t2) {
      if ((0, o.isNextRouterError)(t2) || (0, i.isBailoutToCSRError)(t2) || (0, u.isDynamicServerError)(t2) || (0, s.isDynamicPostpone)(t2) || (0, a.isPostpone)(t2) || (0, n.isHangingPromiseRejectionError)(t2) || (0, s.isPrerenderInterruptedError)(t2)) throw t2;
      t2 instanceof Error && "cause" in t2 && e2(t2.cause);
    };
  } });
  let n = e.r(63138), a = e.r(67287), i = e.r(32061), o = e.r(65713), s = e.r(67673), u = e.r(76353);
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 90508, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "unstable_rethrow", { enumerable: true, get: function() {
    return n;
  } });
  let n = "u" < typeof window ? e.r(91414).unstable_rethrow : e.r(15507).unstable_rethrow;
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 92805, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { ReadonlyURLSearchParams: function() {
    return i.ReadonlyURLSearchParams;
  }, RedirectType: function() {
    return f;
  }, forbidden: function() {
    return u.forbidden;
  }, notFound: function() {
    return s.notFound;
  }, permanentRedirect: function() {
    return o.permanentRedirect;
  }, redirect: function() {
    return o.redirect;
  }, unauthorized: function() {
    return c.unauthorized;
  }, unstable_isUnrecognizedActionError: function() {
    return d;
  }, unstable_rethrow: function() {
    return l.unstable_rethrow;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = e.r(3680), o = e.r(24063), s = e.r(22783), u = e.r(79854), c = e.r(22683), l = e.r(90508);
  function d() {
    throw Object.defineProperty(Error("`unstable_isUnrecognizedActionError` can only be used on the client."), "__NEXT_ERROR_CODE", { value: "E776", enumerable: false, configurable: true });
  }
  let f = { push: "push", replace: "replace" };
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 76562, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { ReadonlyURLSearchParams: function() {
    return s.ReadonlyURLSearchParams;
  }, RedirectType: function() {
    return d.RedirectType;
  }, ServerInsertedHTMLContext: function() {
    return c.ServerInsertedHTMLContext;
  }, forbidden: function() {
    return d.forbidden;
  }, notFound: function() {
    return d.notFound;
  }, permanentRedirect: function() {
    return d.permanentRedirect;
  }, redirect: function() {
    return d.redirect;
  }, unauthorized: function() {
    return d.unauthorized;
  }, unstable_isUnrecognizedActionError: function() {
    return l.unstable_isUnrecognizedActionError;
  }, unstable_rethrow: function() {
    return d.unstable_rethrow;
  }, useParams: function() {
    return E;
  }, usePathname: function() {
    return b;
  }, useRouter: function() {
    return _;
  }, useSearchParams: function() {
    return y;
  }, useSelectedLayoutSegment: function() {
    return v;
  }, useSelectedLayoutSegments: function() {
    return R;
  }, useServerInsertedHTML: function() {
    return c.useServerInsertedHTML;
  } };
  for (var a in n) Object.defineProperty(r, a, { enumerable: true, get: n[a] });
  let i = e.r(90809)._(e.r(71645)), o = e.r(65347), s = e.r(61994), u = e.r(13258), c = e.r(13957), l = e.r(92838), d = e.r(92805), f = "u" < typeof window ? e.r(67673).useDynamicRouteParams : void 0, m = "u" < typeof window ? e.r(67673).useDynamicSearchParams : void 0, { instrumentParamsForClientValidation: h, instrumentSearchParamsForClientValidation: p, expectCompleteParamsInClientValidation: g } = {};
  function y() {
    m?.("useSearchParams()");
    let e2 = (0, i.useContext)(s.SearchParamsContext);
    return (0, i.useMemo)(() => e2 ? new s.ReadonlyURLSearchParams(e2) : null, [e2]);
  }
  function b() {
    return f?.("usePathname()"), (0, i.useContext)(s.PathnameContext);
  }
  function _() {
    let e2 = (0, i.useContext)(o.AppRouterContext);
    if (null === e2) throw Object.defineProperty(Error("invariant expected app router to be mounted"), "__NEXT_ERROR_CODE", { value: "E238", enumerable: false, configurable: true });
    return e2;
  }
  function E() {
    return f?.("useParams()"), (0, i.useContext)(s.PathParamsContext);
  }
  function R(e2 = "children") {
    f?.("useSelectedLayoutSegments()");
    let t2 = (0, i.useContext)(o.LayoutRouterContext);
    return t2 ? (0, u.getSelectedLayoutSegmentPath)(t2.parentTree, e2) : null;
  }
  function v(e2 = "children") {
    f?.("useSelectedLayoutSegment()"), (0, i.useContext)(s.NavigationPromisesContext);
    let t2 = R(e2);
    return (0, u.computeSelectedLayoutSegment)(t2, e2);
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}]);
