(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 21166, (e) => {
  e.v({ account: "SettingsControl-module__MfdTzG__account", accountLink: "SettingsControl-module__MfdTzG__accountLink", backdrop: "SettingsControl-module__MfdTzG__backdrop", close: "SettingsControl-module__MfdTzG__close", dialog: "SettingsControl-module__MfdTzG__dialog", preference: "SettingsControl-module__MfdTzG__preference", preferenceCopy: "SettingsControl-module__MfdTzG__preferenceCopy", preferenceDescription: "SettingsControl-module__MfdTzG__preferenceDescription", preferenceLabel: "SettingsControl-module__MfdTzG__preferenceLabel", preferenceList: "SettingsControl-module__MfdTzG__preferenceList", rule: "SettingsControl-module__MfdTzG__rule", thumb: "SettingsControl-module__MfdTzG__thumb", toggle: "SettingsControl-module__MfdTzG__toggle", track: "SettingsControl-module__MfdTzG__track", trigger: "SettingsControl-module__MfdTzG__trigger" });
}, 88671, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(71645), r = e.i(37812), i = e.i(33385), a = e.i(39233), l = e.i(67334);
  e.s(["default", 0, function() {
    let s = (0, l.useAccount)(), [o, c] = (0, n.useState)(false), [d, u] = (0, n.useState)("idle");
    if ((0, n.useEffect)(() => {
      let e2 = requestAnimationFrame(() => c((0, i.hasAnyLocalUnlock)() && !(0, r.loadGoogleLinked)()));
      return () => cancelAnimationFrame(e2);
    }, []), !o || s.user) return null;
    let f = async () => {
      if ("linking" !== d) {
        u("linking");
        try {
          let { firebaseAuth: t2, withTimeout: n2 } = await e.A(29087), l2 = await t2(), { GoogleAuthProvider: s2, linkWithPopup: o2, signInWithPopup: d2, signInAnonymously: f2 } = await e.A(3975);
          l2.currentUser || await f2(l2);
          let h = new s2(), m = l2.currentUser;
          try {
            m = (await n2(o2(m, h))).user;
          } catch (t3) {
            let e2 = t3.code ?? "";
            if ("auth/credential-already-in-use" === e2 || "auth/email-already-in-use" === e2) m = (await n2(d2(l2, h))).user;
            else throw t3;
          }
          let p = await m.getIdToken(), g = await (0, i.bindLocalPurchases)(p);
          if (0 === g) throw Error("bind failed");
          (0, r.saveGoogleLinked)(), (0, a.track)("unlock_linked", { bound: g }), u("done"), setTimeout(() => c(false), 2500);
        } catch {
          u("error");
        }
      }
    };
    return (0, t.jsx)("div", { className: "border-t border-[var(--hairline)] pt-3 flex items-center justify-between gap-3", children: "done" === d ? (0, t.jsx)("p", { className: "font-mono-ui text-[12px] tracking-[0.14em] uppercase text-lumen-cyan", children: "linked. your unlock follows your google account now." }) : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("p", { className: "font-mono-ui text-[12px] text-drift/70 max-w-[26ch]", children: "error" === d ? "Linking didn't complete. Try again?" : "Keep your unlock if this device is lost:" }), (0, t.jsx)("button", { onClick: f, className: "btn-quiet whitespace-nowrap", disabled: "linking" === d, children: "linking" === d ? "linking\u2026" : "Link Google" })] }) });
  }]);
}, 88143, (e, t, n) => {
  "use strict";
  function r({ widthInt: e2, heightInt: t2, blurWidth: n2, blurHeight: i, blurDataURL: a, objectFit: l }) {
    let s = n2 ? 40 * n2 : e2, o = i ? 40 * i : t2, c = s && o ? `viewBox='0 0 ${s} ${o}'` : "";
    return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${c}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${c ? "none" : "contain" === l ? "xMidYMid" : "cover" === l ? "xMidYMid slice" : "none"}' style='filter: url(%23b);' href='${a}'/%3E%3C/svg%3E`;
  }
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "getImageBlurSvg", { enumerable: true, get: function() {
    return r;
  } });
}, 87690, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true });
  var r = { VALID_LOADERS: function() {
    return a;
  }, imageConfigDefault: function() {
    return l;
  } };
  for (var i in r) Object.defineProperty(n, i, { enumerable: true, get: r[i] });
  let a = ["default", "imgix", "cloudinary", "akamai", "custom"], l = { deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], imageSizes: [32, 48, 64, 96, 128, 256, 384], path: "/_next/image", loader: "default", loaderFile: "", domains: [], disableStaticImages: false, minimumCacheTTL: 14400, formats: ["image/webp"], maximumDiskCacheSize: void 0, maximumRedirects: 3, maximumResponseBody: 5e7, dangerouslyAllowLocalIP: false, dangerouslyAllowSVG: false, contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;", contentDispositionType: "attachment", localPatterns: void 0, remotePatterns: [], qualities: [75], unoptimized: false, customCacheHandler: false };
}, 8927, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "getImgProps", { enumerable: true, get: function() {
    return c;
  } }), e.r(33525);
  let r = e.r(43369), i = e.r(88143), a = e.r(87690), l = ["-moz-initial", "fill", "none", "scale-down", void 0];
  function s(e2) {
    return void 0 !== e2.default;
  }
  function o(e2) {
    return void 0 === e2 ? e2 : "number" == typeof e2 ? Number.isFinite(e2) ? e2 : NaN : "string" == typeof e2 && /^[0-9]+$/.test(e2) ? parseInt(e2, 10) : NaN;
  }
  function c({ src: e2, sizes: t2, unoptimized: n2 = false, priority: d = false, preload: u = false, loading: f, className: h, quality: m, width: p, height: g, fill: v = false, style: y, overrideSrc: b, onLoad: _, onLoadingComplete: x, placeholder: w = "empty", blurDataURL: j, fetchPriority: k, decoding: S = "async", layout: C, objectFit: E, objectPosition: M, lazyBoundary: N, lazyRoot: O, ...P }, H) {
    var R;
    let A, z, L, { imgConf: D, showAltText: T, blurComplete: I, defaultLoader: G } = H, $ = D || a.imageConfigDefault;
    if ("allSizes" in $) A = $;
    else {
      let e3 = [...$.deviceSizes, ...$.imageSizes].sort((e4, t4) => e4 - t4), t3 = $.deviceSizes.sort((e4, t4) => e4 - t4), n3 = $.qualities?.sort((e4, t4) => e4 - t4);
      A = { ...$, allSizes: e3, deviceSizes: t3, qualities: n3 };
    }
    if (void 0 === G) throw Object.defineProperty(Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"), "__NEXT_ERROR_CODE", { value: "E163", enumerable: false, configurable: true });
    let V = P.loader || G;
    delete P.loader, delete P.srcSet;
    let q = "__next_img_default" in V;
    if (q) {
      if ("custom" === A.loader) throw Object.defineProperty(Error(`Image with src "${e2}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`), "__NEXT_ERROR_CODE", { value: "E252", enumerable: false, configurable: true });
    } else {
      let e3 = V;
      V = (t3) => {
        let { config: n3, ...r2 } = t3;
        return e3(r2);
      };
    }
    if (C) {
      "fill" === C && (v = true);
      let e3 = { intrinsic: { maxWidth: "100%", height: "auto" }, responsive: { width: "100%", height: "auto" } }[C];
      e3 && (y = { ...y, ...e3 });
      let n3 = { responsive: "100vw", fill: "100vw" }[C];
      n3 && !t2 && (t2 = n3);
    }
    let F = "", W = o(p), U = o(g);
    if ((R = e2) && "object" == typeof R && (s(R) || void 0 !== R.src)) {
      let t3 = s(e2) ? e2.default : e2;
      if (!t3.src) throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(t3)}`), "__NEXT_ERROR_CODE", { value: "E460", enumerable: false, configurable: true });
      if (!t3.height || !t3.width) throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(t3)}`), "__NEXT_ERROR_CODE", { value: "E48", enumerable: false, configurable: true });
      if (z = t3.blurWidth, L = t3.blurHeight, j = j || t3.blurDataURL, F = t3.src, !v) if (W || U) {
        if (W && !U) {
          let e3 = W / t3.width;
          U = Math.round(t3.height * e3);
        } else if (!W && U) {
          let e3 = U / t3.height;
          W = Math.round(t3.width * e3);
        }
      } else W = t3.width, U = t3.height;
    }
    let B = !d && !u && ("lazy" === f || void 0 === f);
    (!(e2 = "string" == typeof e2 ? e2 : F) || e2.startsWith("data:") || e2.startsWith("blob:")) && (n2 = true, B = false), A.unoptimized && (n2 = true), q && !A.dangerouslyAllowSVG && e2.split("?", 1)[0].endsWith(".svg") && (n2 = true);
    let Z = o(m), K = Object.assign(v ? { position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0, objectFit: E, objectPosition: M } : {}, T ? {} : { color: "transparent" }, y), J = I || "empty" === w ? null : "blur" === w ? `url("data:image/svg+xml;charset=utf-8,${(0, i.getImageBlurSvg)({ widthInt: W, heightInt: U, blurWidth: z, blurHeight: L, blurDataURL: j || "", objectFit: K.objectFit })}")` : `url("${w}")`, X = l.includes(K.objectFit) ? "fill" === K.objectFit ? "100% 100%" : "cover" : K.objectFit, Y = J ? { backgroundSize: X, backgroundPosition: K.objectPosition || "50% 50%", backgroundRepeat: "no-repeat", backgroundImage: J } : {}, Q = (function({ config: e3, src: t3, unoptimized: n3, width: i2, quality: a2, sizes: l2, loader: s2 }) {
      if (n3) {
        if (t3.startsWith("/") && !t3.startsWith("//")) {
          let e4 = (0, r.getDeploymentId)();
          if (e4) {
            let n4 = t3.indexOf("?");
            if (-1 !== n4) {
              let r2 = new URLSearchParams(t3.slice(n4 + 1));
              r2.get("dpl") || (r2.append("dpl", e4), t3 = t3.slice(0, n4) + "?" + r2.toString());
            } else t3 += `?dpl=${e4}`;
          }
        }
        return { src: t3, srcSet: void 0, sizes: void 0 };
      }
      let { widths: o2, kind: c2 } = (function({ deviceSizes: e4, allSizes: t4 }, n4, r2) {
        if (r2) {
          let n5 = /(^|\s)(1?\d?\d)vw/g, i3 = [];
          for (let e5; e5 = n5.exec(r2); ) i3.push(parseInt(e5[2]));
          if (i3.length) {
            let n6 = 0.01 * Math.min(...i3);
            return { widths: t4.filter((t5) => t5 >= e4[0] * n6), kind: "w" };
          }
          return { widths: t4, kind: "w" };
        }
        return "number" != typeof n4 ? { widths: e4, kind: "w" } : { widths: [...new Set([n4, 2 * n4].map((e5) => t4.find((t5) => t5 >= e5) || t4[t4.length - 1]))], kind: "x" };
      })(e3, i2, l2), d2 = o2.length - 1;
      return { sizes: l2 || "w" !== c2 ? l2 : "100vw", srcSet: o2.map((n4, r2) => `${s2({ config: e3, src: t3, quality: a2, width: n4 })} ${"w" === c2 ? n4 : r2 + 1}${c2}`).join(", "), src: s2({ config: e3, src: t3, quality: a2, width: o2[d2] }) };
    })({ config: A, src: e2, unoptimized: n2, width: W, quality: Z, sizes: t2, loader: V }), ee = B ? "lazy" : f;
    return { props: { ...P, loading: ee, fetchPriority: k, width: W, height: U, decoding: S, className: h, style: { ...K, ...Y }, sizes: Q.sizes, srcSet: Q.srcSet, src: b || Q.src }, meta: { unoptimized: n2, preload: u || d, placeholder: w, fill: v } };
  }
}, 98879, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "default", { enumerable: true, get: function() {
    return s;
  } });
  let r = e.r(71645), i = "u" < typeof window, a = i ? () => {
  } : r.useLayoutEffect, l = i ? () => {
  } : r.useEffect;
  function s(e2) {
    let { headManager: t2, reduceComponentsToState: n2 } = e2;
    function s2() {
      if (t2 && t2.mountedInstances) {
        let e3 = r.Children.toArray(Array.from(t2.mountedInstances).filter(Boolean));
        t2.updateHead(n2(e3));
      }
    }
    return i && (t2?.mountedInstances?.add(e2.children), s2()), a(() => (t2?.mountedInstances?.add(e2.children), () => {
      t2?.mountedInstances?.delete(e2.children);
    })), a(() => (t2 && (t2._pendingUpdate = s2), () => {
      t2 && (t2._pendingUpdate = s2);
    })), l(() => (t2 && t2._pendingUpdate && (t2._pendingUpdate(), t2._pendingUpdate = null), () => {
      t2 && t2._pendingUpdate && (t2._pendingUpdate(), t2._pendingUpdate = null);
    })), null;
  }
}, 25633, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true });
  var r = { default: function() {
    return p;
  }, defaultHead: function() {
    return u;
  } };
  for (var i in r) Object.defineProperty(n, i, { enumerable: true, get: r[i] });
  let a = e.r(55682), l = e.r(90809), s = e.r(43476), o = l._(e.r(71645)), c = a._(e.r(98879)), d = e.r(42732);
  function u() {
    return [(0, s.jsx)("meta", { charSet: "utf-8" }, "charset"), (0, s.jsx)("meta", { name: "viewport", content: "width=device-width" }, "viewport")];
  }
  function f(e2, t2) {
    return "string" == typeof t2 || "number" == typeof t2 ? e2 : t2.type === o.default.Fragment ? e2.concat(o.default.Children.toArray(t2.props.children).reduce((e3, t3) => "string" == typeof t3 || "number" == typeof t3 ? e3 : e3.concat(t3), [])) : e2.concat(t2);
  }
  e.r(33525);
  let h = ["name", "httpEquiv", "charSet", "itemProp"];
  function m(e2) {
    let t2, n2, r2, i2;
    return e2.reduce(f, []).reverse().concat(u().reverse()).filter((t2 = /* @__PURE__ */ new Set(), n2 = /* @__PURE__ */ new Set(), r2 = /* @__PURE__ */ new Set(), i2 = {}, (e3) => {
      let a2 = true, l2 = false;
      if (e3.key && "number" != typeof e3.key && e3.key.indexOf("$") > 0) {
        l2 = true;
        let n3 = e3.key.slice(e3.key.indexOf("$") + 1);
        t2.has(n3) ? a2 = false : t2.add(n3);
      }
      switch (e3.type) {
        case "title":
        case "base":
          n2.has(e3.type) ? a2 = false : n2.add(e3.type);
          break;
        case "meta":
          for (let t3 = 0, n3 = h.length; t3 < n3; t3++) {
            let n4 = h[t3];
            if (e3.props.hasOwnProperty(n4)) if ("charSet" === n4) r2.has(n4) ? a2 = false : r2.add(n4);
            else {
              let t4 = e3.props[n4], r3 = i2[n4] || /* @__PURE__ */ new Set();
              ("name" !== n4 || !l2) && r3.has(t4) ? a2 = false : (r3.add(t4), i2[n4] = r3);
            }
          }
      }
      return a2;
    })).reverse().map((e3, t3) => {
      let n3 = e3.key || t3;
      return o.default.cloneElement(e3, { key: n3 });
    });
  }
  let p = function({ children: e2 }) {
    let t2 = (0, o.useContext)(d.HeadManagerContext);
    return (0, s.jsx)(c.default, { reduceComponentsToState: m, headManager: t2, children: e2 });
  };
  ("function" == typeof n.default || "object" == typeof n.default && null !== n.default) && void 0 === n.default.__esModule && (Object.defineProperty(n.default, "__esModule", { value: true }), Object.assign(n.default, n), t.exports = n.default);
}, 18556, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "ImageConfigContext", { enumerable: true, get: function() {
    return a;
  } });
  let r = e.r(55682)._(e.r(71645)), i = e.r(87690), a = r.default.createContext(i.imageConfigDefault);
}, 65856, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "RouterContext", { enumerable: true, get: function() {
    return r;
  } });
  let r = e.r(55682)._(e.r(71645)).default.createContext(null);
}, 70965, (e, t, n) => {
  "use strict";
  function r(e2, t2) {
    let n2 = e2 || 75;
    return t2?.qualities?.length ? t2.qualities.reduce((e3, t3) => Math.abs(t3 - n2) < Math.abs(e3 - n2) ? t3 : e3, t2.qualities[0]) : n2;
  }
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "findClosestQuality", { enumerable: true, get: function() {
    return r;
  } });
}, 1948, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "default", { enumerable: true, get: function() {
    return l;
  } });
  let r = e.r(70965), i = e.r(43369);
  function a({ config: e2, src: t2, width: n2, quality: l2 }) {
    let s = (0, i.getDeploymentId)();
    if (t2.startsWith("/") && !t2.startsWith("//")) {
      let e3 = t2.indexOf("?");
      if (-1 !== e3) {
        let n3 = new URLSearchParams(t2.slice(e3 + 1)), r2 = n3.get("dpl");
        if (r2) {
          s = r2, n3.delete("dpl");
          let i2 = n3.toString();
          t2 = t2.slice(0, e3) + (i2 ? "?" + i2 : "");
        }
      }
    }
    if (t2.startsWith("/") && t2.includes("?") && e2.localPatterns?.length === 1 && "**" === e2.localPatterns[0].pathname && "" === e2.localPatterns[0].search) throw Object.defineProperty(Error(`Image with src "${t2}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`), "__NEXT_ERROR_CODE", { value: "E871", enumerable: false, configurable: true });
    let o = (0, r.findClosestQuality)(l2, e2);
    return `${e2.path}?url=${encodeURIComponent(t2)}&w=${n2}&q=${o}${t2.startsWith("/") && s ? `&dpl=${s}` : ""}`;
  }
  a.__next_img_default = true;
  let l = a;
}, 5500, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true }), Object.defineProperty(n, "Image", { enumerable: true, get: function() {
    return _;
  } });
  let r = e.r(55682), i = e.r(90809), a = e.r(43476), l = i._(e.r(71645)), s = r._(e.r(74080)), o = r._(e.r(25633)), c = e.r(8927), d = e.r(87690), u = e.r(18556);
  e.r(33525);
  let f = e.r(65856), h = r._(e.r(1948)), m = e.r(18581), p = { deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], imageSizes: [32, 48, 64, 96, 128, 256, 384], qualities: [75], path: "/_next/image", loader: "default", dangerouslyAllowSVG: false, unoptimized: false };
  function g(e2, t2, n2, r2, i2, a2, l2) {
    let s2 = e2?.src;
    e2 && e2["data-loaded-src"] !== s2 && (e2["data-loaded-src"] = s2, ("decode" in e2 ? e2.decode() : Promise.resolve()).catch(() => {
    }).then(() => {
      if (e2.parentElement && e2.isConnected) {
        if ("empty" !== t2 && i2(true), n2?.current) {
          let t3 = new Event("load");
          Object.defineProperty(t3, "target", { writable: false, value: e2 });
          let r3 = false, i3 = false;
          n2.current({ ...t3, nativeEvent: t3, currentTarget: e2, target: e2, isDefaultPrevented: () => r3, isPropagationStopped: () => i3, persist: () => {
          }, preventDefault: () => {
            r3 = true, t3.preventDefault();
          }, stopPropagation: () => {
            i3 = true, t3.stopPropagation();
          } });
        }
        r2?.current && r2.current(e2);
      }
    }));
  }
  function v(e2) {
    return l.use ? { fetchPriority: e2 } : { fetchpriority: e2 };
  }
  "u" < typeof window && (globalThis.__NEXT_IMAGE_IMPORTED = true);
  let y = (0, l.forwardRef)(({ src: e2, srcSet: t2, sizes: n2, height: r2, width: i2, decoding: s2, className: o2, style: c2, fetchPriority: d2, placeholder: u2, loading: f2, unoptimized: h2, fill: p2, onLoadRef: y2, onLoadingCompleteRef: b2, setBlurComplete: _2, setShowAltText: x, sizesInput: w, onLoad: j, onError: k, ...S }, C) => {
    let E = (0, l.useCallback)((e3) => {
      e3 && (k && (e3.src = e3.src), e3.complete && g(e3, u2, y2, b2, _2, h2, w));
    }, [e2, u2, y2, b2, _2, k, h2, w]), M = (0, m.useMergedRef)(C, E);
    return (0, a.jsx)("img", { ...S, ...v(d2), loading: f2, width: i2, height: r2, decoding: s2, "data-nimg": p2 ? "fill" : "1", className: o2, style: c2, sizes: n2, srcSet: t2, src: e2, ref: M, onLoad: (e3) => {
      g(e3.currentTarget, u2, y2, b2, _2, h2, w);
    }, onError: (e3) => {
      x(true), "empty" !== u2 && _2(true), k && k(e3);
    } });
  });
  function b({ isAppRouter: e2, imgAttributes: t2 }) {
    let n2 = { as: "image", imageSrcSet: t2.srcSet, imageSizes: t2.sizes, crossOrigin: t2.crossOrigin, referrerPolicy: t2.referrerPolicy, ...v(t2.fetchPriority) };
    return e2 && s.default.preload ? (s.default.preload(t2.src, n2), null) : (0, a.jsx)(o.default, { children: (0, a.jsx)("link", { rel: "preload", href: t2.srcSet ? void 0 : t2.src, ...n2 }, "__nimg-" + t2.src + t2.srcSet + t2.sizes) });
  }
  let _ = (0, l.forwardRef)((e2, t2) => {
    let n2 = (0, l.useContext)(f.RouterContext), r2 = (0, l.useContext)(u.ImageConfigContext), i2 = (0, l.useMemo)(() => {
      let e3 = p || r2 || d.imageConfigDefault, t3 = [...e3.deviceSizes, ...e3.imageSizes].sort((e4, t4) => e4 - t4), n3 = e3.deviceSizes.sort((e4, t4) => e4 - t4), i3 = e3.qualities?.sort((e4, t4) => e4 - t4);
      return { ...e3, allSizes: t3, deviceSizes: n3, qualities: i3, localPatterns: "u" < typeof window ? r2?.localPatterns : e3.localPatterns };
    }, [r2]), { onLoad: s2, onLoadingComplete: o2 } = e2, m2 = (0, l.useRef)(s2);
    (0, l.useEffect)(() => {
      m2.current = s2;
    }, [s2]);
    let g2 = (0, l.useRef)(o2);
    (0, l.useEffect)(() => {
      g2.current = o2;
    }, [o2]);
    let [v2, _2] = (0, l.useState)(false), [x, w] = (0, l.useState)(false), { props: j, meta: k } = (0, c.getImgProps)(e2, { defaultLoader: h.default, imgConf: i2, blurComplete: v2, showAltText: x });
    return (0, a.jsxs)(a.Fragment, { children: [(0, a.jsx)(y, { ...j, unoptimized: k.unoptimized, placeholder: k.placeholder, fill: k.fill, onLoadRef: m2, onLoadingCompleteRef: g2, setBlurComplete: _2, setShowAltText: w, sizesInput: e2.sizes, ref: t2 }), k.preload ? (0, a.jsx)(b, { isAppRouter: !n2, imgAttributes: j }) : null] });
  });
  ("function" == typeof n.default || "object" == typeof n.default && null !== n.default) && void 0 === n.default.__esModule && (Object.defineProperty(n.default, "__esModule", { value: true }), Object.assign(n.default, n), t.exports = n.default);
}, 94909, (e, t, n) => {
  "use strict";
  Object.defineProperty(n, "__esModule", { value: true });
  var r = { default: function() {
    return d;
  }, getImageProps: function() {
    return c;
  } };
  for (var i in r) Object.defineProperty(n, i, { enumerable: true, get: r[i] });
  let a = e.r(55682), l = e.r(8927), s = e.r(5500), o = a._(e.r(1948));
  function c(e2) {
    let { props: t2 } = (0, l.getImgProps)(e2, { defaultLoader: o.default, imgConf: { deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], imageSizes: [32, 48, 64, 96, 128, 256, 384], qualities: [75], path: "/_next/image", loader: "default", dangerouslyAllowSVG: false, unoptimized: false } });
    for (let [e3, n2] of Object.entries(t2)) void 0 === n2 && delete t2[e3];
    return { props: t2 };
  }
  let d = s.Image;
}, 57688, (e, t, n) => {
  t.exports = e.r(94909);
}, 1900, 23644, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(71645), r = e.i(23524);
  e.s(["AdPrivacyLocation", 0, function() {
    return (0, r.useAdsEnabled)() ? (0, t.jsx)("div", { "data-ad-privacy-location": "" }) : null;
  }, "default", 0, function() {
    let e2 = (0, r.useAdsEnabled)(), i2 = (0, n.useRef)(null);
    return (0, n.useLayoutEffect)(() => {
      let t2 = i2.current;
      if (!e2 || !t2) return;
      let n2 = document.createElement("div");
      n2.className = "kr-ad-privacy", n2.setAttribute("aria-label", "Privacy choices");
      let r2 = document.createElement("a");
      r2.id = "kr-ad-privacy-anchor", r2.href = "/privacy", r2.textContent = "Privacy", n2.append(r2);
      let a2 = () => {
        let e3 = document.querySelector("[data-ad-privacy-location]") ?? t2;
        n2.parentElement !== e3 && e3.append(n2);
      };
      a2();
      let l2 = new MutationObserver(a2);
      return l2.observe(document.body, { childList: true, subtree: true }), () => {
        l2.disconnect(), n2.remove();
      };
    }, [e2]), (0, t.jsx)("div", { ref: i2, hidden: true });
  }], 1900);
  var i = e.i(22016), a = e.i(12260), l = e.i(3823), s = e.i(88671), o = e.i(21166);
  function c({ restoreHref: e2 = "/restore", onNavigate: r2 }) {
    let l2 = (0, a.usePreferences)(), u = (0, n.useId)();
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsxs)("div", { className: o.default.preferenceList, children: [(0, t.jsx)(d, { label: "Low-power mode", description: "Lighter graphics and fewer background animations.", checked: l2.lowPowerMode, onChange: a.setLowPowerMode }), (0, t.jsx)(d, { label: "Colorblind mode", description: "Brighter text and more separated tier colors.", checked: l2.colorblindMode, onChange: a.setColorblindMode }), (0, t.jsx)(d, { label: "Answer corrections", description: "Preview corrected answers before scoring. Off accepts them immediately.", checked: l2.answerCorrections, onChange: a.setAnswerCorrections }), (0, t.jsx)(d, { label: "Clear rejected entries", description: "Empty the answer box after a failed attempt.", checked: l2.clearRejectedEntry, onChange: a.setClearRejectedEntry }), (0, t.jsx)(d, { label: "Share link", description: "Add a krillion.io link under shared results.", checked: l2.shareLink, onChange: a.setShareLink })] }), (0, t.jsxs)("section", { className: o.default.account, "aria-labelledby": `${u}-purchases`, children: [(0, t.jsx)("p", { className: `fathom ${o.default.rule}`, id: `${u}-purchases`, children: (0, t.jsx)("span", { children: "Account & purchases" }) }), (0, t.jsx)(i.default, { href: "/account", className: `btn-quiet ${o.default.accountLink}`, onClick: r2, children: "My Krillion \u2192" }), (0, t.jsx)(s.default, {}), (0, t.jsxs)("div", { className: "flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3", children: [(0, t.jsx)("p", { className: "font-mono-ui text-[12px] text-drift/70 max-w-[26ch]", children: "Unlocked on another device?" }), (0, t.jsx)(i.default, { href: e2, className: "btn-quiet whitespace-nowrap", onClick: r2, children: "Restore" })] })] }), (0, t.jsxs)("div", { className: "mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono-ui text-[11px] tracking-[0.16em] uppercase text-drift/50", children: [(0, t.jsx)(i.default, { href: "/privacy", className: "underline hover:text-lumen-cyan", onClick: r2, children: "privacy" }), (0, t.jsx)(i.default, { href: "/faq", className: "underline hover:text-lumen-cyan", onClick: r2, children: "faq" }), (0, t.jsx)("a", { href: "https://www.instagram.com/youareoneinakrillion/", target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-lumen-cyan", children: "Instagram" }), (0, t.jsx)("span", { className: "basis-full normal-case tracking-normal leading-relaxed text-drift/80", children: "(PLEASE don't follow @krillion.io on Instagram \u2014 it is an impersonator account. Krillion's only username is @youareoneinakrillion.)" })] })] });
  }
  function d({ label: e2, description: n2, checked: r2, onChange: i2 }) {
    return (0, t.jsxs)("label", { className: o.default.preference, children: [(0, t.jsxs)("span", { className: o.default.preferenceCopy, children: [(0, t.jsx)("span", { className: o.default.preferenceLabel, children: e2 }), (0, t.jsx)("span", { className: o.default.preferenceDescription, children: n2 })] }), (0, t.jsxs)("span", { className: o.default.toggle, children: [(0, t.jsx)("input", { type: "checkbox", checked: r2, onChange: (e3) => i2(e3.currentTarget.checked) }), (0, t.jsx)("span", { className: o.default.track, "aria-hidden": "true", children: (0, t.jsx)("span", { className: o.default.thumb, children: r2 ? "ON" : "OFF" }) })] })] });
  }
  e.s(["SettingsContent", 0, c, "default", 0, function({ restoreHref: e2 = "/restore" }) {
    let [r2, i2] = (0, n.useState)(false), a2 = (0, n.useRef)(null), s2 = (0, n.useRef)(null), d2 = (0, n.useRef)(null);
    return (0, n.useEffect)(() => {
      if (!r2) return;
      (0, l.setSettingsModalOpen)(true);
      let e3 = a2.current, t2 = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      let n2 = requestAnimationFrame(() => d2.current?.focus()), o2 = (e4) => {
        if ("Escape" === e4.key) {
          e4.preventDefault(), i2(false);
          return;
        }
        if ("Tab" !== e4.key) return;
        let t3 = s2.current;
        if (!t3) return;
        let n3 = Array.from(t3.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((e5) => e5.getClientRects().length > 0);
        if (0 === n3.length) {
          e4.preventDefault(), t3.focus();
          return;
        }
        let r3 = n3[0], a3 = n3[n3.length - 1];
        e4.shiftKey && document.activeElement === r3 ? (e4.preventDefault(), a3.focus()) : e4.shiftKey || document.activeElement !== a3 || (e4.preventDefault(), r3.focus());
      };
      return document.addEventListener("keydown", o2), () => {
        cancelAnimationFrame(n2), document.removeEventListener("keydown", o2), document.body.style.overflow = t2, (0, l.setSettingsModalOpen)(false), e3?.focus();
      };
    }, [r2]), (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { ref: a2, type: "button", className: o.default.trigger, "aria-label": "Open settings", "aria-haspopup": "dialog", "aria-expanded": r2, onClick: () => {
      (0, l.setSettingsModalOpen)(true), i2(true);
    }, children: (0, t.jsx)("svg", { viewBox: "0 0 20 20", shapeRendering: "crispEdges", fill: "currentColor", "aria-hidden": "true", children: (0, t.jsx)("path", { fillRule: "evenodd", d: "M6 4H14V6H16V14H14V16H6V14H4V6H6Z M8 1H12V4H8Z M8 16H12V19H8Z M1 8H4V12H1Z M16 8H19V12H16Z M3 3H6V6H3Z M14 3H17V6H14Z M3 14H6V17H3Z M14 14H17V17H14Z M8 8H12V12H8Z" }) }) }), r2 && (0, t.jsx)("div", { className: o.default.backdrop, onMouseDown: (e3) => {
      e3.target === e3.currentTarget && i2(false);
    }, children: (0, t.jsxs)("div", { ref: s2, className: o.default.dialog, role: "dialog", "aria-modal": "true", "aria-label": "Settings", tabIndex: -1, children: [(0, t.jsx)("button", { ref: d2, type: "button", className: o.default.close, "aria-label": "Close settings", onClick: () => i2(false), children: "\xD7" }), (0, t.jsx)(c, { restoreHref: e2, onNavigate: () => i2(false) })] }) })] });
  }], 23644);
}, 32368, (e) => {
  e.v({ arrow: "ChainleLink-module__Eh-k6G__arrow", copy: "ChainleLink-module__Eh-k6G__copy", detail: "ChainleLink-module__Eh-k6G__detail", icon: "ChainleLink-module__Eh-k6G__icon", label: "ChainleLink-module__Eh-k6G__label", link: "ChainleLink-module__Eh-k6G__link" });
}, 61194, 87588, (e) => {
  "use strict";
  var t = e.i(71645);
  e.i(98284);
  let n = "krillion:resume:v1";
  function r(e2) {
    return e2.startsWith("/archive") ? "/archive" : e2;
  }
  function i(e2) {
    try {
      let t2 = JSON.parse(localStorage.getItem(n) ?? "null"), i2 = r(e2.href.split("?")[0]);
      localStorage.setItem(n, JSON.stringify({ latest: e2, targets: { ...t2?.targets, [i2]: e2 } }));
    } catch {
    }
  }
  function a(e2, t2) {
    try {
      let i2 = JSON.parse(localStorage.getItem(n) ?? "null");
      if (!i2 || void 0 !== t2 && i2.targets?.[e2]?.game !== t2) return;
      delete i2.targets?.[e2], i2.latest && r(i2.latest.href.split("?")[0]) === e2 && (i2.latest = Object.values(i2.targets ?? {}).at(-1) ?? null), localStorage.setItem(n, JSON.stringify(i2));
    } catch {
    }
  }
  e.s(["clearResumeTarget", 0, a, "resumeDive", 0, function(e2, t2) {
    if (void 0 === e2.pausedAt) return e2;
    let n2 = Math.max(0, t2 - e2.pausedAt);
    return { ...e2, pausedAt: void 0, previewEndsAt: null === e2.previewEndsAt ? null : e2.previewEndsAt + n2, answerEndsAt: null === e2.answerEndsAt ? null : e2.answerEndsAt + n2 };
  }, "resumeScope", 0, r, "saveResumeTarget", 0, i], 87588);
  let l = null, s = /* @__PURE__ */ new Set(), o = () => s.forEach((e2) => e2()), c = (e2) => (s.add(e2), () => {
    s.delete(e2);
  }), d = () => l;
  e.s(["getActiveDive", 0, d, "useActiveDive", 0, function() {
    return (0, t.useSyncExternalStore)(c, d, () => null);
  }, "useDiveMenu", 0, function({ game: e2, gameRef: n2, setGame: s2, input: c2, correction: d2, rejected: u, submitting: f, submittingRef: h, label: m, setNow: p }) {
    (0, t.useEffect)(() => {
      if (!e2 || "intro" === e2.phase || "done" === e2.phase) {
        e2?.phase === "done" && a(r(window.location.pathname), "game" in e2 ? e2.game : void 0);
        return;
      }
      let t2 = { label: m, busy: f, openMenu() {
        let e3 = n2.current;
        return !!e3 && !h.current && (p(Date.now()), s2({ ...e3, draft: c2, correction: d2, rejected: u }), i({ href: window.location.pathname + window.location.search, label: m, ..."game" in e3 ? { game: e3.game } : { date: e3.date } }), true);
      }, closeMenu() {
        p(Date.now()), requestAnimationFrame(() => document.querySelector('input[aria-label="Your answer"]')?.focus());
      } };
      return l = t2, o(), () => {
        l === t2 && (l = null, o());
      };
    }, [e2, n2, s2, c2, d2, u, f, h, m, p]);
  }], 61194);
}, 29616, (e) => {
  e.v({ back: "SiteMenu-module__22gvxa__back", chainle: "SiteMenu-module__22gvxa__chainle", close: "SiteMenu-module__22gvxa__close", dialog: "SiteMenu-module__22gvxa__dialog", eyebrow: "SiteMenu-module__22gvxa__eyebrow", footer: "SiteMenu-module__22gvxa__footer", header: "SiteMenu-module__22gvxa__header", icon: "SiteMenu-module__22gvxa__icon", merch: "SiteMenu-module__22gvxa__merch", nav: "SiteMenu-module__22gvxa__nav", panel: "SiteMenu-module__22gvxa__panel", rule: "SiteMenu-module__22gvxa__rule", symbol: "SiteMenu-module__22gvxa__symbol", trigger: "SiteMenu-module__22gvxa__trigger" });
}, 99214, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(18566), r = e.i(87644), i = e.i(23524), a = e.i(1900), l = e.i(71645), s = e.i(67334), o = e.i(33827), c = e.i(95219);
  function d({ children: e2 }) {
    let [n2, r2] = (0, l.useState)(0);
    return (0, l.useEffect)(() => {
      let e3 = (0, o.progressOwner)(), t2 = () => {
        let t3 = (0, o.progressOwner)();
        t3 !== e3 && (e3 = t3, r2((e4) => e4 + 1));
      };
      window.addEventListener(o.PROGRESS_OWNER_CHANGED, t2), e3 && (0, s.initializeAccount)();
      let n3 = () => {
        (0, s.syncAccount)();
      }, i2 = 0, a2 = () => {
        "visible" !== document.visibilityState || Date.now() - i2 < 3e4 || (i2 = Date.now(), n3(), (0, s.recoverAccountPurchases)());
      }, l2 = (e4) => {
        e4.key === o.ACCOUNT_OWNER_KEY || null === e4.key ? window.location.assign("/account") : (e4.key?.endsWith("-done") || e4.key?.endsWith("krillion:stats:v1")) && (window.dispatchEvent(new Event(c.PROGRESS_DOWNLOADED)), n3());
      };
      window.addEventListener(c.PROGRESS_CHANGED, n3);
      let d2 = () => {
        n3(), (0, s.recoverAccountPurchases)();
      };
      return window.addEventListener("online", d2), window.addEventListener("focus", a2), window.addEventListener("storage", l2), document.addEventListener("visibilitychange", a2), () => {
        window.removeEventListener(o.PROGRESS_OWNER_CHANGED, t2), window.removeEventListener(c.PROGRESS_CHANGED, n3), window.removeEventListener("online", d2), window.removeEventListener("focus", a2), window.removeEventListener("storage", l2), document.removeEventListener("visibilitychange", a2);
      };
    }, []), (0, t.jsx)(l.Fragment, { children: e2 }, n2);
  }
  var u = e.i(22016), f = e.i(61194), h = e.i(3823), m = e.i(23644), p = e.i(78877), g = e.i(45394), v = e.i(50684), y = e.i(62557), b = e.i(39233), _ = e.i(29616), x = e.i(3795);
  let w = { friends: "M3 3h5v6H3z M12 3h5v6h-5z M1 12h9v6H1z M11 12h8v6h-8z", account: "M7 2h6v2h2v6h-2v2H7v-2H5V4h2z M5 14h10v2h2v3H3v-3h2z", daily: "M9 2h2v10h5v2h-2v2h-2v2H8v-2H6v-2H4v-2h5z", packs: "M2 2h6v6H2z M12 2h6v6h-6z M2 12h6v6H2z M12 12h6v6h-6z", settings: "M6 4H14V6H16V14H14V16H6V14H4V6H6Z M8 1H12V4H8Z M8 16H12V19H8Z M1 8H4V12H1Z M16 8H19V12H16Z M3 3H6V6H3Z M14 3H17V6H14Z M3 14H6V17H3Z M14 14H17V17H14Z M8 8H12V12H8Z", faq: "M5 2h10v2h2v6h-2v2h-4v2H8v-4h5V6H7v2H3V4h2z M8 16h3v3H8z" };
  function j({ name: e2 }) {
    return "party" === e2 ? (0, t.jsx)(y.PufferIcon, {}) : "archive" === e2 || "unlimited" === e2 ? (0, t.jsx)("span", { className: `${_.default.icon} ${_.default.symbol}`, "aria-hidden": "true", children: "archive" === e2 ? "\u27F2" : "\u221E" }) : (0, t.jsx)("svg", { className: _.default.icon, viewBox: "0 0 20 20", fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": "true", children: (0, t.jsx)("path", { d: w[e2], fillRule: "evenodd" }) });
  }
  let k = [{ href: "/", label: "Daily dive", icon: "daily" }, { href: "/unlimited/classic", label: "Unlimited", icon: "unlimited" }, { href: "/party", label: "Puffer Party", icon: "party" }, { href: "/archive", label: "Archive", icon: "archive" }, { href: "/packs", label: "Themed packs", icon: "packs" }, { href: "/account", label: "My Krillion", icon: "account" }, { href: "/friends", label: "Friends", icon: "friends" }];
  function S() {
    let e2 = (0, f.useActiveDive)(), n2 = (0, l.useRef)(null), r2 = (0, l.useRef)(false), [i2, a2] = (0, l.useState)(false), [s2, o2] = (0, l.useState)(false), [c2, d2] = (0, l.useState)("");
    function y2(e3) {
      let t2 = e3 ? new URL(e3, window.location.href) : null;
      r2.current = !t2 || t2.pathname !== window.location.pathname || t2.search !== window.location.search, n2.current?.close();
    }
    return (0, l.useEffect)(() => {
      if (!i2) return;
      let e3 = document.body.style.overflow;
      return document.body.style.overflow = "hidden", () => {
        document.body.style.overflow = e3;
      };
    }, [i2]), (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", className: _.default.trigger, "data-diving": !!e2, "aria-label": e2?.busy ? "Menu unavailable while submitting answer" : "Open menu", "aria-haspopup": "dialog", "aria-controls": "site-menu", "aria-expanded": i2, disabled: e2?.busy, onClick: () => {
      (0, h.isBlockingModalOpen)() || (0, f.getActiveDive)()?.openMenu() !== false && (r2.current = false, o2(false), d2(window.location.pathname), n2.current?.showModal(), a2(true), (0, h.notifyModalChange)());
    }, children: (0, t.jsx)("svg", { viewBox: "0 0 20 20", fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": "true", children: (0, t.jsx)("path", { d: "M2 3h16v3H2zm0 6h16v3H2zm0 6h16v3H2z" }) }) }), (0, t.jsx)("dialog", { ref: n2, id: "site-menu", className: _.default.dialog, "aria-labelledby": "site-menu-title", onKeyDown: (e3) => {
      if ("Tab" !== e3.key) return;
      let t2 = Array.from(e3.currentTarget.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter((e4) => e4.getClientRects().length > 0), n3 = t2[0], r3 = t2[t2.length - 1];
      e3.shiftKey && document.activeElement === n3 ? (e3.preventDefault(), r3?.focus()) : e3.shiftKey || document.activeElement !== r3 || (e3.preventDefault(), n3?.focus());
    }, onClick: (e3) => {
      e3.target === e3.currentTarget && n2.current?.close();
    }, onClose: () => {
      r2.current || (0, f.getActiveDive)()?.closeMenu(), a2(false), (0, h.notifyModalChange)();
    }, children: (0, t.jsxs)("div", { className: _.default.panel, children: [(0, t.jsxs)("header", { className: _.default.header, children: [(0, t.jsxs)("div", { children: [(0, t.jsx)("p", { className: _.default.eyebrow, children: "KRILLION" }), (0, t.jsx)("h2", { id: "site-menu-title", children: s2 ? "Settings" : "Menu" })] }), (0, t.jsx)("button", { className: _.default.close, type: "button", "aria-label": "Close menu", onClick: () => n2.current?.close(), children: "\xD7" })] }), s2 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { className: _.default.back, onClick: () => o2(false), children: "\u2190 Back to menu" }), (0, t.jsx)(m.SettingsContent, { restoreHref: ["/movies", "/sports", "/geography", "/lexicon"].includes(c2) ? `/restore?pack=${c2.slice(1)}` : "/restore", onNavigate: () => y2() })] }) : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("p", { className: `fathom ${_.default.rule}`, children: (0, t.jsx)("span", { children: "Dive in" }) }), (0, t.jsxs)("nav", { "aria-label": "Main navigation", className: _.default.nav, children: [k.filter(({ href: e3 }) => "/party" !== e3 || !(0, x.isPartyPaused)()).map(({ href: e3, label: n3, icon: r3 }) => (0, t.jsxs)(u.default, { href: e3, prefetch: false, onNavigate: () => {
      "/party" === e3 && (0, b.track)("party_discovery_click", { placement: "menu" }), y2(e3);
    }, "aria-current": c2 === e3 || ("/archive" === e3 || "/party" === e3) && c2.startsWith(`${e3}/`) ? "page" : void 0, children: [(0, t.jsx)(j, { name: r3 }), (0, t.jsx)("span", { children: n3 })] }, e3)), (0, t.jsxs)("button", { onClick: () => o2(true), children: [(0, t.jsx)(j, { name: "settings" }), (0, t.jsx)("span", { children: "Settings" })] }), (0, t.jsxs)(u.default, { href: "/faq", prefetch: false, onNavigate: () => y2("/faq"), "aria-current": "/faq" === c2 ? "page" : void 0, children: [(0, t.jsx)(j, { name: "faq" }), (0, t.jsx)("span", { children: "FAQ" })] })] }), (0, t.jsx)(v.default, { placement: "menu" }), (0, t.jsx)(g.default, { placement: "menu", className: _.default.merch }), (0, t.jsx)(p.default, { placement: "menu", className: _.default.chainle }), (0, t.jsx)("footer", { className: _.default.footer, children: e2 ? "Your timer keeps running while the menu is open." : "one in a krillion." })] })] }) })] });
  }
  var C = e.i(57688), E = e.i(74365), M = e.i(37812), N = e.i(46513);
  let O = "krillion:announcements:seen:v1", P = /* @__PURE__ */ new Set(["preview", "answering", "feedback"]), H = /* @__PURE__ */ new Set();
  function R() {
    try {
      let e2 = JSON.parse(localStorage.getItem(O) ?? "[]"), t2 = Array.isArray(e2) ? e2.filter((e3) => "string" == typeof e3) : [];
      return Array.from(/* @__PURE__ */ new Set([...H, ...t2]));
    } catch {
      return [...H];
    }
  }
  function A(e2) {
    try {
      let t2 = localStorage.getItem(e2);
      if (!t2) return null;
      let n2 = JSON.parse(t2);
      return "string" == typeof n2.phase ? n2.phase : null;
    } catch {
      return null;
    }
  }
  function z(e2) {
    try {
      for (let t2 = 0; t2 < localStorage.length; t2++) {
        let n2 = localStorage.key(t2);
        if (n2?.startsWith(e2) && P.has(A(n2) ?? "")) return true;
      }
    } catch {
    }
    return false;
  }
  function L(e2) {
    if ("/" === e2) return P.has(A("krillion:game:v1") ?? "");
    if ("/archive" === e2) return z("krillion-archive-");
    let t2 = e2.match(/^\/archive\/(\d+)/);
    if (t2) return P.has(A(`krillion-archive-${t2[1]}`) ?? "");
    if ("/unlimited/classic" === e2) return z("krillion-unlimited-");
    let n2 = e2.match(/^\/(movies|sports|geography|lexicon)(?:\/|$)/)?.[1];
    return !!n2 && z(`krillion-pack-${n2}-`);
  }
  function D(e2) {
    return !/^\/(?:calibration|answer-count)(?:\/|$)/.test(e2) && !e2.startsWith("/days/") && !e2.endsWith("/review");
  }
  function T() {
    let [e2, r2] = (0, l.useState)(null), [i2, a2] = (0, l.useState)("idle"), [s2, o2] = (0, l.useState)(null), c2 = (0, l.useRef)(null), d2 = (0, n.usePathname)(), u2 = (0, l.useId)();
    (0, l.useEffect)(() => {
      if (!D(d2) || L(d2)) return;
      let e3 = false, t2 = () => {
        e3 || (0, h.isBlockingModalOpen)() || (0, E.loadCurrentAnnouncement)().then((t3) => {
          e3 || (0, h.isBlockingModalOpen)() || !t3 || R().includes(t3.id) || L(d2) || r2(t3);
        }).catch(() => {
        });
      }, n2 = () => {
        (0, h.isBlockingModalOpen)() || t2();
      };
      return window.addEventListener(h.MODAL_CHANGE_EVENT, n2), t2(), () => {
        e3 = true, window.removeEventListener(h.MODAL_CHANGE_EVENT, n2);
      };
    }, [d2]), (0, l.useEffect)(() => {
      let t2 = c2.current;
      if (!(!e2 || !t2 || t2.open || (0, h.isBlockingModalOpen)())) try {
        t2.showModal();
        var n2 = e2.id;
        H.add(n2);
        try {
          let e3 = Array.from(/* @__PURE__ */ new Set([...R(), n2])).slice(-100);
          localStorage.setItem(O, JSON.stringify(e3));
        } catch {
        }
      } catch {
        queueMicrotask(() => r2(null));
      }
    }, [e2]);
    let f2 = () => {
      c2.current?.close(), r2(null), a2("idle"), o2(null);
    }, m2 = async (t2) => {
      if (e2?.poll && "busy" !== i2 && "done" !== i2) {
        o2(t2), a2("busy");
        try {
          let n2 = await fetch("/api/announcements/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e2.id, choice: t2, playerId: (0, M.getPlayerId)() }) });
          if (!n2.ok) throw Error(String(n2.status));
          (0, b.track)("announcement_vote", { announcement: e2.id, choice: t2 }), a2("done");
        } catch {
          a2("error");
        }
      }
    };
    if (!e2 || !D(d2)) return null;
    let p2 = `${u2}-title`, g2 = `${u2}-body`, v2 = e2.cta?.href.startsWith("https://");
    return (0, t.jsx)("dialog", { ref: c2, className: N.default.dialog, "aria-labelledby": p2, "aria-describedby": g2, onCancel: (e3) => {
      e3.preventDefault(), f2();
    }, onClose: () => r2(null), children: (0, t.jsxs)("div", { className: N.default.panel, children: [(0, t.jsx)("button", { className: N.default.close, type: "button", onClick: f2, "aria-label": "Close announcement", children: "\xD7" }), (0, t.jsx)("p", { className: N.default.eyebrow, children: "Incoming transmission" }), (0, t.jsx)("h2", { className: N.default.title, id: p2, children: e2.title }), (0, t.jsx)("p", { className: N.default.body, id: g2, children: e2.body }), e2.image && (0, t.jsx)("div", { className: N.default.preview, children: (0, t.jsx)(C.default, { src: e2.image.src, alt: e2.image.alt, fill: true, sizes: "200px", loading: "eager", className: N.default.previewImage }) }), e2.poll ? "done" === i2 ? (0, t.jsxs)("div", { className: N.default.actions, children: [(0, t.jsx)("p", { className: N.default.pollStatus, role: "status", children: "Vote logged." }), (0, t.jsx)("button", { className: `btn-quiet ${N.default.dismiss}`, type: "button", onClick: f2, children: "Close" })] }) : (0, t.jsxs)(t.Fragment, { children: ["error" === i2 && (0, t.jsx)("p", { className: N.default.pollError, role: "alert", children: "That vote didn\u2019t land \u2014 try again." }), (0, t.jsxs)("div", { className: N.default.actions, children: [e2.poll.options.map((e3) => (0, t.jsx)("button", { className: `btn-descend ${N.default.cta}`, type: "button", disabled: "busy" === i2, onClick: () => void m2(e3.key), children: "busy" === i2 && s2 === e3.key ? "logging\u2026" : e3.label }, e3.key)), (0, t.jsx)("button", { className: `btn-quiet ${N.default.dismiss}`, type: "button", onClick: f2, children: "Dismiss" })] })] }) : (0, t.jsxs)("div", { className: N.default.actions, children: [e2.cta && (0, t.jsxs)("a", { className: `btn-descend ${N.default.cta}`, href: e2.cta.href, target: v2 ? "_blank" : void 0, rel: v2 ? "noopener" : void 0, onClick: () => {
      (0, b.track)("announcement_clicked", { announcement: e2.id }), f2();
    }, children: [e2.cta.label, v2 && (0, t.jsx)("span", { "aria-hidden": "true", children: " \u2197" }), v2 && (0, t.jsx)("span", { className: "sr-only", children: " (opens in a new tab)" })] }), (0, t.jsx)("button", { className: `btn-quiet ${N.default.dismiss}`, type: "button", onClick: f2, children: "Dismiss" })] })] }) });
  }
  e.s(["default", 0, function({ children: e2, gaId: l2 }) {
    return "discord" === (0, n.useSelectedLayoutSegment)() ? e2 : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsxs)(i.default, { children: [(0, t.jsxs)(d, { children: [(0, t.jsx)(S, {}), (0, t.jsx)(T, {}), e2] }), (0, t.jsx)(a.default, {})] }), l2 && (0, t.jsx)(r.GoogleAnalytics, { gaId: l2 })] });
  }], 99214);
}, 28515, (e) => {
  e.v((t) => Promise.all(["static/chunks/0xd3b6_e347kv.js", "static/chunks/32cf7b9xalq11.js"].map((t2) => e.l(t2))).then(() => t(97987)));
}, 3975, (e) => {
  e.v((t) => Promise.all(["static/chunks/32cf7b9xalq11.js", "static/chunks/2epd2_dzs0qp5.js"].map((t2) => e.l(t2))).then(() => t(41166)));
}, 29087, (e) => {
  e.v((e2) => Promise.resolve().then(() => e2(45743)));
}, 10150, (e) => {
  e.v((e2) => Promise.resolve().then(() => e2(67334)));
}]);
