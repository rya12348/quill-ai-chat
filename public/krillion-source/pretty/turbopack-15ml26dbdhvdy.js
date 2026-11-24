(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, { otherChunks: ["static/chunks/36ssnkm0cjgq6.js", "static/chunks/3pn9kwm6szrpy.js", "static/chunks/06ei2ouz7padc.js", "static/chunks/0pn_rv1z008z4.js", "static/chunks/1078piir82mqg.js"], runtimeModuleIds: [94553] }]), (() => {
  let e;
  if (!Array.isArray(globalThis.TURBOPACK)) return;
  let t = "/_next/", r = (function() {
    if (null != self.TURBOPACK_ASSET_SUFFIX) return self.TURBOPACK_ASSET_SUFFIX;
    let e2 = document?.currentScript?.getAttribute?.("src") ?? "", t2 = e2.indexOf("?");
    return t2 >= 0 ? e2.slice(t2) : "";
  })(), n = ["NEXT_DEPLOYMENT_ID", "NEXT_CLIENT_ASSET_SUFFIX"];
  var o, i = ((o = i || {})[o.Runtime = 0] = "Runtime", o[o.Parent = 1] = "Parent", o[o.Update = 2] = "Update", o);
  let l = /* @__PURE__ */ new WeakMap();
  function s(e2, t2) {
    this.m = e2, this.e = t2;
  }
  let u = s.prototype, a = Object.prototype.hasOwnProperty, c = "u" > typeof Symbol && Symbol.toStringTag;
  function f(e2, t2, r2) {
    a.call(e2, t2) || Object.defineProperty(e2, t2, r2);
  }
  function p(e2, t2) {
    let r2 = e2[t2];
    return r2 || (r2 = h(t2), e2[t2] = r2), r2;
  }
  function h(e2) {
    return { exports: {}, error: void 0, id: e2, namespaceObject: void 0 };
  }
  function d(e2, t2) {
    f(e2, "__esModule", { value: true }), c && f(e2, c, { value: "Module" });
    let r2 = 0;
    for (; r2 < t2.length; ) {
      let n2 = t2[r2++], o2 = t2[r2++];
      if ("number" == typeof o2) if (0 === o2) f(e2, n2, { value: t2[r2++], enumerable: true, writable: false });
      else throw Error(`unexpected tag: ${o2}`);
      else "function" == typeof t2[r2] ? f(e2, n2, { get: o2, set: t2[r2++], enumerable: true }) : f(e2, n2, { get: o2, enumerable: true });
    }
    Object.seal(e2);
  }
  function m(e2, t2) {
    (null != t2 ? p(this.c, t2) : this.m).exports = e2;
  }
  u.s = function(e2, t2) {
    let r2, n2;
    null != t2 ? n2 = (r2 = p(this.c, t2)).exports : (r2 = this.m, n2 = this.e), r2.namespaceObject = n2, d(n2, e2);
  }, u.j = function(e2, t2) {
    var r2, n2;
    let o2, i2, s2;
    null != t2 ? i2 = (o2 = p(this.c, t2)).exports : (o2 = this.m, i2 = this.e);
    let u2 = (r2 = o2, n2 = i2, (s2 = l.get(r2)) || (l.set(r2, s2 = []), r2.exports = r2.namespaceObject = new Proxy(n2, { get(e3, t3) {
      if (a.call(e3, t3) || "default" === t3 || "__esModule" === t3) return Reflect.get(e3, t3);
      for (let e4 of s2) {
        let r3 = Reflect.get(e4, t3);
        if (void 0 !== r3) return r3;
      }
    }, ownKeys(e3) {
      let t3 = Reflect.ownKeys(e3);
      for (let e4 of s2) for (let r3 of Reflect.ownKeys(e4)) "default" === r3 || t3.includes(r3) || t3.push(r3);
      return t3;
    } })), s2);
    "object" == typeof e2 && null !== e2 && u2.push(e2);
  }, u.v = m, u.n = function(e2, t2) {
    let r2;
    (r2 = null != t2 ? p(this.c, t2) : this.m).exports = r2.namespaceObject = e2;
  };
  let b = Object.getPrototypeOf ? (e2) => Object.getPrototypeOf(e2) : (e2) => e2.__proto__, y = [null, b({}), b([]), b(b)];
  function g(e2, t2, r2) {
    let n2 = [], o2 = -1;
    for (let t3 = e2; ("object" == typeof t3 || "function" == typeof t3) && !y.includes(t3); t3 = b(t3)) for (let r3 of Object.getOwnPropertyNames(t3)) n2.push(r3, /* @__PURE__ */ (function(e3, t4) {
      return () => e3[t4];
    })(e2, r3)), -1 === o2 && "default" === r3 && (o2 = n2.length - 1);
    return r2 && o2 >= 0 || (o2 >= 0 ? n2.splice(o2, 1, 0, e2) : n2.push("default", 0, e2)), d(t2, n2), t2;
  }
  function O(e2) {
    let t2 = B(e2, this.m);
    if (t2.namespaceObject) return t2.namespaceObject;
    let r2 = t2.exports;
    return t2.namespaceObject = g(r2, "function" == typeof r2 ? function(...e3) {
      return r2.apply(this, e3);
    } : /* @__PURE__ */ Object.create(null), r2 && r2.__esModule);
  }
  function w(e2) {
    let t2 = e2.indexOf("#");
    -1 !== t2 && (e2 = e2.substring(0, t2));
    let r2 = e2.indexOf("?");
    return -1 !== r2 && (e2 = e2.substring(0, r2)), e2;
  }
  function k() {
    let e2, t2;
    return { promise: new Promise((r2, n2) => {
      t2 = n2, e2 = r2;
    }), resolve: e2, reject: t2 };
  }
  u.i = O, u.A = function(e2) {
    return this.r(e2)(O.bind(this));
  }, u.t = "function" == typeof require ? require : function() {
    throw Error("Unexpected use of runtime require");
  }, u.r = function(e2) {
    return B(e2, this.m).exports;
  }, u.f = function(e2) {
    function t2(t3) {
      if (t3 = w(t3), a.call(e2, t3)) return e2[t3].module();
      let r2 = Error(`Cannot find module '${t3}'`);
      throw r2.code = "MODULE_NOT_FOUND", r2;
    }
    return t2.keys = () => Object.keys(e2), t2.resolve = (t3) => {
      if (t3 = w(t3), a.call(e2, t3)) return e2[t3].id();
      let r2 = Error(`Cannot find module '${t3}'`);
      throw r2.code = "MODULE_NOT_FOUND", r2;
    }, t2.import = async (e3) => await t2(e3), t2;
  };
  let j = /* @__PURE__ */ Symbol("turbopack queues"), U = /* @__PURE__ */ Symbol("turbopack exports"), v = /* @__PURE__ */ Symbol("turbopack error");
  function C(e2) {
    e2 && 1 !== e2.status && (e2.status = 1, e2.forEach((e3) => e3.queueCount--), e2.forEach((e3) => e3.queueCount-- ? e3.queueCount++ : e3()));
  }
  u.a = function(e2, t2) {
    let r2 = this.m, n2 = t2 ? Object.assign([], { status: -1 }) : void 0, o2 = /* @__PURE__ */ new Set(), { resolve: i2, reject: l2, promise: s2 } = k(), u2 = Object.assign(s2, { [U]: r2.exports, [j]: (e3) => {
      n2 && e3(n2), o2.forEach(e3), u2.catch(() => {
      });
    } }), a2 = { get: () => u2, set(e3) {
      e3 !== u2 && (u2[U] = e3);
    } };
    Object.defineProperty(r2, "exports", a2), Object.defineProperty(r2, "namespaceObject", a2), e2(function(e3) {
      let t3 = e3.map((e4) => {
        if (null !== e4 && "object" == typeof e4) {
          if (j in e4) return e4;
          if (null != e4 && "object" == typeof e4 && "then" in e4 && "function" == typeof e4.then) {
            let t4 = Object.assign([], { status: 0 }), r4 = { [U]: {}, [j]: (e5) => e5(t4) };
            return e4.then((e5) => {
              r4[U] = e5, C(t4);
            }, (e5) => {
              r4[v] = e5, C(t4);
            }), r4;
          }
        }
        return { [U]: e4, [j]: () => {
        } };
      }), r3 = () => t3.map((e4) => {
        if (e4[v]) throw e4[v];
        return e4[U];
      }), { promise: i3, resolve: l3 } = k(), s3 = Object.assign(() => l3(r3), { queueCount: 0 });
      function u3(e4) {
        e4 !== n2 && !o2.has(e4) && (o2.add(e4), e4 && 0 === e4.status && (s3.queueCount++, e4.push(s3)));
      }
      return t3.map((e4) => e4[j](u3)), s3.queueCount ? i3 : r3();
    }, function(e3) {
      e3 ? l2(u2[v] = e3) : i2(u2[U]), C(n2);
    }), n2 && -1 === n2.status && (n2.status = 0);
  };
  let P = function(e2) {
    let t2 = new URL(e2, "x:/"), r2 = {};
    for (let e3 in t2) r2[e3] = t2[e3];
    for (let t3 in r2.href = e2, r2.pathname = e2.replace(/[?#].*/, ""), r2.origin = r2.protocol = "", r2.toString = r2.toJSON = (...t4) => e2, r2) Object.defineProperty(this, t3, { enumerable: true, configurable: true, value: r2[t3] });
  };
  function R(e2, t2) {
    throw Error(`Invariant: ${t2(e2)}`);
  }
  P.prototype = URL.prototype, u.U = P, u.z = function(e2) {
    throw Error("dynamic usage of require is not supported");
  }, u.g = globalThis;
  let S = s.prototype, $ = /* @__PURE__ */ new Map();
  u.M = $;
  let _ = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new Map();
  async function T(e2, t2, r2) {
    let n2;
    if ("string" == typeof r2) return M(e2, t2, q(r2));
    let o2 = r2.included || [], i2 = o2.map((e3) => !!$.has(e3) || _.get(e3));
    if (i2.length > 0 && i2.every((e3) => e3)) return void await Promise.all(i2);
    let l2 = r2.moduleChunks || [], s2 = l2.map((e3) => E.get(e3)).filter((e3) => e3);
    if (s2.length > 0) {
      if (s2.length === l2.length) return void await Promise.all(s2);
      let r3 = /* @__PURE__ */ new Set();
      for (let e3 of l2) E.has(e3) || r3.add(e3);
      for (let n3 of r3) {
        let r4 = M(e2, t2, q(n3));
        E.set(n3, r4), s2.push(r4);
      }
      n2 = Promise.all(s2);
    } else {
      for (let o3 of (n2 = M(e2, t2, q(r2.path)), l2)) E.has(o3) || E.set(o3, n2);
    }
    for (let e3 of o2) _.has(e3) || _.set(e3, n2);
    await n2;
  }
  S.l = function(e2) {
    return T(i.Parent, this.m.id, e2);
  };
  let A = Promise.resolve(void 0), x = /* @__PURE__ */ new WeakMap();
  function M(t2, r2, n2) {
    let o2 = e.loadChunkCached(t2, n2), l2 = x.get(o2);
    if (void 0 === l2) {
      let e2 = x.set.bind(x, o2, A);
      l2 = o2.then(e2).catch((e3) => {
        let o3;
        switch (t2) {
          case i.Runtime:
            o3 = `as a runtime dependency of chunk ${r2}`;
            break;
          case i.Parent:
            o3 = `from module ${r2}`;
            break;
          case i.Update:
            o3 = "from an HMR update";
            break;
          default:
            R(t2, (e4) => `Unknown source type: ${e4}`);
        }
        let l3 = Error(`Failed to load chunk ${n2} ${o3}${e3 ? `: ${e3}` : ""}`, e3 ? { cause: e3 } : void 0);
        throw l3.name = "ChunkLoadError", l3;
      }), x.set(o2, l2);
    }
    return l2;
  }
  function q(e2) {
    return `${t}${e2.split("/").map((e3) => encodeURIComponent(e3)).join("/")}${r}`;
  }
  S.L = function(e2) {
    return M(i.Parent, this.m.id, e2);
  }, S.R = function(e2) {
    let t2 = this.r(e2);
    return t2?.default ?? t2;
  }, S.P = function(e2) {
    return `/ROOT/${e2 ?? ""}`;
  }, S.q = function(e2, t2) {
    m.call(this, `${e2}${r}`, t2);
  }, S.b = function(e2, t2, o2, i2) {
    let l2 = "SharedWorker" === e2.name, s2 = [o2.map((e3) => q(e3)).reverse(), r];
    for (let e3 of n) s2.push(globalThis[e3]);
    let u2 = new URL(q(t2), location.origin), a2 = JSON.stringify(s2);
    return l2 ? u2.searchParams.set("params", a2) : u2.hash = "#params=" + encodeURIComponent(a2), new e2(u2, i2 ? { ...i2, type: void 0 } : void 0);
  };
  let N = /\.js(?:\?[^#]*)?(?:#.*)?$/, K = /\.css(?:\?[^#]*)?(?:#.*)?$/;
  function L(e2) {
    return K.test(e2);
  }
  u.w = function(t2, r2, n2) {
    return e.loadWebAssembly(i.Parent, this.m.id, t2, r2, n2);
  }, u.u = function(t2, r2) {
    return e.loadWebAssemblyModule(i.Parent, this.m.id, t2, r2);
  };
  let I = {};
  u.c = I;
  let B = (e2, t2) => {
    let r2 = I[e2];
    if (r2) {
      if (r2.error) throw r2.error;
      return r2;
    }
    return W(e2, i.Parent, t2.id);
  };
  function W(e2, t2, r2) {
    let n2 = $.get(e2);
    if ("function" != typeof n2) throw Error((function(e3, t3, r3) {
      let n3;
      switch (t3) {
        case 0:
          n3 = `as a runtime entry of chunk ${r3}`;
          break;
        case 1:
          n3 = `because it was required from module ${r3}`;
          break;
        case 2:
          n3 = "because of an HMR update";
          break;
        default:
          R(t3, (e4) => `Unknown source type: ${e4}`);
      }
      return `Module ${e3} was instantiated ${n3}, but the module factory is not available.`;
    })(e2, t2, r2));
    let o2 = h(e2), i2 = o2.exports;
    I[e2] = o2;
    let l2 = new s(o2, i2);
    try {
      n2(l2, o2, i2);
    } catch (e3) {
      throw o2.error = e3, e3;
    }
    return o2.namespaceObject && o2.exports !== o2.namespaceObject && g(o2.exports, o2.namespaceObject), o2;
  }
  function F(t2) {
    let r2, n2 = (function(e2) {
      if ("string" == typeof e2) return e2;
      if (e2) return { src: e2.getAttribute("src") };
      if ("u" > typeof TURBOPACK_NEXT_CHUNK_URLS) return { src: TURBOPACK_NEXT_CHUNK_URLS.pop() };
      throw Error("chunk path empty but not in a worker");
    })(t2[0]);
    return 2 === t2.length ? r2 = t2[1] : (r2 = void 0, !(function(e2, t3) {
      let r3 = 1;
      for (; r3 < e2.length; ) {
        let n3, o2 = r3 + 1;
        for (; o2 < e2.length && "function" != typeof e2[o2]; ) o2++;
        if (o2 === e2.length) throw Error("malformed chunk format, expected a factory function");
        let i2 = e2[o2];
        for (let i3 = r3; i3 < o2; i3++) {
          let r4 = e2[i3], o3 = t3.get(r4);
          if (o3) {
            n3 = o3;
            break;
          }
        }
        let l2 = n3 ?? i2, s2 = false;
        for (let n4 = r3; n4 < o2; n4++) {
          let r4 = e2[n4];
          t3.has(r4) || (s2 || (l2 === i2 && Object.defineProperty(i2, "name", { value: "module evaluation" }), s2 = true), t3.set(r4, l2));
        }
        r3 = o2 + 1;
      }
    })(t2, $)), e.registerChunk(n2, r2);
  }
  let X = /* @__PURE__ */ new Map();
  function D(e2) {
    let t2 = X.get(e2);
    if (!t2) {
      let r2, n2;
      t2 = { resolved: false, loadingStarted: false, promise: new Promise((e3, t3) => {
        r2 = e3, n2 = t3;
      }), resolve: () => {
        t2.resolved = true, r2();
      }, reject: n2 }, X.set(e2, t2);
    }
    return t2;
  }
  e = { async registerChunk(e2, r2) {
    let n2 = (function(e3) {
      if ("string" == typeof e3) return e3;
      let r3 = decodeURIComponent(e3.src.replace(/[?#].*$/, ""));
      return r3.startsWith(t) ? r3.slice(t.length) : r3;
    })(e2);
    if (D("string" == typeof e2 ? q(e2) : e2.src).resolve(), null != r2) {
      for (let e3 of r2.otherChunks) D(q("string" == typeof e3 ? e3 : e3.path));
      if (await Promise.all(r2.otherChunks.map((e3) => T(i.Runtime, n2, e3))), r2.runtimeModuleIds.length > 0) for (let e3 of r2.runtimeModuleIds) !(function(e4, t2) {
        let r3 = I[t2];
        if (r3) {
          if (r3.error) throw r3.error;
          return;
        }
        W(t2, i.Runtime, e4);
      })(n2, e3);
    }
  }, loadChunkCached: (e2, t2) => (function(e3, t3) {
    let r2 = D(t3);
    if (r2.loadingStarted) return r2.promise;
    if (e3 === i.Runtime) return r2.loadingStarted = true, L(t3) && r2.resolve(), r2.promise;
    if ("function" == typeof importScripts) if (L(t3)) ;
    else if (N.test(t3)) self.TURBOPACK_NEXT_CHUNK_URLS.push(t3), importScripts(t3);
    else throw Error(`can't infer type of chunk from URL ${t3} in worker`);
    else {
      let e4 = decodeURI(t3);
      if (L(t3)) if (document.querySelectorAll(`link[rel=stylesheet][href="${t3}"],link[rel=stylesheet][href^="${t3}?"],link[rel=stylesheet][href="${e4}"],link[rel=stylesheet][href^="${e4}?"]`).length > 0) r2.resolve();
      else {
        let e5 = document.createElement("link");
        e5.rel = "stylesheet", e5.href = t3, e5.onerror = () => {
          r2.reject();
        }, e5.onload = () => {
          r2.resolve();
        }, document.head.appendChild(e5);
      }
      else if (N.test(t3)) {
        let n2 = document.querySelectorAll(`script[src="${t3}"],script[src^="${t3}?"],script[src="${e4}"],script[src^="${e4}?"]`);
        if (n2.length > 0) for (let e5 of Array.from(n2)) e5.addEventListener("error", () => {
          r2.reject();
        });
        else {
          let e5 = document.createElement("script");
          e5.src = t3, e5.onerror = () => {
            r2.reject();
          }, document.head.appendChild(e5);
        }
      } else throw Error(`can't infer type of chunk from URL ${t3}`);
    }
    return r2.loadingStarted = true, r2.promise;
  })(e2, t2), async loadWebAssembly(e2, t2, r2, n2, o2) {
    let i2 = fetch(q(r2)), { instance: l2 } = await WebAssembly.instantiateStreaming(i2, o2);
    return l2.exports;
  }, async loadWebAssemblyModule(e2, t2, r2, n2) {
    let o2 = fetch(q(r2));
    return await WebAssembly.compileStreaming(o2);
  } };
  let z = globalThis.TURBOPACK;
  globalThis.TURBOPACK = { push: F }, z.forEach(F);
})();
;
(function() {
  try {
    if (typeof document === "undefined" || !/(?:^|;\s)__vercel_toolbar=1(?:;|$)/.test(document.cookie)) return;
  } catch (e) {
    return;
  }
  var s = document.createElement("script");
  s.src = "https://vercel.live/_next-live/feedback/feedback.js";
  s.setAttribute("data-explicit-opt-in", "true");
  s.setAttribute("data-cookie-opt-in", "true");
  s.setAttribute("data-deployment-id", "dpl_6VihiPCXNKV941VNtLNKp7niRG3e");
  (document.head || document.documentElement).appendChild(s);
})();
