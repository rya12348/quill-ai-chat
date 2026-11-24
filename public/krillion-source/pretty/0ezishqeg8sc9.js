(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 35406, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(71645), a = e.i(23524), n = e.i(60451);
  let i = ".adunitwrapper", l = "#adhesion_mobile_wrapper, #adhesion_tablet_wrapper, #adhesion_desktop_wrapper", o = { top: 0, right: 0, bottom: 0, left: 0 };
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
    let a2 = u(t2 ? e2 : r2);
    if (!a2.length) return null;
    let n2 = r2.getBoundingClientRect();
    if (!t2) return n2.width > 1 && n2.height > 1 ? n2 : null;
    let i2 = [e2.getBoundingClientRect(), ...a2];
    n2.width > 1 && n2.height > 1 && i2.push(n2);
    let l2 = Math.min(...i2.map((e3) => e3.left)), o2 = Math.min(...i2.map((e3) => e3.top));
    return new DOMRect(l2, o2, Math.max(...i2.map((e3) => e3.right)) - l2, Math.max(...i2.map((e3) => e3.bottom)) - o2);
  }
  let p = () => false;
  function h(e2) {
    let t2 = (0, r.useCallback)((t3) => {
      let r2 = window.matchMedia(e2);
      return r2.addEventListener("change", t3), () => r2.removeEventListener("change", t3);
    }, [e2]);
    return (0, r.useSyncExternalStore)(t2, () => window.matchMedia(e2).matches, p);
  }
  let f = (e2) => (window.addEventListener("popstate", e2), () => window.removeEventListener("popstate", e2)), v = () => "1" === new URLSearchParams(window.location.search).get("ads"), y = () => "high-impact" === new URLSearchParams(window.location.search).get("adhesion");
  function g() {
    return (0, r.useSyncExternalStore)(f, v, p);
  }
  function x({ slot: e2, sizes: r2, label: a2, preview: n2 }) {
    return (0, t.jsx)("div", { className: "kr-ad-placement", "aria-label": "Advertisement", children: n2 ? (0, t.jsxs)("div", { className: "kr-ad-placeholder", children: [a2, (0, t.jsx)("small", { children: "layout preview" })] }) : (0, t.jsx)("div", { className: "mv_slot_target", "data-slot": e2, "data-hint-slot-sizes": r2 }) });
  }
  e.s(["ResultsAd", 0, function() {
    let e2 = (0, a.useAdsEnabled)(), r2 = g();
    return e2 ? (0, t.jsx)("aside", { className: "kr-ad-results", "aria-label": "Results advertisement", children: (0, t.jsx)(x, { slot: "content", sizes: "300x250", label: "Results \xB7 300 \xD7 250", preview: r2 }) }) : null;
  }, "default", 0, function({ children: e2, phase: d2, disabled: v2 = false, railMode: w = "both", allowAdPreview: b = false, keyboardBehavior: E = "pan" }) {
    let k = (0, a.useAdsEnabled)(), j = (0, a.useAdLoadState)(), S = h("(min-width: 1024px) and (hover: hover) and (pointer: fine)"), P = h("(min-width: 1200px) and (min-height: 710px) and (hover: hover) and (pointer: fine)"), L = h("(max-width: 767px)") ? n.ADHESION_ENABLED.mobile : S ? n.ADHESION_ENABLED.desktop : n.ADHESION_ENABLED.tablet, N = g(), A = k || b && N, R = (0, r.useSyncExternalStore)(f, y, p), T = (0, r.useRef)(null), I = (0, r.useRef)(o), M = (0, r.useRef)(/* @__PURE__ */ new WeakMap()), C = (0, r.useRef)(null);
    return ((0, r.useLayoutEffect)(() => {
      let e3, t2, r2, a2, n2, p2, h2, f2, y2 = T.current;
      if (!y2 || v2 || !A) {
        I.current = o;
        return;
      }
      let g2 = document.documentElement, x2 = () => {
        var e4;
        for (let e5 of y2.querySelectorAll(".kr-ad-placement")) {
          let t4 = [...e5.querySelectorAll(i)].map((e6) => m(e6)).filter((e6) => null !== e6);
          t4.push(...[...e5.querySelectorAll(c)].filter((e6) => !e6.closest(i)).flatMap(u));
          let r4 = String(N || t4.length > 0);
          e5.dataset.adFilled !== r4 && (e5.dataset.adFilled = r4);
          let a4 = N ? "" : `${(function(e6, t5) {
            if (!t5.length) return 0;
            let r5 = Math.max(...t5.map((e7) => e7.height));
            return Math.ceil(Math.min(Math.max(r5, Math.max(...t5.map((e7) => e7.bottom)) - e6), r5 + 64));
          })(e5.getBoundingClientRect().top, t4)}px`;
          e5.style.getPropertyValue("--kr-ad-height") !== a4 && (a4 ? e5.style.setProperty("--kr-ad-height", a4) : e5.style.removeProperty("--kr-ad-height"));
        }
        let t3 = (e5) => !!y2.querySelector(`${e5} [data-ad-filled="true"]`), r3 = y2.querySelector(".kr-ad-leaderboard .kr-ad-placement");
        r3 && !M.current.has(r3) && M.current.set(r3, performance.now());
        let a3 = r3 && (function({ filled: e5, unavailable: t4, blocked: r4, responded: a4, elapsed: n4 }) {
          return !!e5 || !t4 && !r4 && !a4 && n4 < 3e4;
        })({ filled: t3(".kr-ad-leaderboard"), unavailable: "failed" === j || "inactive" === j, blocked: !!r3.querySelector('[data-hint-slot-inserted="blocked"]'), responded: [...r3.querySelectorAll(".mv-empty-wrapper .adunit[data-google-query-id]")].some((e5) => "none" === getComputedStyle(e5).display), elapsed: performance.now() - (M.current.get(r3) ?? 0) }), n3 = S && a3 ? Math.max(90, parseFloat(r3?.style.getPropertyValue("--kr-ad-height") || "0")) : 0, o2 = 0, p3 = 0, h3 = y2.hasAttribute("data-visual-viewport") ? window.visualViewport : null, f3 = [];
        for (let e5 of document.querySelectorAll(l)) {
          let t4 = m(e5, false);
          t4 && t4.bottom > 0 && t4.top < window.innerHeight && t4.right > 0 && t4.left < window.innerWidth && (p3 = Math.max(p3, Math.ceil(t4.height)), o2 = Math.max(o2, Math.ceil(!h3 || t4.bottom <= h3.offsetTop || t4.top >= h3.offsetTop + h3.height ? t4.height : Math.max(t4.height, h3.offsetTop + h3.height - t4.top))), f3.push(t4));
        }
        let v3 = (function(e5, t4, r4 = false, a4 = true) {
          return e5 ? Math.max(a4 ? r4 ? 150 : 90 : 0, t4) : 0;
        })(A, p3, N && R, L), x3 = `${v3}px`;
        y2.style.getPropertyValue("--kr-rail-bottom") !== x3 && y2.style.setProperty("--kr-rail-bottom", x3);
        let b3 = P && window.innerHeight - v3 >= 620;
        y2.dataset.railsFit = String(b3);
        let E3 = N || "failed" !== j && "inactive" !== j, k2 = (function({ serving: e5, viewportWidth: t4, rails: r4, measured: a4, adhesionEnabled: n4 = true, railMode: i2 = "both" }) {
          return e5 ? { top: a4.top, left: r4 ? 180 : a4.left, right: r4 && "both" === i2 ? 180 : a4.right, bottom: Math.max(n4 ? s(t4) : 0, a4.bottom) } : a4;
        })({ adhesionEnabled: L, serving: E3, viewportWidth: window.innerWidth, rails: P, railMode: w, measured: { top: n3, left: b3 && t3(".kr-ad-rail-left") ? 180 : 0, right: b3 && t3(".kr-ad-rail-right") ? 180 : 0, bottom: o2 } }), T2 = { ...I.current };
        S || (T2.top = 0), P || (T2.left = T2.right = 0), "left" === w && (T2.right = 0), h3 && (T2.bottom = 0), L || (T2.bottom = 0);
        let C2 = (e4 = E3 && ("preview" === d2 || "answering" === d2), Object.fromEntries(Object.entries(k2).map(([t4, r4]) => [t4, e4 ? Math.max(T2[t4], r4) : r4])));
        for (let [e5, t4] of (I.current = C2, Object.entries(C2))) {
          let r4 = "bottom" === e5 && N && L ? `max(${t4}px, calc(${R ? 150 : s(window.innerWidth)}px + env(safe-area-inset-bottom, 0px)))` : `${t4}px`;
          g2.style.getPropertyValue(`--kr-ad-${e5}`) !== r4 && g2.style.setProperty(`--kr-ad-${e5}`, r4);
        }
        let F = y2.querySelector(".ds-dock"), q = parseFloat(y2.style.getPropertyValue("--kr-ad-dock-lift")) || 0, K = `${h3 ? 0 : (function(e5, t4, r4 = 0) {
          if (!e5) return 0;
          let a4 = e5.top + r4, n4 = e5.bottom + r4, i2 = 0;
          for (let r5 of [...t4].sort((e6, t5) => t5.top - e6.top)) {
            if (r5.left >= e5.right || r5.right <= e5.left || r5.top >= n4 || r5.bottom <= a4) continue;
            let t5 = Math.ceil(n4 - r5.top);
            i2 += t5, a4 -= t5, n4 -= t5;
          }
          return i2;
        })(F?.getBoundingClientRect() ?? null, f3, q)}px`;
        y2.style.getPropertyValue("--kr-ad-dock-lift") !== K && y2.style.setProperty("--kr-ad-dock-lift", K);
      };
      C.current = x2;
      let b2 = (e3 = 0, t2 = /* @__PURE__ */ new Set(), r2 = () => {
        let e4 = /* @__PURE__ */ new Set([y2, ...y2.querySelectorAll(`${i}, .adunit, .adunit iframe`), ...document.querySelectorAll(l)]);
        for (let r3 of t2) e4.has(r3) || (h2.unobserve(r3), t2.delete(r3));
        for (let r3 of e4) t2.has(r3) || (h2.observe(r3), t2.add(r3));
        x2();
      }, a2 = () => {
        e3 || (e3 = requestAnimationFrame(() => {
          e3 = 0, r2();
        }));
      }, n2 = `${i}, .kr-ad-placement`, (p2 = new MutationObserver((e4) => {
        e4.some((e5) => {
          let t3 = e5.target;
          return !!(t3 instanceof Element && (t3.closest(n2) || t3 === y2 || t3 === document.body || t3 === document.documentElement)) || [...e5.addedNodes, ...e5.removedNodes].some((e6) => e6 instanceof Element && (e6.matches(n2) || e6.querySelector(n2)));
        }) && a2();
      })).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "width", "height", "data-slot-wrapper-hidden"] }), h2 = new ResizeObserver(a2), window.addEventListener("resize", a2), f2 = window.setInterval(a2, 1e3), r2(), () => {
        p2.disconnect(), h2.disconnect(), window.removeEventListener("resize", a2), clearInterval(f2), cancelAnimationFrame(e3);
      }), E2 = window.visualViewport;
      return E2?.addEventListener("resize", x2), E2?.addEventListener("scroll", x2), () => {
        for (let e4 of (C.current = null, b2(), E2?.removeEventListener("resize", x2), E2?.removeEventListener("scroll", x2), y2.style.removeProperty("--kr-ad-dock-lift"), Object.keys(o))) g2.style.removeProperty(`--kr-ad-${e4}`);
      };
    }, [v2, A, L, S, P, w, N, R, j, d2]), (0, r.useLayoutEffect)(() => {
      if (!v2 && T.current) return "resize" === E ? (function(e3, t2 = () => {
      }) {
        let r2 = window.visualViewport;
        if (!r2) return () => {
        };
        let a2 = window.matchMedia("(max-width: 1099px) and (pointer: coarse)"), n2 = () => {
          let t3;
          a2.matches && (t3 = () => (function(e4) {
            if ("u" < typeof document) return;
            let t4 = document.activeElement;
            if (t4 instanceof HTMLElement && e4.contains(t4) && t4.matches("input, textarea, [contenteditable='true']")) for (let r3 = t4.parentElement; r3 && r3 !== e4; r3 = r3.parentElement) {
              let e5 = getComputedStyle(r3).overflowY;
              if ("auto" !== e5 && "scroll" !== e5 || r3.scrollHeight <= r3.clientHeight) continue;
              let a3 = r3.getBoundingClientRect(), n3 = t4.getBoundingClientRect();
              n3.bottom > a3.bottom - 12 ? r3.scrollTop += n3.bottom - (a3.bottom - 12) : n3.top < a3.top + 12 && (r3.scrollTop -= a3.top + 12 - n3.top);
              return;
            }
          })(e3), "function" == typeof window.requestAnimationFrame ? window.requestAnimationFrame(t3) : setTimeout(t3, 0));
        }, i2 = () => {
          e3.removeAttribute("data-visual-viewport"), e3.style.removeProperty("--kr-viewport-height"), e3.style.removeProperty("--kr-viewport-top"), t2();
        }, l2 = () => {
          if (!a2.matches) return void i2();
          if (Math.abs(r2.scale - 1) > 0.05 || r2.height <= 0) return;
          e3.hasAttribute("data-visual-viewport") || e3.setAttribute("data-visual-viewport", "");
          let l3 = false;
          for (let [t3, a3] of [["--kr-viewport-height", `${r2.height}px`], ["--kr-viewport-top", `${Math.max(0, r2.offsetTop)}px`]]) e3.style.getPropertyValue(t3) !== a3 && (e3.style.setProperty(t3, a3), l3 = true);
          t2(), l3 && n2();
        };
        return r2.addEventListener("resize", l2), r2.addEventListener("scroll", l2), window.addEventListener("resize", l2), window.addEventListener("pageshow", l2), a2.addEventListener("change", l2), e3.addEventListener("focusin", n2), l2(), () => {
          r2.removeEventListener("resize", l2), r2.removeEventListener("scroll", l2), window.removeEventListener("resize", l2), window.removeEventListener("pageshow", l2), a2.removeEventListener("change", l2), e3.removeEventListener("focusin", n2), i2();
        };
      })(T.current, () => C.current?.()) : (function(e3, t2 = () => {
      }) {
        let r2, a2, n2, i2 = window.visualViewport, l2 = e3.querySelector(".ds-root");
        if (!i2 || !l2 || !window.matchMedia("(pointer: coarse)").matches) return () => {
        };
        let o2 = document.documentElement.clientHeight, s2 = document.documentElement.clientWidth, d3 = null, c2 = 0, u2 = false, m2 = (e4) => {
          c2 = e4;
          let r3 = e4 ? `0 ${-e4}px` : "";
          l2.style.getPropertyValue("--kr-game-pan") !== r3 && (r3 ? l2.style.setProperty("--kr-game-pan", r3) : l2.style.removeProperty("--kr-game-pan"), t2());
        }, p2 = () => {
          void 0 !== n2 && cancelAnimationFrame(n2), n2 = void 0;
        }, h2 = () => {
          clearTimeout(r2), p2(), u2 = false, m2(0);
        }, f2 = () => !!d3?.isConnected && document.activeElement === d3, v3 = (t3 = true) => (function(e4) {
          if (!e4.focused || e4.closedHeight - e4.height < 120 || Math.abs(e4.width / e4.closedWidth - 1) > 0.08) return 0;
          let t4 = Math.max(0, e4.pageTop - e4.scrollY) + e4.height;
          return Math.max(0, Math.ceil(e4.dockBottom + e4.appliedPan - t4 + 8));
        })({ focused: f2(), closedHeight: o2, closedWidth: s2, height: i2.height, width: i2.width, pageTop: i2.pageTop, scrollY: window.scrollY, dockBottom: (e3.querySelector(".ds-dock")?.getBoundingClientRect().bottom ?? 0) + (t3 && parseFloat(e3.style.getPropertyValue("--kr-ad-dock-lift")) || 0), appliedPan: c2 }), y2 = () => {
          if (u2 = false, !c2 && 0 === v3(false)) return;
          let e4 = d3, t3 = v3();
          if (t3 <= c2) return void m2(t3);
          let r3 = c2, a3 = performance.now(), i3 = (l3) => {
            if (n2 = void 0, d3 !== e4 || !f2()) return void h2();
            let o3 = v3();
            if (o3 < c2) return void m2(o3);
            let s3 = Math.min(1, (l3 - a3) / 160);
            m2(Math.min(o3, r3 + (t3 - r3) * (1 - (1 - s3) ** 3))), s3 < 1 && (n2 = requestAnimationFrame(i3));
          };
          p2(), n2 = requestAnimationFrame(i3);
        }, g2 = () => {
          clearTimeout(r2), r2 = setTimeout(y2, 500);
        }, x2 = (t3) => {
          t3.target instanceof HTMLInputElement && t3.target.matches(".ds-input") && e3.contains(t3.target) && (d3 = t3.target, o2 - i2.height < 120 && (o2 = i2.height, s2 = i2.width), u2 = true, g2());
        }, w2 = () => {
          if (!f2()) return void h2();
          if (Math.abs(document.documentElement.clientWidth / s2 - 1) > 0.2) {
            h2(), o2 = document.documentElement.clientHeight, s2 = document.documentElement.clientWidth;
            return;
          }
          if (c2 || void 0 !== n2) {
            let e4 = v3();
            e4 < c2 && (p2(), m2(e4));
          }
          u2 && g2();
        }, b2 = () => {
          clearTimeout(a2), a2 = setTimeout(() => {
            f2() || h2();
          }, 0);
        }, E2 = (e4) => {
          e4.touches.length > 1 && h2();
        }, k2 = () => {
          u2 = false, clearTimeout(r2), p2();
        };
        return e3.addEventListener("pointerdown", x2), e3.addEventListener("focusin", x2), e3.addEventListener("focusout", b2), e3.addEventListener("touchstart", E2, { passive: true }), e3.addEventListener("touchmove", k2, { passive: true }), i2.addEventListener("resize", w2), i2.addEventListener("scroll", w2), window.addEventListener("scroll", w2, { passive: true }), window.addEventListener("resize", w2), () => {
          h2(), clearTimeout(a2), e3.removeEventListener("pointerdown", x2), e3.removeEventListener("focusin", x2), e3.removeEventListener("focusout", b2), e3.removeEventListener("touchstart", E2), e3.removeEventListener("touchmove", k2), i2.removeEventListener("resize", w2), i2.removeEventListener("scroll", w2), window.removeEventListener("scroll", w2), window.removeEventListener("resize", w2);
        };
      })(T.current, () => C.current?.());
    }, [v2, d2, E]), v2) ? e2 : (0, t.jsxs)("div", { className: "kr-ad-layout", ref: T, children: [e2, A && P && (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("aside", { className: "kr-ad-rail kr-ad-rail-left", "aria-label": "Left advertisement", children: (0, t.jsx)(x, { slot: "sidebarBtf", sizes: "d160x600", label: "Rail \xB7 160 \xD7 600", preview: N }) }), "both" === w && (0, t.jsx)("aside", { className: "kr-ad-rail kr-ad-rail-right", "aria-label": "Right advertisement", children: (0, t.jsx)(x, { slot: "sidebarBtf", sizes: "d160x600", label: "Rail \xB7 160 \xD7 600", preview: N }) })] }), A && N && L && (0, t.jsx)("div", { className: "kr-ad-adhesion-preview", "aria-hidden": "true", children: (0, t.jsxs)("span", { className: "kr-ad-placeholder", children: [R ? "High-impact adhesion \xB7 150px" : "Standard adhesion \xB7 reserved space", (0, t.jsx)("small", { children: "layout preview" })] }) })] });
  }], 35406);
}, 31408, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(71645), a = e.i(37812), n = e.i(39233);
  let i = [1, 2, 3, 4, 5], l = (e2) => `krillion-feedback:${e2}`, o = /* @__PURE__ */ new Set();
  function s(e2) {
    return o.add(e2), window.addEventListener("storage", e2), () => {
      o.delete(e2), window.removeEventListener("storage", e2);
    };
  }
  let d = () => null;
  e.s(["default", 0, function({ game: e2, score: c, prompt: u = "how was that dive? 1 = meh \xB7 5 = great", scaleLabels: m, notesPlaceholder: p = "the third prompt was way too narrow\u2026", preview: h = false }) {
    let f = (0, r.useId)(), v = (function(e3) {
      if (!e3) return null;
      try {
        let t2 = JSON.parse(e3);
        return "number" == typeof t2.rating ? { rating: t2.rating, noted: !!t2.noted } : null;
      } catch {
        return null;
      }
    })((0, r.useSyncExternalStore)(s, () => h ? null : (function(e3) {
      try {
        return window.localStorage.getItem(l(e3));
      } catch {
        return null;
      }
    })(e2), d)), [y, g] = (0, r.useState)(null), x = h ? y : v, [w, b] = (0, r.useState)(null), [E, k] = (0, r.useState)(""), [j, S] = (0, r.useState)("idle"), P = w ?? x?.rating ?? null, L = x?.noted ?? false;
    function N(t2) {
      if (h) g(t2);
      else {
        try {
          window.localStorage.setItem(l(e2), JSON.stringify(t2));
        } catch {
        }
        o.forEach((e3) => e3());
      }
    }
    async function A(t2, r2) {
      if (h) return true;
      try {
        let n2 = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: (0, a.getPlayerId)(), game: e2, rating: t2, score: c, ...r2 ? { notes: r2 } : {} }) }), i2 = await n2.json();
        return !!i2.ok || "throttled" === i2.reason;
      } catch {
        return false;
      }
    }
    async function R(t2) {
      "sending" === j || L || (b(t2), S("sending"), await A(t2) ? (h || (0, n.track)("game_rated", { rating: t2, mode: e2.split(":")[0] }), N({ rating: t2, noted: false }), S("idle")) : S("error"));
    }
    async function T(t2) {
      t2.preventDefault();
      let r2 = E.trim();
      null === P || r2.length < 2 || "sending" === j || (S("sending"), await A(P, r2) ? (h || (0, n.track)("game_feedback_noted", { rating: P, mode: e2.split(":")[0] }), N({ rating: P, noted: true }), S("idle")) : S("error"));
    }
    return (0, t.jsxs)("div", { className: "flex flex-col gap-1.5", children: [(0, t.jsx)("p", { id: `${f}-rating-label`, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: L ? h ? "preview only \u2014 nothing was sent." : "logged \u2014 thanks for the note." : u }), (0, t.jsxs)("div", { className: "feedback-scale", children: [(0, t.jsx)("div", { role: "radiogroup", "aria-labelledby": `${f}-rating-label`, className: "flex items-center gap-2", children: i.map((e3) => (0, t.jsx)("button", { type: "button", role: "radio", "aria-checked": P === e3, "aria-label": `${e3} out of 5`, disabled: L || "sending" === j, onClick: () => R(e3), className: "font-mono-ui text-[14px] tabular-nums min-w-9 h-9 border border-drift/40 text-drift hover:text-lumen-cyan hover:border-lumen-cyan aria-checked:text-lumen-cyan aria-checked:border-lumen-cyan aria-checked:bg-lumen-cyan/10 disabled:cursor-default disabled:hover:text-drift disabled:hover:border-drift/40 aria-checked:disabled:text-lumen-cyan aria-checked:disabled:border-lumen-cyan", children: e3 }, e3)) }), m && (0, t.jsxs)("div", { className: "feedback-scale-labels", children: [(0, t.jsx)("span", { children: m[0] }), (0, t.jsx)("span", { children: m[1] })] })] }), null !== P && !L && (0, t.jsxs)("form", { onSubmit: T, className: "flex flex-col gap-1.5", children: [(0, t.jsx)("label", { htmlFor: `${f}-notes`, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: "any notes? what worked, what didn't" }), (0, t.jsxs)("div", { className: "flex items-baseline gap-3 max-w-sm", children: [(0, t.jsx)("input", { id: `${f}-notes`, value: E, onChange: (e3) => {
      k(e3.target.value), "error" === j && S("idle");
    }, maxLength: 500, placeholder: p, className: "flex-1 min-w-0 bg-transparent border-b border-drift/40 focus:border-lumen-cyan outline-none font-mono-ui text-[13px] text-foam placeholder:text-drift/40 py-1" }), (0, t.jsx)("button", { type: "submit", disabled: E.trim().length < 2 || "sending" === j, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase underline text-drift hover:text-lumen-cyan disabled:opacity-40 disabled:no-underline", children: "sending" === j ? "sending\u2026" : "submit" })] })] }), "error" === j && (0, t.jsx)("p", { className: "font-mono-ui text-[11px] tracking-[0.12em] uppercase text-lumen-pink/80", children: "couldn't send \u2014 try again in a moment." })] });
  }]);
}, 5349, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(22016), a = e.i(71645), n = e.i(18566), i = e.i(15326), l = e.i(12260), o = e.i(44252), s = e.i(89744), d = e.i(91427), c = e.i(4598);
  function u() {
    let [e2, r2] = (0, a.useState)(0);
    return (0, t.jsx)(m, { onReplay: () => r2((e3) => e3 + 1) }, e2);
  }
  function m({ onReplay: e2 }) {
    let [r2] = (0, a.useState)(() => (0, c.buildFlowFixture)()), [n2] = (0, a.useState)(() => (0, o.createRoomFeed)(r2.base)), [i2, l2] = (0, a.useState)(false), s2 = (0, a.useRef)(null), u2 = (0, a.useRef)(null);
    (0, a.useEffect)(() => {
      let e3 = setTimeout(() => l2(true), 4e3);
      return () => clearTimeout(e3);
    }, []), (0, a.useEffect)(() => {
      if (!i2) return;
      let e3 = r2.steps.map((e4) => setTimeout(() => {
        let t2 = null === s2.current ? e4.room : (0, c.previewParticipation)(e4.room, r2.meId, { type: "auto-join", enabled: s2.current });
        n2.push({ ...t2, settings: { ...t2.settings, isPrivate: u2.current ?? t2.settings.isPrivate }, version: (n2.get()?.version ?? 0) + 1 });
      }, e4.after));
      return () => e3.forEach(clearTimeout);
    }, [r2, n2, i2]);
    let p2 = async (t2) => {
      if (["report", "moderate", "chat-enabled", "chat"].includes(t2.type)) return { ok: false, error: "Chat actions are available in a live room, not this preview." };
      if ("settings" === t2.type && "boolean" == typeof t2.settings.isPrivate) {
        let e3 = (0, c.previewVisibility)(n2.get(), r2.meId, t2.settings.isPrivate);
        return e3 ? (u2.current = t2.settings.isPrivate, { ok: true, room: e3 }) : { ok: false, error: "Only the host can change room visibility." };
      }
      return ("start" === t2.type && l2(true), "auto-join" === t2.type) ? (s2.current = t2.enabled, { ok: true, room: (0, c.previewParticipation)(n2.get(), r2.meId, t2) }) : ("again" === t2.type && e2(), { ok: true });
    };
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)(d.default, { feed: n2, meId: r2.meId, onAct: p2, onLeave: () => window.location.assign(`/party/${r2.base.code}?preview=lobby-full`), preview: { hold: false, autoplay: true } }), (0, t.jsxs)("div", { className: "pf-demo-controls", "aria-label": "Game demo controls", children: [(0, t.jsx)("span", { title: "Automatic game demo. Tap the answer box to test your keyboard while the game keeps playing.", children: "DEMO" }), (0, t.jsx)("button", { type: "button", onClick: e2, children: "REPLAY" })] })] });
  }
  var p = e.i(34339), h = e.i(3795);
  function f() {
    return (0, t.jsx)("main", { style: { width: "min(100% - 40px, 520px)", margin: "18vh auto", textAlign: "center" }, children: (0, t.jsxs)("section", { className: "hub-panel", style: { padding: "32px 24px" }, children: [(0, t.jsx)("h1", { style: { fontSize: "clamp(30px, 7vw, 42px)", letterSpacing: ".08em", color: "#4de3ff" }, children: "PUFFER PARTY" }), (0, t.jsx)("p", { style: { fontSize: 22, lineHeight: 1.4, margin: "20px 0 28px" }, children: h.PARTY_PAUSED_MESSAGE }), (0, t.jsx)(r.default, { href: "/", className: "btn-descend", style: { display: "inline-block", fontSize: 20 }, children: "BACK TO KRILLION" })] }) });
  }
  var v = e.i(56838), y = e.i(74588);
  function g({ code: e2 }) {
    let r2 = (0, n.useSearchParams)().get("preview");
    return (0, h.isPartyPaused)() ? (0, t.jsx)(E, { code: e2 }) : "flow" === r2 ? (0, t.jsx)(u, {}) : (0, c.isPreviewState)(r2) ? (0, t.jsx)(x, { state: r2 }, r2) : "join" === r2 ? (0, t.jsx)(k, { code: e2, preview: true, onJoined: () => {
    } }) : (0, t.jsx)(E, { code: e2 });
  }
  function x({ state: e2 }) {
    let [r2] = (0, a.useState)(() => (0, c.buildFixture)(e2)), [n2] = (0, a.useState)(() => (0, o.createRoomFeed)(r2.base)), i2 = (0, a.useRef)(null), l2 = (0, a.useRef)(null);
    (0, a.useEffect)(() => {
      let e3 = r2.steps.map((e4) => setTimeout(() => {
        let t2 = null === i2.current ? e4.room : (0, c.previewParticipation)(e4.room, r2.meId, { type: "auto-join", enabled: i2.current });
        n2.push({ ...t2, settings: { ...t2.settings, isPrivate: l2.current ?? t2.settings.isPrivate }, version: (n2.get()?.version ?? 0) + 1 });
      }, e4.after));
      return () => e3.forEach(clearTimeout);
    }, [r2, n2]);
    let s2 = async (e3) => {
      if (["report", "moderate", "chat-enabled", "chat"].includes(e3.type)) return { ok: false, error: "Chat actions are available in a live room, not this preview." };
      if ("settings" === e3.type && "boolean" == typeof e3.settings.isPrivate) {
        let t3 = (0, c.previewVisibility)(n2.get(), r2.meId, e3.settings.isPrivate);
        return t3 ? (l2.current = e3.settings.isPrivate, { ok: true, room: t3 }) : { ok: false, error: "Only the host can change room visibility." };
      }
      "auto-join" === e3.type && (i2.current = e3.enabled);
      let t2 = (0, c.previewParticipation)(n2.get(), r2.meId, e3);
      return t2 ? { ok: true, room: t2 } : ("start" === e3.type && window.location.assign(`/party/${r2.base.code}?preview=flow`), { ok: true });
    };
    return (0, t.jsx)(d.default, { feed: n2, meId: r2.meId, onAct: s2, onLeave: () => window.location.assign("/party?preview=1"), preview: { hold: true, input: r2.input, level: r2.level ?? null } });
  }
  function w({ code: e2, text: a2 }) {
    return (0, t.jsx)(s.default, { children: (0, t.jsxs)("div", { className: "pf-door", children: [(0, t.jsx)(s.PartyTitle, {}), (0, t.jsx)("div", { className: "pf-door-gap" }), (0, t.jsx)("div", { className: "pf-door-cols", children: (0, t.jsx)("div", { className: "pf-door-col solo", children: (0, t.jsxs)("div", { className: "pf-panel", children: [(0, t.jsxs)("h3", { children: ["ROOM ", e2] }), (0, t.jsx)("div", { className: "pf-empty", children: a2 }), (0, t.jsx)(r.default, { className: "pf-back", href: "/party", children: "\u25B8 back to the rooms" })] }) }) })] }) });
  }
  let b = [1e3, 2e3, 4e3, 8e3, 15e3, 15e3];
  function E({ code: e2 }) {
    let r2 = (0, n.useRouter)(), l2 = (0, o.useStoredSeat)(e2), [c2] = (0, a.useState)(() => (0, o.createRoomFeed)()), [u2, m2] = (0, a.useState)(null), [p2, g2] = (0, a.useState)(null), [x2, j] = (0, a.useState)(null), [S, P] = (0, a.useState)(false), L = (0, a.useRef)(null), N = (0, a.useRef)(0), A = (0, a.useRef)(false), R = (0, a.useRef)(0), T = (0, a.useRef)(true), I = (0, a.useRef)(null);
    (0, a.useEffect)(() => {
      I.current = u2?.playerKey ?? null;
    }, [u2]), (0, a.useEffect)(() => (T.current = true, () => {
      T.current = false;
    }), []), (0, a.useEffect)(() => {
      if (!l2 || u2 || L.current === l2.playerKey) return;
      L.current = l2.playerKey;
      let t2 = ++R.current, r3 = 0, a2 = () => T.current && R.current === t2, n2 = () => {
        a2() && (0, o.joinRoom)(e2, { name: l2.name, character: l2.character, playerKey: l2.playerKey }).then((t3) => {
          if (!a2()) return;
          let r4 = { ...l2, playerId: t3.playerId, playerKey: t3.playerKey };
          (r4.playerId !== l2.playerId || r4.playerKey !== l2.playerKey) && (0, o.saveSeat)(e2, r4), A.current = false, m2(r4);
        }, (t3) => {
          if (a2()) if (t3 instanceof o.PartyError && 410 === t3.status) g2(h.PARTY_PAUSED_MESSAGE);
          else if (t3 instanceof o.PartyError && 404 === t3.status) g2(`no room ${e2} here. it may have closed`);
          else if (t3 instanceof o.PartyError && t3.code === o.VERIFICATION_NEEDED) g2("a quick check is needed to keep playing. reload to try again");
          else if ((0, o.isPassingJoinFailure)(t3)) {
            let e3 = b[r3++];
            void 0 !== e3 ? setTimeout(n2, e3) : g2(t3 instanceof o.PartyError && 0 === t3.status ? "no signal. reload to try again" : "couldn't reach your seat. reload to try again");
          } else A.current = false, j((0, v.errorText)(t3, e2)), (0, o.clearSeat)(e2);
        });
      };
      n2();
    }, [l2, u2, e2]);
    let M = (0, a.useCallback)(() => {
      if (!A.current) {
        if (N.current >= 4) return void g2("lost your seat. reload to try again");
        N.current++, A.current = true, L.current = null, m2(null);
      }
    }, []);
    (0, a.useEffect)(() => {
      if (u2) return c2.subscribe((t2) => {
        t2.players.some((e3) => e3.id === u2.playerId && e3.removed) ? ((0, o.clearSeat)(e2), g2("The host removed you from this room.")) : t2.players.some((e3) => e3.id === u2.playerId) || M();
      });
    }, [c2, u2, M, e2]), (0, a.useEffect)(() => {
      if (!u2) return;
      (0, o.holdSeat)(e2, u2);
      let t2 = setInterval(() => (0, o.holdSeat)(e2, u2), o.SEAT_HOLD_REFRESH_MS);
      return () => clearInterval(t2);
    }, [u2, e2]);
    let C = (0, o.useRoomStream)(e2, u2?.playerKey ?? null, c2);
    (0, a.useEffect)(() => {
      if ("refused" !== C) return;
      let e3 = setTimeout(M, 0);
      return () => clearTimeout(e3);
    }, [C, M]), (0, a.useEffect)(() => {
      if ("live" !== C) return;
      let e3 = setTimeout(() => {
        N.current = 0;
      }, 3e4);
      return () => clearTimeout(e3);
    }, [C, u2]);
    let F = u2?.playerKey ?? null, q = (0, a.useCallback)(async (t2) => {
      if (!F) return { ok: false, error: "no seat" };
      let r3 = await (0, o.act)(e2, F, t2);
      return 403 === r3.status && "You are not in this room." === r3.error && I.current === F && M(), r3;
    }, [e2, F, M]), K = (0, a.useCallback)(() => {
      u2 && (0, y.rememberLeavingRating)(c2.get(), u2.playerId), P(true), F && (0, o.act)(e2, F, { type: "leave" }), (0, o.clearSeat)(e2), r2.push("/party");
    }, [e2, F, r2, c2, u2]), O = (0, a.useCallback)((t2, a2) => {
      (0, y.rememberLeavingRating)(c2.get(), a2.playerId), (0, o.act)(e2, a2.playerKey, { type: "leave" }), (0, o.clearSeat)(e2), (0, o.saveSeat)(t2.code, { playerId: t2.playerId, playerKey: t2.playerKey, name: a2.name, character: a2.character }), r2.replace(`/party/${t2.code}`);
    }, [e2, r2, c2]), [$, _] = (0, a.useState)(false), z = (0, a.useCallback)(() => {
      let t2 = c2.get(), r3 = t2?.queue;
      u2 && r3 && !$ && (_(true), (0, o.quickPlay)({ name: u2.name, character: u2.character, size: r3, rated: !!t2?.rated, moveFrom: e2, fromKey: u2.playerKey }).then((e3) => {
        e3.stay ? _(false) : O(e3, u2);
      }, (e3) => {
        _(false), j((0, v.errorText)(e3));
      }));
    }, [c2, u2, $, O, e2]);
    return ((0, a.useEffect)(() => {
      if (!u2) return;
      let t2 = false, r3 = setInterval(() => {
        let r4 = c2.get();
        if (t2 || !r4?.queue || "lobby" !== r4.phase) return;
        let a2 = r4.players.filter((e3) => false !== e3.ready && e3.connected), n2 = r4.players.find((e3) => e3.id === u2.playerId);
        n2 && false !== n2.ready && null == r4.gatherEndsAt && !(a2.length >= i.QUICK_PLAY_TABLES[r4.queue].min) && (t2 = true, (0, o.quickPlay)({ name: u2.name, character: u2.character, size: r4.queue, rated: !!r4.rated, from: e2, fromKey: u2.playerKey }).then((e3) => {
          e3.stay ? t2 = false : O(e3, u2);
        }, () => {
          t2 = false;
        }));
      }, 6e3);
      return () => clearInterval(r3);
    }, [u2, c2, e2, O]), "paused" === C || p2 === h.PARTY_PAUSED_MESSAGE || (0, h.isPartyPaused)() && null === l2 && !u2) ? (0, t.jsx)(f, {}) : p2 ? (0, t.jsx)(w, { code: e2, text: p2 }) : "removed" === C ? (0, t.jsx)(w, { code: e2, text: (0, o.removalMessage)(e2, u2?.playerKey ?? null) ?? "The host removed or banned you from this room." }) : "gone" === C ? (0, t.jsx)(w, { code: e2, text: "this room closed" }) : S ? (0, t.jsx)(s.default, { children: (0, t.jsx)("div", { className: "pf-loading", children: "see you" }) }) : $ ? (0, t.jsx)(s.default, { children: (0, t.jsx)("div", { className: "pf-loading", children: "finding a table\u2026" }) }) : u2 ? (0, t.jsx)(d.default, { feed: c2, meId: u2.playerId, onAct: q, onLeave: K, onFindGame: z, stream: C }) : null !== l2 ? (0, t.jsx)(s.default, { children: (0, t.jsx)("div", { className: "pf-loading", children: "swimming in\u2026" }) }) : (0, t.jsx)(k, { code: e2, error: x2, onJoined: m2 });
  }
  function k({ code: e2, error: n2 = null, preview: d2 = false, onJoined: c2 }) {
    let u2 = (0, o.usePartyName)(), m2 = (0, l.usePreferences)(), [h2, f2] = (0, a.useState)(null), [y2, g2] = (0, a.useState)(null), x2 = (0, o.usePartyCharacter)(), [w2, b2] = (0, a.useState)(false), [E2, j] = (0, a.useState)(null === n2 ? null : { msg: n2 }), S = h2 ?? u2, P = y2 ?? x2 ?? m2.character, L = async (t2 = false) => {
      let r2 = (0, i.normalizeName)(S);
      if (!r2) return void j({ msg: v.nameHelp });
      if (!w2 && !d2) {
        b2(true), j(null);
        try {
          let a2 = await (0, o.joinRoom)(e2, { name: r2, character: P, ...t2 ? { replace: t2 } : {} });
          (0, o.savePartyName)(r2);
          let n3 = { playerId: a2.playerId, playerKey: a2.playerKey, name: r2, character: P };
          (0, o.saveSeat)(e2, n3), c2(n3);
        } catch (t3) {
          j((0, v.joinFailure)(t3, e2)), b2(false);
        }
      }
    };
    return (0, t.jsx)(s.default, { children: (0, t.jsxs)("div", { className: "pf-door", children: [(0, t.jsx)(s.PartyTitle, {}), (0, t.jsx)("div", { className: "pf-door-gap" }), (0, t.jsx)("div", { className: "pf-door-cols", children: (0, t.jsx)("div", { className: "pf-door-col solo", children: (0, t.jsxs)("div", { className: "pf-panel", children: [(0, t.jsxs)("div", { className: "pf-panel-heading", children: [(0, t.jsx)("h3", { children: "JOIN THE RING" }), (0, t.jsx)(p.default, {})] }), (0, t.jsx)("div", { className: "pf-join-code", children: e2 }), (0, t.jsx)(s.IdentityFields, { name: S, onName: f2, character: P, onCharacter: (e3) => {
      g2(e3), (0, o.savePartyCharacter)(e3);
    }, onEnter: () => void L() }), (0, t.jsx)("div", { style: { marginTop: 22 }, children: (0, t.jsx)("button", { type: "button", className: "ds-begin-btn", disabled: w2, onClick: () => void L(), children: w2 ? "SWIMMING IN\u2026" : (0, t.jsx)(t.Fragment, { children: "\u25BC TAKE A SEAT \u25BC" }) }) }), E2 && (0, t.jsx)(v.JoinError, { failure: E2, disabled: w2, onLeave: () => void L(true) }), (0, t.jsx)(r.default, { className: "pf-back", href: "/party", children: "\u25B8 other rooms" })] }) }) })] }) });
  }
  e.s(["default", 0, function({ code: e2 }) {
    return (0, t.jsx)(a.Suspense, { fallback: (0, t.jsx)(s.default, { children: (0, t.jsx)("div", { className: "pf-loading", children: "swimming in\u2026" }) }), children: (0, t.jsx)(g, { code: e2 }) });
  }], 5349);
}]);
