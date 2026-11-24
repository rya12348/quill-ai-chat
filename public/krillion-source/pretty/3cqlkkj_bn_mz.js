(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 8341, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { cancelIdleCallback: function() {
    return l;
  }, requestIdleCallback: function() {
    return a;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  let a = "u" > typeof self && self.requestIdleCallback && self.requestIdleCallback.bind(window) || function(e2) {
    let t2 = Date.now();
    return self.setTimeout(function() {
      e2({ didTimeout: false, timeRemaining: function() {
        return Math.max(0, 50 - (Date.now() - t2));
      } });
    }, 1);
  }, l = "u" > typeof self && self.cancelIdleCallback && self.cancelIdleCallback.bind(window) || function(e2) {
    return clearTimeout(e2);
  };
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 47689, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { ESCAPE_REGEX: function() {
    return l;
  }, htmlEscapeAttributeString: function() {
    return c;
  }, htmlEscapeJsonString: function() {
    return s;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  let a = { "&": "\\u0026", ">": "\\u003e", "<": "\\u003c", "\u2028": "\\u2028", "\u2029": "\\u2029" }, l = /[&><\u2028\u2029]/g, u = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" }, i = /[&"'<>]/g;
  function s(e2) {
    return e2.replace(l, (e3) => a[e3]);
  }
  function c(e2) {
    return e2.replace(i, (e3) => u[e3]);
  }
}, 79520, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { default: function() {
    return _;
  }, handleClientScriptLoad: function() {
    return b;
  }, initScriptLoader: function() {
    return h;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  let a = e.r(55682), l = e.r(90809), u = e.r(43476), i = a._(e.r(74080)), s = l._(e.r(71645)), c = e.r(42732), d = e.r(22737), f = e.r(8341), p = e.r(47689), g = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Set(), y = (e2) => {
    let { src: t2, id: r2, onLoad: n2 = () => {
    }, onReady: o2 = null, dangerouslySetInnerHTML: a2, children: l2 = "", strategy: u2 = "afterInteractive", onError: s2, stylesheets: c2 } = e2, f2 = r2 || t2;
    if (f2 && m.has(f2)) return;
    if (g.has(t2)) {
      m.add(f2), g.get(t2).then(n2, s2);
      return;
    }
    let p2 = () => {
      o2 && o2(), m.add(f2);
    }, y2 = document.createElement("script"), b2 = new Promise((e3, t3) => {
      y2.addEventListener("load", function(t4) {
        e3(), n2 && n2.call(this, t4), p2();
      }), y2.addEventListener("error", function(e4) {
        t3(e4);
      });
    }).catch(function(e3) {
      s2 && s2(e3);
    });
    a2 ? (y2.innerHTML = a2.__html || "", p2()) : l2 ? (y2.textContent = "string" == typeof l2 ? l2 : Array.isArray(l2) ? l2.join("") : "", p2()) : t2 && (y2.src = t2, g.set(t2, b2)), (0, d.setAttributesFromProps)(y2, e2), "worker" === u2 && y2.setAttribute("type", "text/partytown"), y2.setAttribute("data-nscript", u2), c2 && ((e3) => {
      if (i.default.preinit) return e3.forEach((e4) => {
        i.default.preinit(e4, { as: "style" });
      });
      if ("u" > typeof window) {
        let t3 = document.head;
        e3.forEach((e4) => {
          let r3 = document.createElement("link");
          r3.type = "text/css", r3.rel = "stylesheet", r3.href = e4, t3.appendChild(r3);
        });
      }
    })(c2), document.body.appendChild(y2);
  };
  function b(e2) {
    let { strategy: t2 = "afterInteractive" } = e2;
    "lazyOnload" === t2 ? window.addEventListener("load", () => {
      (0, f.requestIdleCallback)(() => y(e2));
    }) : y(e2);
  }
  function h(e2) {
    e2.forEach(b), [...document.querySelectorAll('[data-nscript="beforeInteractive"]'), ...document.querySelectorAll('[data-nscript="beforePageRender"]')].forEach((e3) => {
      let t2 = e3.id || e3.getAttribute("src");
      m.add(t2);
    });
  }
  function v(e2) {
    let { id: t2, src: r2 = "", onLoad: n2 = () => {
    }, onReady: o2 = null, strategy: a2 = "afterInteractive", onError: l2, stylesheets: d2, ...g2 } = e2, { updateScripts: b2, scripts: h2, getIsSsr: v2, appDir: _2, nonce: w } = (0, s.useContext)(c.HeadManagerContext);
    w = g2.nonce || w;
    let O = (0, s.useRef)(false);
    (0, s.useEffect)(() => {
      let e3 = t2 || r2;
      O.current || (o2 && e3 && m.has(e3) && o2(), O.current = true);
    }, [o2, t2, r2]);
    let E = (0, s.useRef)(false);
    if ((0, s.useEffect)(() => {
      if (!E.current) {
        if ("afterInteractive" === a2) y(e2);
        else "lazyOnload" === a2 && ("complete" === document.readyState ? (0, f.requestIdleCallback)(() => y(e2)) : window.addEventListener("load", () => {
          (0, f.requestIdleCallback)(() => y(e2));
        }));
        E.current = true;
      }
    }, [e2, a2]), ("beforeInteractive" === a2 || "worker" === a2) && (b2 ? (h2[a2] = (h2[a2] || []).concat([{ id: t2, src: r2, onLoad: n2, onReady: o2, onError: l2, ...g2, nonce: w }]), b2(h2)) : v2 && v2() ? m.add(t2 || r2) : v2 && !v2() && y({ ...e2, nonce: w })), _2) {
      if (d2 && d2.forEach((e3) => {
        i.default.preinit(e3, { as: "style" });
      }), "beforeInteractive" === a2) if (!r2) return g2.dangerouslySetInnerHTML && (g2.children = g2.dangerouslySetInnerHTML.__html, delete g2.dangerouslySetInnerHTML), (0, u.jsx)("script", { nonce: w, dangerouslySetInnerHTML: { __html: `(self.__next_s=self.__next_s||[]).push(${(0, p.htmlEscapeJsonString)(JSON.stringify([0, { ...g2, id: t2 }]))})` } });
      else return i.default.preload(r2, g2.integrity ? { as: "script", integrity: g2.integrity, nonce: w, crossOrigin: g2.crossOrigin } : { as: "script", nonce: w, crossOrigin: g2.crossOrigin }), (0, u.jsx)("script", { nonce: w, dangerouslySetInnerHTML: { __html: `(self.__next_s=self.__next_s||[]).push(${(0, p.htmlEscapeJsonString)(JSON.stringify([r2, { ...g2, id: t2 }]))})` } });
      "afterInteractive" === a2 && r2 && i.default.preload(r2, g2.integrity ? { as: "script", integrity: g2.integrity, nonce: w, crossOrigin: g2.crossOrigin } : { as: "script", nonce: w, crossOrigin: g2.crossOrigin });
    }
    return null;
  }
  Object.defineProperty(v, "__nextScript", { value: true });
  let _ = v;
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 3303, (e, t, r) => {
  t.exports = e.r(79520);
}, 18566, (e, t, r) => {
  t.exports = e.r(76562);
}, 80915, (e) => {
  "use strict";
  var t = e.i(37812), r = e.i(33827);
  e.s(["adPolicy", 0, function(e2, t2, r2) {
    let n = /^\/(unlock|restore|account|calibration|answer-count|preview)(\/|$)/.test(t2);
    return { enabled: "free" === e2 && !n, reload: r2 && ("paid" === e2 || n) };
  }, "purchaseStatus", 0, () => (0, t.hasAnyPurchase)() ? "paid" : "free", "serverPurchaseStatus", 0, () => "pending", "subscribePurchases", 0, function(e2) {
    return window.addEventListener(t.PURCHASES_CHANGED, e2), window.addEventListener(r.PROGRESS_OWNER_CHANGED, e2), window.addEventListener("storage", e2), () => {
      window.removeEventListener(t.PURCHASES_CHANGED, e2), window.removeEventListener(r.PROGRESS_OWNER_CHANGED, e2), window.removeEventListener("storage", e2);
    };
  }]);
}, 23524, 60451, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(71645), n = e.i(18566), o = e.i(3303);
  let a = { mobile: true, tablet: true, desktop: true };
  function l(e2 = a) {
    let t2 = {};
    for (let r2 of ["mobile", "tablet", "desktop"]) e2[r2] || (t2[`data-blocklist-adhesion-${r2}`] = "1");
    return t2;
  }
  e.s(["ADHESION_ENABLED", 0, a, "adhesionBlocklistAttributes", 0, l], 60451);
  var u = e.i(80915);
  let i = (0, r.createContext)("loading"), s = (0, r.createContext)(false), c = false, d = "loading", f = () => d, p = () => "loading";
  function g(e2) {
    d = e2, y.forEach((e3) => e3());
  }
  function m() {
    let e2 = window.$adManagementConfig, t2 = new URLSearchParams(window.location.search).getAll("test").includes("placeholders");
    g(e2?.web?.model?.launch_mode && !t2 ? "inactive" : "ready");
  }
  let y = /* @__PURE__ */ new Set(), b = (e2) => (y.add(e2), () => {
    y.delete(e2);
  }), h = () => c, v = () => false;
  function _() {
    return (0, r.useEffect)(() => {
      c = true, y.forEach((e2) => e2());
    }, []), (0, t.jsx)(o.default, { id: "mediavine-wrapper", strategy: "afterInteractive", "data-noptimize": "1", "data-cfasync": "false", onReady: m, onError: () => g("failed"), src: "https://scripts.mediavine.com/tags/dffa5642-f104-40c8-b196-af52c8604756.js" });
  }
  e.s(["default", 0, function({ children: e2 }) {
    let o2 = (0, r.useSyncExternalStore)(u.subscribePurchases, u.purchaseStatus, u.serverPurchaseStatus), a2 = (0, r.useSyncExternalStore)(b, h, v), c2 = (0, n.usePathname)(), d2 = (0, r.useSyncExternalStore)(b, f, p), g2 = (0, u.adPolicy)(o2, c2, a2), m2 = l();
    return ((0, r.useEffect)(() => {
      g2.reload && window.location.reload();
    }, [g2.reload]), g2.reload) ? null : (0, t.jsxs)(s.Provider, { value: g2.enabled, children: [Object.keys(m2).length > 0 && (0, t.jsx)("div", { id: "mediavine-settings", hidden: true, ...m2 }), (0, t.jsx)(i.Provider, { value: d2, children: e2 }), g2.enabled && (0, t.jsx)(_, {})] });
  }, "useAdLoadState", 0, () => (0, r.useContext)(i), "useAdsEnabled", 0, () => (0, r.useContext)(s)], 23524);
}, 3823, (e) => {
  "use strict";
  let t = "krillion:modal-change", r = "data-krillion-settings-open";
  function n() {
    window.dispatchEvent(new Event(t));
  }
  e.s(["MODAL_CHANGE_EVENT", 0, t, "isBlockingModalOpen", 0, function() {
    return "u" > typeof document && document.documentElement.hasAttribute(r) || "u" > typeof document && null !== document.querySelector("dialog[open]");
  }, "notifyModalChange", 0, n, "setSettingsModalOpen", 0, function(e2) {
    "u" > typeof document && (document.documentElement.toggleAttribute(r, e2), n());
  }]);
}, 84297, (e, t, r) => {
  t.exports = { id: "google-analytics", description: "Install a Google Analytics tag on your website", website: "https://analytics.google.com/analytics/web/", scripts: [{ url: "https://www.googletagmanager.com/gtag/js", params: ["id"], strategy: "worker", location: "head", action: "append" }, { code: "window.dataLayer=window.dataLayer||[];window.gtag=function gtag(){window.dataLayer.push(arguments);};gtag('js',new Date());gtag('config','${args.id}')", strategy: "worker", location: "head", action: "append" }] };
}, 92135, (e, t, r) => {
  "use strict";
  function n(e2, t2, r2 = false) {
    return t2 ? Object.keys(e2).filter((e3) => r2 ? !t2.includes(e3) : t2.includes(e3)).reduce((t3, r3) => (t3[r3] = e2[r3], t3), {}) : {};
  }
  function o(e2, t2, r2, n2) {
    let o2 = n2 && Object.keys(n2).length > 0 ? new URL(Object.values(n2)[0], e2) : new URL(e2);
    return t2 && r2 && t2.forEach((e3) => {
      r2[e3] && o2.searchParams.set(e3, r2[e3]);
    }), o2.toString();
  }
  function a(e2, t2, r2, n2, a2) {
    var l;
    if (!t2) return `<${e2}></${e2}>`;
    let u = (null == (l = t2.src) ? void 0 : l.url) ? Object.assign(Object.assign({}, t2), { src: o(t2.src.url, t2.src.params, n2, a2) }) : t2, i = Object.keys(Object.assign(Object.assign({}, u), r2)).reduce((e3, t3) => {
      let n3 = null == r2 ? void 0 : r2[t3], o2 = u[t3], a3 = null != n3 ? n3 : o2, l2 = true === a3 ? t3 : `${t3}="${a3}"`;
      return a3 ? e3 + ` ${l2}` : e3;
    }, "");
    return `<${e2}${i}></${e2}>`;
  }
  Object.defineProperty(r, "__esModule", { value: true }), r.formatData = r.createHtml = r.formatUrl = void 0, r.formatUrl = o, r.createHtml = a, r.formatData = function(e2, t2) {
    var r2, l, u, i, s;
    let c = n(t2, null == (r2 = e2.scripts) ? void 0 : r2.reduce((e3, t3) => [...e3, ...Array.isArray(t3.params) ? t3.params : []], [])), d = n(t2, null == (u = null == (l = e2.html) ? void 0 : l.attributes.src) ? void 0 : u.params), f = n(t2, [null == (s = null == (i = e2.html) ? void 0 : i.attributes.src) ? void 0 : s.slugParam]), p = n(t2, [...Object.keys(c), ...Object.keys(d), ...Object.keys(f)], true);
    return Object.assign(Object.assign({}, e2), { html: e2.html ? a(e2.html.element, e2.html.attributes, p, d, f) : null, scripts: e2.scripts ? e2.scripts.map((e3) => Object.assign(Object.assign({}, e3), { url: o(e3.url, e3.params, c) })) : null });
  };
}, 44602, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__rest || function(e2, t2) {
    var r2 = {};
    for (var n2 in e2) Object.prototype.hasOwnProperty.call(e2, n2) && 0 > t2.indexOf(n2) && (r2[n2] = e2[n2]);
    if (null != e2 && "function" == typeof Object.getOwnPropertySymbols) for (var o2 = 0, n2 = Object.getOwnPropertySymbols(e2); o2 < n2.length; o2++) 0 > t2.indexOf(n2[o2]) && Object.prototype.propertyIsEnumerable.call(e2, n2[o2]) && (r2[n2[o2]] = e2[n2[o2]]);
    return r2;
  }, o = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.GoogleAnalytics = void 0;
  let a = o(e.r(84297)), l = e.r(92135);
  r.GoogleAnalytics = (e2) => {
    var t2 = n(e2, []);
    return (0, l.formatData)(a.default, t2);
  };
}, 60262, (e, t, r) => {
  t.exports = { id: "google-maps-embed", description: "Embed a Google Maps embed on your webpage", website: "https://developers.google.com/maps/documentation/embed/get-started", html: { element: "iframe", attributes: { loading: "lazy", src: { url: "https://www.google.com/maps/embed/v1/place", slugParam: "mode", params: ["key", "q", "center", "zoom", "maptype", "language", "region"] }, referrerpolicy: "no-referrer-when-downgrade", frameborder: "0", style: "border:0", allowfullscreen: true, width: null, height: null } } };
}, 77813, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__rest || function(e2, t2) {
    var r2 = {};
    for (var n2 in e2) Object.prototype.hasOwnProperty.call(e2, n2) && 0 > t2.indexOf(n2) && (r2[n2] = e2[n2]);
    if (null != e2 && "function" == typeof Object.getOwnPropertySymbols) for (var o2 = 0, n2 = Object.getOwnPropertySymbols(e2); o2 < n2.length; o2++) 0 > t2.indexOf(n2[o2]) && Object.prototype.propertyIsEnumerable.call(e2, n2[o2]) && (r2[n2[o2]] = e2[n2[o2]]);
    return r2;
  }, o = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.GoogleMapsEmbed = void 0;
  let a = o(e.r(60262)), l = e.r(92135);
  r.GoogleMapsEmbed = (e2) => {
    var t2 = n(e2, []);
    return (0, l.formatData)(a.default, t2);
  };
}, 40674, (e, t, r) => {
  t.exports = { id: "youtube-embed", description: "Embed a YouTube embed on your webpage.", website: "https://github.com/paulirish/lite-youtube-embed", html: { element: "lite-youtube", attributes: { videoid: null, playlabel: null } }, stylesheets: ["https://cdn.jsdelivr.net/gh/paulirish/lite-youtube-embed@master/src/lite-yt-embed.css"], scripts: [{ url: "https://cdn.jsdelivr.net/gh/paulirish/lite-youtube-embed@master/src/lite-yt-embed.js", strategy: "idle", location: "head", action: "append" }] };
}, 15465, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__rest || function(e2, t2) {
    var r2 = {};
    for (var n2 in e2) Object.prototype.hasOwnProperty.call(e2, n2) && 0 > t2.indexOf(n2) && (r2[n2] = e2[n2]);
    if (null != e2 && "function" == typeof Object.getOwnPropertySymbols) for (var o2 = 0, n2 = Object.getOwnPropertySymbols(e2); o2 < n2.length; o2++) 0 > t2.indexOf(n2[o2]) && Object.prototype.propertyIsEnumerable.call(e2, n2[o2]) && (r2[n2[o2]] = e2[n2[o2]]);
    return r2;
  }, o = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.YouTubeEmbed = void 0;
  let a = o(e.r(40674)), l = e.r(92135);
  r.YouTubeEmbed = (e2) => {
    var t2 = n(e2, []);
    return (0, l.formatData)(a.default, t2);
  };
}, 81498, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), r.YouTubeEmbed = r.GoogleMapsEmbed = r.GoogleAnalytics = void 0;
  var n = e.r(44602);
  Object.defineProperty(r, "GoogleAnalytics", { enumerable: true, get: function() {
    return n.GoogleAnalytics;
  } });
  var o = e.r(77813);
  Object.defineProperty(r, "GoogleMapsEmbed", { enumerable: true, get: function() {
    return o.GoogleMapsEmbed;
  } });
  var a = e.r(15465);
  Object.defineProperty(r, "YouTubeEmbed", { enumerable: true, get: function() {
    return a.YouTubeEmbed;
  } });
}, 61316, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), r.default = function({ html: e2, height: t2 = null, width: r2 = null, children: a, dataNtpc: l = "" }) {
    return (0, o.useEffect)(() => {
      l && performance.mark("mark_feature_usage", { detail: { feature: `next-third-parties-${l}` } });
    }, [l]), (0, n.jsxs)(n.Fragment, { children: [a, e2 ? (0, n.jsx)("div", { style: { height: null != t2 ? `${t2}px` : "auto", width: null != r2 ? `${r2}px` : "auto" }, "data-ntpc": l, dangerouslySetInnerHTML: { __html: e2 } }) : null] });
  };
  let n = e.r(43476), o = e.r(71645);
}, 67345, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.default = function(e2) {
    let { apiKey: t2, ...r2 } = e2, n2 = { ...r2, key: t2 }, { html: u } = (0, a.GoogleMapsEmbed)(n2);
    return (0, o.jsx)(l.default, { height: n2.height || null, width: n2.width || null, html: u, dataNtpc: "GoogleMapsEmbed" });
  };
  let o = e.r(43476), a = e.r(81498), l = n(e.r(61316));
}, 21783, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.default = function(e2) {
    let { html: t2, scripts: r2, stylesheets: n2 } = (0, l.YouTubeEmbed)(e2);
    return (0, o.jsx)(u.default, { height: e2.height || null, width: e2.width || null, html: t2, dataNtpc: "YouTubeEmbed", children: null == r2 ? void 0 : r2.map((e3) => (0, o.jsx)(a.default, { src: e3.url, strategy: i[e3.strategy], stylesheets: n2 }, e3.url)) });
  };
  let o = e.r(43476), a = n(e.r(3303)), l = e.r(81498), u = n(e.r(61316)), i = { server: "beforeInteractive", client: "afterInteractive", idle: "lazyOnload", worker: "worker" };
}, 19598, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.sendGTMEvent = void 0, r.GoogleTagManager = function(e2) {
    let { gtmId: t2, gtmScriptUrl: r2, dataLayerName: n2 = "dataLayer", auth: i, preview: s, dataLayer: c, nonce: d } = e2;
    u = n2;
    let f = new URL(r2 || "https://www.googletagmanager.com/gtm.js");
    return t2 && f.searchParams.set("id", t2), "dataLayer" !== n2 && f.searchParams.set("l", n2), i && f.searchParams.set("gtm_auth", i), s && (f.searchParams.set("gtm_preview", s), f.searchParams.set("gtm_cookies_win", "x")), (0, a.useEffect)(() => {
      performance.mark("mark_feature_usage", { detail: { feature: "next-third-parties-gtm" } });
    }, []), (0, o.jsxs)(o.Fragment, { children: [(0, o.jsx)(l.default, { id: "_next-gtm-init", dangerouslySetInnerHTML: { __html: `
      (function(w,l){
        w[l]=w[l]||[];
        w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
        ${c ? `w[l].push(${JSON.stringify(c)})` : ""}
      })(window,'${n2}');` }, nonce: d }), (0, o.jsx)(l.default, { id: "_next-gtm", "data-ntpc": "GTM", src: f.href, nonce: d })] });
  };
  let o = e.r(43476), a = e.r(71645), l = n(e.r(3303)), u = "dataLayer";
  r.sendGTMEvent = (e2, t2) => {
    let r2 = t2 || u;
    window[r2] = window[r2] || [], window[r2].push(e2);
  };
}, 54576, (e, t, r) => {
  "use strict";
  let n;
  var o = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.GoogleAnalytics = function(e2) {
    let { gaId: t2, debugMode: r2, dataLayerName: o2 = "dataLayer", nonce: i } = e2;
    return void 0 === n && (n = o2), (0, l.useEffect)(() => {
      performance.mark("mark_feature_usage", { detail: { feature: "next-third-parties-ga" } });
    }, []), (0, a.jsxs)(a.Fragment, { children: [(0, a.jsx)(u.default, { id: "_next-ga-init", dangerouslySetInnerHTML: { __html: `
          window['${o2}'] = window['${o2}'] || [];
          function gtag(){window['${o2}'].push(arguments);}
          gtag('js', new Date());

          gtag('config', '${t2}' ${r2 ? ",{ 'debug_mode': true }" : ""});` }, nonce: i }), (0, a.jsx)(u.default, { id: "_next-ga", src: `https://www.googletagmanager.com/gtag/js?id=${t2}`, nonce: i })] });
  }, r.sendGAEvent = function() {
    void 0 === n ? console.warn("@next/third-parties: GA has not been initialized") : window[n] ? window[n].push(arguments) : console.warn(`@next/third-parties: GA dataLayer ${n} does not exist`);
  };
  let a = e.r(43476), l = e.r(71645), u = o(e.r(3303));
}, 87644, (e, t, r) => {
  "use strict";
  var n = e.e && e.e.__importDefault || function(e2) {
    return e2 && e2.__esModule ? e2 : { default: e2 };
  };
  Object.defineProperty(r, "__esModule", { value: true }), r.sendGAEvent = r.GoogleAnalytics = r.sendGTMEvent = r.GoogleTagManager = r.YouTubeEmbed = r.GoogleMapsEmbed = void 0;
  var o = e.r(67345);
  Object.defineProperty(r, "GoogleMapsEmbed", { enumerable: true, get: function() {
    return n(o).default;
  } });
  var a = e.r(21783);
  Object.defineProperty(r, "YouTubeEmbed", { enumerable: true, get: function() {
    return n(a).default;
  } });
  var l = e.r(19598);
  Object.defineProperty(r, "GoogleTagManager", { enumerable: true, get: function() {
    return l.GoogleTagManager;
  } }), Object.defineProperty(r, "sendGTMEvent", { enumerable: true, get: function() {
    return l.sendGTMEvent;
  } });
  var u = e.r(54576);
  Object.defineProperty(r, "GoogleAnalytics", { enumerable: true, get: function() {
    return u.GoogleAnalytics;
  } }), Object.defineProperty(r, "sendGAEvent", { enumerable: true, get: function() {
    return u.sendGAEvent;
  } });
}, 39233, (e) => {
  "use strict";
  var t = e.i(87644);
  e.s(["track", 0, function(e2, r) {
    try {
      (0, t.sendGAEvent)("event", e2, r ?? {});
    } catch {
    }
  }]);
}, 98183, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { assign: function() {
    return i;
  }, searchParamsToUrlQuery: function() {
    return a;
  }, urlQueryToSearchParams: function() {
    return u;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  function a(e2) {
    let t2 = {};
    for (let [r2, n2] of e2.entries()) {
      let e3 = t2[r2];
      void 0 === e3 ? t2[r2] = n2 : Array.isArray(e3) ? e3.push(n2) : t2[r2] = [e3, n2];
    }
    return t2;
  }
  function l(e2) {
    return "string" == typeof e2 ? e2 : ("number" != typeof e2 || isNaN(e2)) && "boolean" != typeof e2 ? "" : String(e2);
  }
  function u(e2) {
    let t2 = new URLSearchParams();
    for (let [r2, n2] of Object.entries(e2)) if (Array.isArray(n2)) for (let e3 of n2) t2.append(r2, l(e3));
    else t2.set(r2, l(n2));
    return t2;
  }
  function i(e2, ...t2) {
    for (let r2 of t2) {
      for (let t3 of r2.keys()) e2.delete(t3);
      for (let [t3, n2] of r2.entries()) e2.append(t3, n2);
    }
    return e2;
  }
}, 18967, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { DecodeError: function() {
    return b;
  }, MiddlewareNotFoundError: function() {
    return w;
  }, MissingStaticPage: function() {
    return _;
  }, NormalizeError: function() {
    return h;
  }, PageNotFoundError: function() {
    return v;
  }, SP: function() {
    return m;
  }, ST: function() {
    return y;
  }, WEB_VITALS: function() {
    return a;
  }, execOnce: function() {
    return l;
  }, getDisplayName: function() {
    return d;
  }, getLocationOrigin: function() {
    return s;
  }, getURL: function() {
    return c;
  }, isAbsoluteUrl: function() {
    return i;
  }, isResSent: function() {
    return f;
  }, loadGetInitialProps: function() {
    return g;
  }, normalizeRepeatedSlashes: function() {
    return p;
  }, stringifyError: function() {
    return O;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  let a = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"];
  function l(e2) {
    let t2, r2 = false;
    return (...n2) => (r2 || (r2 = true, t2 = e2(...n2)), t2);
  }
  let u = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/, i = (e2) => u.test(e2);
  function s() {
    let { protocol: e2, hostname: t2, port: r2 } = window.location;
    return `${e2}//${t2}${r2 ? ":" + r2 : ""}`;
  }
  function c() {
    let { href: e2 } = window.location, t2 = s();
    return e2.substring(t2.length);
  }
  function d(e2) {
    return "string" == typeof e2 ? e2 : e2.displayName || e2.name || "Unknown";
  }
  function f(e2) {
    return e2.finished || e2.headersSent;
  }
  function p(e2) {
    let t2 = e2.split("?");
    return t2[0].replace(/\\/g, "/").replace(/\/\/+/g, "/") + (t2[1] ? `?${t2.slice(1).join("?")}` : "");
  }
  async function g(e2, t2) {
    let r2 = t2.res || t2.ctx && t2.ctx.res;
    if (!e2.getInitialProps) return t2.ctx && t2.Component ? { pageProps: await g(t2.Component, t2.ctx) } : {};
    let n2 = await e2.getInitialProps(t2);
    if (r2 && f(r2)) return n2;
    if (!n2) throw Object.defineProperty(Error(`"${d(e2)}.getInitialProps()" should resolve to an object. But found "${n2}" instead.`), "__NEXT_ERROR_CODE", { value: "E1025", enumerable: false, configurable: true });
    return n2;
  }
  let m = "u" > typeof performance, y = m && ["mark", "measure", "getEntriesByName"].every((e2) => "function" == typeof performance[e2]);
  class b extends Error {
  }
  class h extends Error {
  }
  class v extends Error {
    constructor(e2) {
      super(), this.code = "ENOENT", this.name = "PageNotFoundError", this.message = `Cannot find module for page: ${e2}`;
    }
  }
  class _ extends Error {
    constructor(e2, t2) {
      super(), this.message = `Failed to load static file for page: ${e2} ${t2}`;
    }
  }
  class w extends Error {
    constructor() {
      super(), this.code = "ENOENT", this.message = "Cannot find the middleware module";
    }
  }
  function O(e2) {
    return JSON.stringify({ message: e2.message, stack: e2.stack });
  }
}, 33525, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "warnOnce", { enumerable: true, get: function() {
    return n;
  } });
  let n = (e2) => {
  };
}, 95057, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { formatUrl: function() {
    return u;
  }, formatWithValidation: function() {
    return s;
  }, urlObjectKeys: function() {
    return i;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  let a = e.r(90809)._(e.r(98183)), l = /https?|ftp|gopher|file/;
  function u(e2) {
    let { auth: t2, hostname: r2 } = e2, n2 = e2.protocol || "", o2 = e2.pathname || "", u2 = e2.hash || "", i2 = e2.query || "", s2 = false;
    t2 = t2 ? encodeURIComponent(t2).replace(/%3A/i, ":") + "@" : "", e2.host ? s2 = t2 + e2.host : r2 && (s2 = t2 + (~r2.indexOf(":") ? `[${r2}]` : r2), e2.port && (s2 += ":" + e2.port)), i2 && "object" == typeof i2 && (i2 = String(a.urlQueryToSearchParams(i2)));
    let c = e2.search || i2 && `?${i2}` || "";
    return n2 && !n2.endsWith(":") && (n2 += ":"), e2.slashes || (!n2 || l.test(n2)) && false !== s2 ? (s2 = "//" + (s2 || ""), o2 && "/" !== o2[0] && (o2 = "/" + o2)) : s2 || (s2 = ""), u2 && "#" !== u2[0] && (u2 = "#" + u2), c && "?" !== c[0] && (c = "?" + c), o2 = o2.replace(/[?#]/g, encodeURIComponent), c = c.replace("#", "%23"), `${n2}${s2}${o2}${c}${u2}`;
  }
  let i = ["auth", "hash", "host", "hostname", "href", "path", "pathname", "port", "protocol", "query", "search", "slashes"];
  function s(e2) {
    return u(e2);
  }
}, 18581, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "useMergedRef", { enumerable: true, get: function() {
    return o;
  } });
  let n = e.r(71645);
  function o(e2, t2) {
    let r2 = (0, n.useRef)(null), o2 = (0, n.useRef)(null);
    return (0, n.useCallback)((n2) => {
      if (null === n2) {
        let e3 = r2.current;
        e3 && (r2.current = null, e3());
        let t3 = o2.current;
        t3 && (o2.current = null, t3());
      } else e2 && (r2.current = a(e2, n2)), t2 && (o2.current = a(t2, n2));
    }, [e2, t2]);
  }
  function a(e2, t2) {
    if ("function" != typeof e2) return e2.current = t2, () => {
      e2.current = null;
    };
    {
      let r2 = e2(t2);
      return "function" == typeof r2 ? r2 : () => e2(null);
    }
  }
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 73668, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "isLocalURL", { enumerable: true, get: function() {
    return a;
  } });
  let n = e.r(18967), o = e.r(52817);
  function a(e2) {
    if (!(0, n.isAbsoluteUrl)(e2)) return true;
    try {
      let t2 = (0, n.getLocationOrigin)(), r2 = new URL(e2, t2);
      return r2.origin === t2 && (0, o.hasBasePath)(r2.pathname);
    } catch (e3) {
      return false;
    }
  }
}, 84508, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true }), Object.defineProperty(r, "errorOnce", { enumerable: true, get: function() {
    return n;
  } });
  let n = (e2) => {
  };
}, 22016, (e, t, r) => {
  "use strict";
  Object.defineProperty(r, "__esModule", { value: true });
  var n = { default: function() {
    return b;
  }, useLinkStatus: function() {
    return v;
  } };
  for (var o in n) Object.defineProperty(r, o, { enumerable: true, get: n[o] });
  let a = e.r(90809), l = e.r(43476), u = a._(e.r(71645)), i = e.r(95057), s = e.r(65347), c = e.r(18581), d = e.r(18967), f = e.r(5550);
  e.r(33525);
  let p = e.r(88540), g = e.r(91949), m = e.r(73668), y = e.r(9396);
  function b(t2) {
    var r2, n2;
    let o2, a2, b2, [v2, _] = (0, u.useOptimistic)(g.IDLE_LINK_STATUS), w = (0, u.useRef)(null), { href: O, as: E, children: j, prefetch: P = null, passHref: S, replace: x, shallow: M, scroll: A, onClick: T, onMouseEnter: k, onTouchStart: C, legacyBehavior: L = false, onNavigate: I, transitionTypes: G, ref: $, unstable_dynamicOnHover: R, ...N } = t2;
    o2 = j, L && ("string" == typeof o2 || "number" == typeof o2) && (o2 = (0, l.jsx)("a", { children: o2 }));
    let D = u.default.useContext(s.AppRouterContext), U = false !== P, H = false !== P ? null === (n2 = P) || "auto" === n2 ? y.FetchStrategy.PPR : y.FetchStrategy.Full : y.FetchStrategy.PPR, F = "string" == typeof (r2 = E || O) ? r2 : (0, i.formatUrl)(r2);
    if (L) {
      if (o2?.$$typeof === /* @__PURE__ */ Symbol.for("react.lazy")) throw Object.defineProperty(Error("`<Link legacyBehavior>` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's `<a>` tag."), "__NEXT_ERROR_CODE", { value: "E863", enumerable: false, configurable: true });
      a2 = u.default.Children.only(o2);
    }
    let B = L ? a2 && "object" == typeof a2 && a2.ref : $, q = u.default.useCallback((e2) => (null !== D && (w.current = (0, g.mountLinkInstance)(e2, F, D, H, U, _)), () => {
      w.current && ((0, g.unmountLinkForCurrentNavigation)(w.current), w.current = null), (0, g.unmountPrefetchableInstance)(e2);
    }), [U, F, D, H, _]), z = { ref: (0, c.useMergedRef)(q, B), onClick(t3) {
      L || "function" != typeof T || T(t3), L && a2.props && "function" == typeof a2.props.onClick && a2.props.onClick(t3), !D || t3.defaultPrevented || (function(t4, r3, n3, o3, a3, l2, i2) {
        if ("u" > typeof window) {
          let s2, { nodeName: c2 } = t4.currentTarget;
          if ("A" === c2.toUpperCase() && ((s2 = t4.currentTarget.getAttribute("target")) && "_self" !== s2 || t4.metaKey || t4.ctrlKey || t4.shiftKey || t4.altKey || t4.nativeEvent && 2 === t4.nativeEvent.which) || t4.currentTarget.hasAttribute("download")) return;
          if (!(0, m.isLocalURL)(r3)) {
            o3 && (t4.preventDefault(), location.replace(r3));
            return;
          }
          if (t4.preventDefault(), l2) {
            let e2 = false;
            if (l2({ preventDefault: () => {
              e2 = true;
            } }), e2) return;
          }
          let { dispatchNavigateAction: d2 } = e.r(99781);
          u.default.startTransition(() => {
            d2(r3, o3 ? "replace" : "push", false === a3 ? p.ScrollBehavior.NoScroll : p.ScrollBehavior.Default, n3.current, i2);
          });
        }
      })(t3, F, w, x, A, I, G);
    }, onMouseEnter(e2) {
      L || "function" != typeof k || k(e2), L && a2.props && "function" == typeof a2.props.onMouseEnter && a2.props.onMouseEnter(e2), D && U && (0, g.onNavigationIntent)(e2.currentTarget, true === R);
    }, onTouchStart: function(e2) {
      L || "function" != typeof C || C(e2), L && a2.props && "function" == typeof a2.props.onTouchStart && a2.props.onTouchStart(e2), D && U && (0, g.onNavigationIntent)(e2.currentTarget, true === R);
    } };
    return (0, d.isAbsoluteUrl)(F) ? z.href = F : L && !S && ("a" !== a2.type || "href" in a2.props) || (z.href = (0, f.addBasePath)(F)), b2 = L ? u.default.cloneElement(a2, z) : (0, l.jsx)("a", { ...N, ...z, children: o2 }), (0, l.jsx)(h.Provider, { value: v2, children: b2 });
  }
  e.r(84508);
  let h = (0, u.createContext)(g.IDLE_LINK_STATUS), v = () => (0, u.useContext)(h);
  ("function" == typeof r.default || "object" == typeof r.default && null !== r.default) && void 0 === r.default.__esModule && (Object.defineProperty(r.default, "__esModule", { value: true }), Object.assign(r.default, r), t.exports = r.default);
}, 36484, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(99363);
  e.s(["default", 0, function({ src: e2 = "/tiers/krillion.png", alt: n = "", ...o }) {
    let a = (0, r.useSeasonalKrillSprite)(e2);
    return (0, t.jsx)("img", { ...o, src: a, alt: n });
  }]);
}]);
