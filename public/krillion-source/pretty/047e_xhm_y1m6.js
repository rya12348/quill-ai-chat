(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 35406, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(71645), n = e.i(23524), i = e.i(60451);
  let o = ".adunitwrapper", a = "#adhesion_mobile_wrapper, #adhesion_tablet_wrapper, #adhesion_desktop_wrapper", l = { top: 0, right: 0, bottom: 0, left: 0 };
  function s(e2) {
    return e2 < 728 ? 50 : 90;
  }
  function d(e2) {
    if (!e2.getClientRects().length) return false;
    for (let t2 = e2; t2; t2 = t2.parentElement) {
      let e3 = getComputedStyle(t2);
      if ("none" === e3.display || "hidden" === e3.visibility || "collapse" === e3.visibility || 0 === Number(e3.opacity)) return false;
    }
    return true;
  }
  let c = ".mv-outstream-container";
  function u(e2) {
    return [...e2.querySelectorAll("iframe, img, video, object, .mv-native-size")].flatMap((e3) => {
      if (e3.closest(`${c}.inactive`)) return [];
      let t2 = e3.getBoundingClientRect();
      return t2.width > 1 && t2.height > 1 && d(e3) ? [t2] : [];
    });
  }
  function m(e2, t2 = true) {
    if (e2.classList.contains("mv-empty-wrapper") || !d(e2)) return null;
    let r2 = e2.querySelector(".adunit");
    if (!r2 || !d(r2)) return null;
    let n2 = u(t2 ? e2 : r2);
    if (!n2.length) return null;
    let i2 = r2.getBoundingClientRect();
    if (!t2) return i2.width > 1 && i2.height > 1 ? i2 : null;
    let o2 = [e2.getBoundingClientRect(), ...n2];
    i2.width > 1 && i2.height > 1 && o2.push(i2);
    let a2 = Math.min(...o2.map((e3) => e3.left)), l2 = Math.min(...o2.map((e3) => e3.top));
    return new DOMRect(a2, l2, Math.max(...o2.map((e3) => e3.right)) - a2, Math.max(...o2.map((e3) => e3.bottom)) - l2);
  }
  let h = () => false;
  function p(e2) {
    let t2 = (0, r.useCallback)((t3) => {
      let r2 = window.matchMedia(e2);
      return r2.addEventListener("change", t3), () => r2.removeEventListener("change", t3);
    }, [e2]);
    return (0, r.useSyncExternalStore)(t2, () => window.matchMedia(e2).matches, h);
  }
  let v = (e2) => (window.addEventListener("popstate", e2), () => window.removeEventListener("popstate", e2)), f = () => "1" === new URLSearchParams(window.location.search).get("ads"), w = () => "high-impact" === new URLSearchParams(window.location.search).get("adhesion");
  function g() {
    return (0, r.useSyncExternalStore)(v, f, h);
  }
  function y({ slot: e2, sizes: r2, label: n2, preview: i2 }) {
    return (0, t.jsx)("div", { className: "kr-ad-placement", "aria-label": "Advertisement", children: i2 ? (0, t.jsxs)("div", { className: "kr-ad-placeholder", children: [n2, (0, t.jsx)("small", { children: "layout preview" })] }) : (0, t.jsx)("div", { className: "mv_slot_target", "data-slot": e2, "data-hint-slot-sizes": r2 }) });
  }
  e.s(["ResultsAd", 0, function() {
    let e2 = (0, n.useAdsEnabled)(), r2 = g();
    return e2 ? (0, t.jsx)("aside", { className: "kr-ad-results", "aria-label": "Results advertisement", children: (0, t.jsx)(y, { slot: "content", sizes: "300x250", label: "Results \xB7 300 \xD7 250", preview: r2 }) }) : null;
  }, "default", 0, function({ children: e2, phase: d2, disabled: f2 = false, railMode: E = "both", allowAdPreview: b = false, keyboardBehavior: x = "pan" }) {
    let k = (0, n.useAdsEnabled)(), L = (0, n.useAdLoadState)(), M = p("(min-width: 1024px) and (hover: hover) and (pointer: fine)"), S = p("(min-width: 1200px) and (min-height: 710px) and (hover: hover) and (pointer: fine)"), A = p("(max-width: 767px)") ? i.ADHESION_ENABLED.mobile : M ? i.ADHESION_ENABLED.desktop : i.ADHESION_ENABLED.tablet, P = g(), R = k || b && P, T = (0, r.useSyncExternalStore)(v, w, h), q = (0, r.useRef)(null), j = (0, r.useRef)(l), z = (0, r.useRef)(/* @__PURE__ */ new WeakMap()), N = (0, r.useRef)(null);
    return ((0, r.useLayoutEffect)(() => {
      let e3, t2, r2, n2, i2, h2, p2, v2, w2 = q.current;
      if (!w2 || f2 || !R) {
        j.current = l;
        return;
      }
      let g2 = document.documentElement, y2 = () => {
        var e4;
        for (let e5 of w2.querySelectorAll(".kr-ad-placement")) {
          let t4 = [...e5.querySelectorAll(o)].map((e6) => m(e6)).filter((e6) => null !== e6);
          t4.push(...[...e5.querySelectorAll(c)].filter((e6) => !e6.closest(o)).flatMap(u));
          let r4 = String(P || t4.length > 0);
          e5.dataset.adFilled !== r4 && (e5.dataset.adFilled = r4);
          let n4 = P ? "" : `${(function(e6, t5) {
            if (!t5.length) return 0;
            let r5 = Math.max(...t5.map((e7) => e7.height));
            return Math.ceil(Math.min(Math.max(r5, Math.max(...t5.map((e7) => e7.bottom)) - e6), r5 + 64));
          })(e5.getBoundingClientRect().top, t4)}px`;
          e5.style.getPropertyValue("--kr-ad-height") !== n4 && (n4 ? e5.style.setProperty("--kr-ad-height", n4) : e5.style.removeProperty("--kr-ad-height"));
        }
        let t3 = (e5) => !!w2.querySelector(`${e5} [data-ad-filled="true"]`), r3 = w2.querySelector(".kr-ad-leaderboard .kr-ad-placement");
        r3 && !z.current.has(r3) && z.current.set(r3, performance.now());
        let n3 = r3 && (function({ filled: e5, unavailable: t4, blocked: r4, responded: n4, elapsed: i4 }) {
          return !!e5 || !t4 && !r4 && !n4 && i4 < 3e4;
        })({ filled: t3(".kr-ad-leaderboard"), unavailable: "failed" === L || "inactive" === L, blocked: !!r3.querySelector('[data-hint-slot-inserted="blocked"]'), responded: [...r3.querySelectorAll(".mv-empty-wrapper .adunit[data-google-query-id]")].some((e5) => "none" === getComputedStyle(e5).display), elapsed: performance.now() - (z.current.get(r3) ?? 0) }), i3 = M && n3 ? Math.max(90, parseFloat(r3?.style.getPropertyValue("--kr-ad-height") || "0")) : 0, l2 = 0, h3 = 0, p3 = w2.hasAttribute("data-visual-viewport") ? window.visualViewport : null, v3 = [];
        for (let e5 of document.querySelectorAll(a)) {
          let t4 = m(e5, false);
          t4 && t4.bottom > 0 && t4.top < window.innerHeight && t4.right > 0 && t4.left < window.innerWidth && (h3 = Math.max(h3, Math.ceil(t4.height)), l2 = Math.max(l2, Math.ceil(!p3 || t4.bottom <= p3.offsetTop || t4.top >= p3.offsetTop + p3.height ? t4.height : Math.max(t4.height, p3.offsetTop + p3.height - t4.top))), v3.push(t4));
        }
        let f3 = (function(e5, t4, r4 = false, n4 = true) {
          return e5 ? Math.max(n4 ? r4 ? 150 : 90 : 0, t4) : 0;
        })(R, h3, P && T, A), y3 = `${f3}px`;
        w2.style.getPropertyValue("--kr-rail-bottom") !== y3 && w2.style.setProperty("--kr-rail-bottom", y3);
        let b3 = S && window.innerHeight - f3 >= 620;
        w2.dataset.railsFit = String(b3);
        let x3 = P || "failed" !== L && "inactive" !== L, k2 = (function({ serving: e5, viewportWidth: t4, rails: r4, measured: n4, adhesionEnabled: i4 = true, railMode: o2 = "both" }) {
          return e5 ? { top: n4.top, left: r4 ? 180 : n4.left, right: r4 && "both" === o2 ? 180 : n4.right, bottom: Math.max(i4 ? s(t4) : 0, n4.bottom) } : n4;
        })({ adhesionEnabled: A, serving: x3, viewportWidth: window.innerWidth, rails: S, railMode: E, measured: { top: i3, left: b3 && t3(".kr-ad-rail-left") ? 180 : 0, right: b3 && t3(".kr-ad-rail-right") ? 180 : 0, bottom: l2 } }), q2 = { ...j.current };
        M || (q2.top = 0), S || (q2.left = q2.right = 0), "left" === E && (q2.right = 0), p3 && (q2.bottom = 0), A || (q2.bottom = 0);
        let N2 = (e4 = x3 && ("preview" === d2 || "answering" === d2), Object.fromEntries(Object.entries(k2).map(([t4, r4]) => [t4, e4 ? Math.max(q2[t4], r4) : r4])));
        for (let [e5, t4] of (j.current = N2, Object.entries(N2))) {
          let r4 = "bottom" === e5 && P && A ? `max(${t4}px, calc(${T ? 150 : s(window.innerWidth)}px + env(safe-area-inset-bottom, 0px)))` : `${t4}px`;
          g2.style.getPropertyValue(`--kr-ad-${e5}`) !== r4 && g2.style.setProperty(`--kr-ad-${e5}`, r4);
        }
        let B = w2.querySelector(".ds-dock"), C = parseFloat(w2.style.getPropertyValue("--kr-ad-dock-lift")) || 0, $ = `${p3 ? 0 : (function(e5, t4, r4 = 0) {
          if (!e5) return 0;
          let n4 = e5.top + r4, i4 = e5.bottom + r4, o2 = 0;
          for (let r5 of [...t4].sort((e6, t5) => t5.top - e6.top)) {
            if (r5.left >= e5.right || r5.right <= e5.left || r5.top >= i4 || r5.bottom <= n4) continue;
            let t5 = Math.ceil(i4 - r5.top);
            o2 += t5, n4 -= t5, i4 -= t5;
          }
          return o2;
        })(B?.getBoundingClientRect() ?? null, v3, C)}px`;
        w2.style.getPropertyValue("--kr-ad-dock-lift") !== $ && w2.style.setProperty("--kr-ad-dock-lift", $);
      };
      N.current = y2;
      let b2 = (e3 = 0, t2 = /* @__PURE__ */ new Set(), r2 = () => {
        let e4 = /* @__PURE__ */ new Set([w2, ...w2.querySelectorAll(`${o}, .adunit, .adunit iframe`), ...document.querySelectorAll(a)]);
        for (let r3 of t2) e4.has(r3) || (p2.unobserve(r3), t2.delete(r3));
        for (let r3 of e4) t2.has(r3) || (p2.observe(r3), t2.add(r3));
        y2();
      }, n2 = () => {
        e3 || (e3 = requestAnimationFrame(() => {
          e3 = 0, r2();
        }));
      }, i2 = `${o}, .kr-ad-placement`, (h2 = new MutationObserver((e4) => {
        e4.some((e5) => {
          let t3 = e5.target;
          return !!(t3 instanceof Element && (t3.closest(i2) || t3 === w2 || t3 === document.body || t3 === document.documentElement)) || [...e5.addedNodes, ...e5.removedNodes].some((e6) => e6 instanceof Element && (e6.matches(i2) || e6.querySelector(i2)));
        }) && n2();
      })).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "width", "height", "data-slot-wrapper-hidden"] }), p2 = new ResizeObserver(n2), window.addEventListener("resize", n2), v2 = window.setInterval(n2, 1e3), r2(), () => {
        h2.disconnect(), p2.disconnect(), window.removeEventListener("resize", n2), clearInterval(v2), cancelAnimationFrame(e3);
      }), x2 = window.visualViewport;
      return x2?.addEventListener("resize", y2), x2?.addEventListener("scroll", y2), () => {
        for (let e4 of (N.current = null, b2(), x2?.removeEventListener("resize", y2), x2?.removeEventListener("scroll", y2), w2.style.removeProperty("--kr-ad-dock-lift"), Object.keys(l))) g2.style.removeProperty(`--kr-ad-${e4}`);
      };
    }, [f2, R, A, M, S, E, P, T, L, d2]), (0, r.useLayoutEffect)(() => {
      if (!f2 && q.current) return "resize" === x ? (function(e3, t2 = () => {
      }) {
        let r2 = window.visualViewport;
        if (!r2) return () => {
        };
        let n2 = window.matchMedia("(max-width: 1099px) and (pointer: coarse)"), i2 = () => {
          let t3;
          n2.matches && (t3 = () => (function(e4) {
            if ("u" < typeof document) return;
            let t4 = document.activeElement;
            if (t4 instanceof HTMLElement && e4.contains(t4) && t4.matches("input, textarea, [contenteditable='true']")) for (let r3 = t4.parentElement; r3 && r3 !== e4; r3 = r3.parentElement) {
              let e5 = getComputedStyle(r3).overflowY;
              if ("auto" !== e5 && "scroll" !== e5 || r3.scrollHeight <= r3.clientHeight) continue;
              let n3 = r3.getBoundingClientRect(), i3 = t4.getBoundingClientRect();
              i3.bottom > n3.bottom - 12 ? r3.scrollTop += i3.bottom - (n3.bottom - 12) : i3.top < n3.top + 12 && (r3.scrollTop -= n3.top + 12 - i3.top);
              return;
            }
          })(e3), "function" == typeof window.requestAnimationFrame ? window.requestAnimationFrame(t3) : setTimeout(t3, 0));
        }, o2 = () => {
          e3.removeAttribute("data-visual-viewport"), e3.style.removeProperty("--kr-viewport-height"), e3.style.removeProperty("--kr-viewport-top"), t2();
        }, a2 = () => {
          if (!n2.matches) return void o2();
          if (Math.abs(r2.scale - 1) > 0.05 || r2.height <= 0) return;
          e3.hasAttribute("data-visual-viewport") || e3.setAttribute("data-visual-viewport", "");
          let a3 = false;
          for (let [t3, n3] of [["--kr-viewport-height", `${r2.height}px`], ["--kr-viewport-top", `${Math.max(0, r2.offsetTop)}px`]]) e3.style.getPropertyValue(t3) !== n3 && (e3.style.setProperty(t3, n3), a3 = true);
          t2(), a3 && i2();
        };
        return r2.addEventListener("resize", a2), r2.addEventListener("scroll", a2), window.addEventListener("resize", a2), window.addEventListener("pageshow", a2), n2.addEventListener("change", a2), e3.addEventListener("focusin", i2), a2(), () => {
          r2.removeEventListener("resize", a2), r2.removeEventListener("scroll", a2), window.removeEventListener("resize", a2), window.removeEventListener("pageshow", a2), n2.removeEventListener("change", a2), e3.removeEventListener("focusin", i2), o2();
        };
      })(q.current, () => N.current?.()) : (function(e3, t2 = () => {
      }) {
        let r2, n2, i2, o2 = window.visualViewport, a2 = e3.querySelector(".ds-root");
        if (!o2 || !a2 || !window.matchMedia("(pointer: coarse)").matches) return () => {
        };
        let l2 = document.documentElement.clientHeight, s2 = document.documentElement.clientWidth, d3 = null, c2 = 0, u2 = false, m2 = (e4) => {
          c2 = e4;
          let r3 = e4 ? `0 ${-e4}px` : "";
          a2.style.getPropertyValue("--kr-game-pan") !== r3 && (r3 ? a2.style.setProperty("--kr-game-pan", r3) : a2.style.removeProperty("--kr-game-pan"), t2());
        }, h2 = () => {
          void 0 !== i2 && cancelAnimationFrame(i2), i2 = void 0;
        }, p2 = () => {
          clearTimeout(r2), h2(), u2 = false, m2(0);
        }, v2 = () => !!d3?.isConnected && document.activeElement === d3, f3 = (t3 = true) => (function(e4) {
          if (!e4.focused || e4.closedHeight - e4.height < 120 || Math.abs(e4.width / e4.closedWidth - 1) > 0.08) return 0;
          let t4 = Math.max(0, e4.pageTop - e4.scrollY) + e4.height;
          return Math.max(0, Math.ceil(e4.dockBottom + e4.appliedPan - t4 + 8));
        })({ focused: v2(), closedHeight: l2, closedWidth: s2, height: o2.height, width: o2.width, pageTop: o2.pageTop, scrollY: window.scrollY, dockBottom: (e3.querySelector(".ds-dock")?.getBoundingClientRect().bottom ?? 0) + (t3 && parseFloat(e3.style.getPropertyValue("--kr-ad-dock-lift")) || 0), appliedPan: c2 }), w2 = () => {
          if (u2 = false, !c2 && 0 === f3(false)) return;
          let e4 = d3, t3 = f3();
          if (t3 <= c2) return void m2(t3);
          let r3 = c2, n3 = performance.now(), o3 = (a3) => {
            if (i2 = void 0, d3 !== e4 || !v2()) return void p2();
            let l3 = f3();
            if (l3 < c2) return void m2(l3);
            let s3 = Math.min(1, (a3 - n3) / 160);
            m2(Math.min(l3, r3 + (t3 - r3) * (1 - (1 - s3) ** 3))), s3 < 1 && (i2 = requestAnimationFrame(o3));
          };
          h2(), i2 = requestAnimationFrame(o3);
        }, g2 = () => {
          clearTimeout(r2), r2 = setTimeout(w2, 500);
        }, y2 = (t3) => {
          t3.target instanceof HTMLInputElement && t3.target.matches(".ds-input") && e3.contains(t3.target) && (d3 = t3.target, l2 - o2.height < 120 && (l2 = o2.height, s2 = o2.width), u2 = true, g2());
        }, E2 = () => {
          if (!v2()) return void p2();
          if (Math.abs(document.documentElement.clientWidth / s2 - 1) > 0.2) {
            p2(), l2 = document.documentElement.clientHeight, s2 = document.documentElement.clientWidth;
            return;
          }
          if (c2 || void 0 !== i2) {
            let e4 = f3();
            e4 < c2 && (h2(), m2(e4));
          }
          u2 && g2();
        }, b2 = () => {
          clearTimeout(n2), n2 = setTimeout(() => {
            v2() || p2();
          }, 0);
        }, x2 = (e4) => {
          e4.touches.length > 1 && p2();
        }, k2 = () => {
          u2 = false, clearTimeout(r2), h2();
        };
        return e3.addEventListener("pointerdown", y2), e3.addEventListener("focusin", y2), e3.addEventListener("focusout", b2), e3.addEventListener("touchstart", x2, { passive: true }), e3.addEventListener("touchmove", k2, { passive: true }), o2.addEventListener("resize", E2), o2.addEventListener("scroll", E2), window.addEventListener("scroll", E2, { passive: true }), window.addEventListener("resize", E2), () => {
          p2(), clearTimeout(n2), e3.removeEventListener("pointerdown", y2), e3.removeEventListener("focusin", y2), e3.removeEventListener("focusout", b2), e3.removeEventListener("touchstart", x2), e3.removeEventListener("touchmove", k2), o2.removeEventListener("resize", E2), o2.removeEventListener("scroll", E2), window.removeEventListener("scroll", E2), window.removeEventListener("resize", E2);
        };
      })(q.current, () => N.current?.());
    }, [f2, d2, x]), f2) ? e2 : (0, t.jsxs)("div", { className: "kr-ad-layout", ref: q, children: [e2, R && S && (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("aside", { className: "kr-ad-rail kr-ad-rail-left", "aria-label": "Left advertisement", children: (0, t.jsx)(y, { slot: "sidebarBtf", sizes: "d160x600", label: "Rail \xB7 160 \xD7 600", preview: P }) }), "both" === E && (0, t.jsx)("aside", { className: "kr-ad-rail kr-ad-rail-right", "aria-label": "Right advertisement", children: (0, t.jsx)(y, { slot: "sidebarBtf", sizes: "d160x600", label: "Rail \xB7 160 \xD7 600", preview: P }) })] }), R && P && A && (0, t.jsx)("div", { className: "kr-ad-adhesion-preview", "aria-hidden": "true", children: (0, t.jsxs)("span", { className: "kr-ad-placeholder", children: [T ? "High-impact adhesion \xB7 150px" : "Standard adhesion \xB7 reserved space", (0, t.jsx)("small", { children: "layout preview" })] }) })] });
  }], 35406);
}]);
