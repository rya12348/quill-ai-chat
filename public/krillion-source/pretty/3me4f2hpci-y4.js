(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 33818, (e) => {
  e.q("/_next/static/media/plushie-concept-2026.2f6vs3-nh1z46.webp");
}, 17747, (e) => {
  "use strict";
  let t = /^[A-Za-z0-9_-]{16,128}$/;
  e.s(["COMPLETION_RECEIPT_FUTURE_SKEW_MS", 0, 3e5, "COMPLETION_RECEIPT_TTL_MS", 0, 72e5, "createCompletionRunId", 0, function() {
    if ("u" > typeof crypto && "function" == typeof crypto.randomUUID) return crypto.randomUUID();
    let e2 = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.padEnd(24, "0").slice(0, 24);
    return `run_${Date.now().toString(36).padStart(10, "0")}_${e2}`;
  }, "isCompletionRunId", 0, function(e2) {
    return "string" == typeof e2 && t.test(e2);
  }]);
}, 14828, (e) => {
  e.v({ art: "PlushiePromo-module___RPqyW__art", body: "PlushiePromo-module___RPqyW__body", caption: "PlushiePromo-module___RPqyW__caption", clip: "PlushiePromo-module___RPqyW__clip", clipTag: "PlushiePromo-module___RPqyW__clipTag", collab: "PlushiePromo-module___RPqyW__collab", cta: "PlushiePromo-module___RPqyW__cta", facts: "PlushiePromo-module___RPqyW__facts", figure: "PlushiePromo-module___RPqyW__figure", frame: "PlushiePromo-module___RPqyW__frame", gameName: "PlushiePromo-module___RPqyW__gameName", headline: "PlushiePromo-module___RPqyW__headline", kicker: "PlushiePromo-module___RPqyW__kicker", panel: "PlushiePromo-module___RPqyW__panel", photo: "PlushiePromo-module___RPqyW__photo", split: "PlushiePromo-module___RPqyW__split", splitCopy: "PlushiePromo-module___RPqyW__splitCopy", terms: "PlushiePromo-module___RPqyW__terms" });
}, 68730, (e) => {
  e.v({ body: "InstagramPromo-module__NqCNhW__body", cta: "InstagramPromo-module__NqCNhW__cta", handle: "InstagramPromo-module__NqCNhW__handle", headline: "InstagramPromo-module__NqCNhW__headline", icon: "InstagramPromo-module__NqCNhW__icon", kicker: "InstagramPromo-module__NqCNhW__kicker", note: "InstagramPromo-module__NqCNhW__note", panel: "InstagramPromo-module__NqCNhW__panel" });
}, 52250, 9371, 98504, 95721, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(57688), a = e.i(71645);
  let n = { src: e.i(33818).default, width: 800, height: 800, blurWidth: 8, blurHeight: 8, blurDataURL: "data:image/webp;base64,UklGRiYBAABXRUJQVlA4TBkBAAAvB8ABAM1VICICHggADiIAAIDbMCIsSDEhBAIAAQACEQAAgACBwIsQIAEEAEAABAKCAAiVUFCFgRe2BQAA8EAAbBAAAADOf39IKLkgD3AAAAECQgAAgEABAQBBJAAAEAAACgAIIAigA5IkDZIEPg8EIAcBAADg/G+756HyJIAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsKkArWnfRy6SiCA5tD8s/DEBAN8tSN94fM5Kysq6RC8BxSA5uStHKFVhdXmk7Z7VtkXJOcYqtc3WEVXofgbTEG+TEvse7v6+tlBGtj0Eu6LgXkIUxuNJX/LhipZGTPZ0C2YHgP7FLtnkS5/O4XT+uspOB4Cw8HeyeXk83kVT/PXDBgA=" };
  var i = e.i(14828);
  let l = Date.parse("2026-10-19T19:00:00Z"), o = Date.parse("2026-10-26T19:00:00Z");
  e.s(["default", 0, function() {
    let e2 = (0, a.useId)(), [s2, d2] = (0, a.useState)(false);
    return ((0, a.useEffect)(() => {
      let e3 = () => {
        var e4;
        return d2(Number.isFinite(e4 = Date.now()) && e4 >= l && e4 < o);
      }, t2 = setTimeout(e3, 0), r2 = setInterval(e3, 3e4);
      return document.addEventListener("visibilitychange", e3), () => {
        clearTimeout(t2), clearInterval(r2), document.removeEventListener("visibilitychange", e3);
      };
    }, []), s2) ? (0, t.jsxs)("section", { className: `hub-panel ${i.default.panel}`, "aria-labelledby": e2, children: [(0, t.jsxs)("p", { className: i.default.kicker, children: ["Plushie concept ", (0, t.jsx)("span", { "aria-hidden": "true", children: "\xB7" }), " Voting is open"] }), (0, t.jsx)("h2", { id: e2, className: `font-display ${i.default.headline}`, children: "Bring your krill home." }), (0, t.jsxs)("div", { className: i.default.split, children: [(0, t.jsxs)("figure", { className: i.default.figure, children: [(0, t.jsx)("div", { className: `${i.default.clip} ${i.default.frame}`, children: (0, t.jsx)(r.default, { src: n, alt: "Youtooz concept illustration of a red Krillion plush with curled antennae and a fanned tail", sizes: "(max-width: 380px) 124px, 170px", className: i.default.art }) }), (0, t.jsx)("figcaption", { className: i.default.caption, children: "Concept art \xB7 9-inch plush" })] }), (0, t.jsxs)("div", { className: i.default.splitCopy, children: [(0, t.jsxs)("p", { className: `font-display ${i.default.gameName} ${i.default.collab}`, children: ["Krillion ", (0, t.jsx)("span", { "aria-hidden": "true", children: "\xD7" }), (0, t.jsx)("span", { className: "sr-only", children: "and" }), " Youtooz"] }), (0, t.jsx)("p", { className: i.default.body, children: "I like this little guy a lot." })] })] }), (0, t.jsxs)("dl", { className: i.default.facts, children: [(0, t.jsxs)("div", { children: [(0, t.jsx)("dt", { children: "Vote with a deposit" }), (0, t.jsx)("dd", { children: "$2.99 USD" })] }), (0, t.jsxs)("div", { children: [(0, t.jsx)("dt", { children: "Community goal" }), (0, t.jsx)("dd", { children: "200 votes" })] })] }), (0, t.jsxs)("a", { className: `btn-descend ${i.default.cta}`, href: "https://youtooz.com/products/krillion-plush-9-inch", target: "_blank", rel: "noopener noreferrer", children: ["Vote on Youtooz ", (0, t.jsx)("span", { "aria-hidden": "true", children: "\u2197" }), (0, t.jsx)("span", { className: "sr-only", children: " (opens in a new tab)" })] }), (0, t.jsx)("p", { className: i.default.terms, children: "Deposit refunded if the goal isn\u2019t met. If funded, $24.01 USD plus shipping & tax is charged at launch." })] }) : null;
  }], 52250);
  var s = e.i(39233), d = e.i(68730);
  let c = "youareoneinakrillion", u = `https://www.instagram.com/${c}/`;
  e.s(["default", 0, function({ placement: e2 }) {
    let r2 = (0, a.useId)(), n2 = (0, a.useRef)(null);
    return (0, a.useEffect)(() => {
      if (!n2.current || "u" < typeof IntersectionObserver) return;
      let t2 = new IntersectionObserver(([r3]) => {
        r3.isIntersecting && ((0, s.track)("instagram_promo_view", { placement: e2 }), t2.disconnect());
      }, { threshold: 0.5 });
      return t2.observe(n2.current), () => t2.disconnect();
    }, [e2]), (0, t.jsxs)("section", { ref: n2, className: `hub-panel ${d.default.panel}`, "aria-labelledby": r2, children: [(0, t.jsxs)("p", { className: d.default.kicker, children: [(0, t.jsx)("svg", { className: d.default.icon, viewBox: "0 0 20 20", fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": "true", children: (0, t.jsx)("path", { fillRule: "evenodd", d: "M4 2h12v2h2v12h-2v2H4v-2H2V4h2z M5 4h10v1h1v10h-1v1H5v-1H4V5h1z M8 6h4v1h1v1h1v4h-1v1h-1v1H8v-1H7v-1H6V8h1V7h1z M9 8h2v1h1v2h-1v1H9v-1H8V9h1z M13 5h2v2h-2z" }) }), "Instagram"] }), (0, t.jsx)("h2", { id: r2, className: `font-display ${d.default.headline}`, children: "Follow us on Instagram" }), (0, t.jsxs)("p", { className: d.default.handle, children: ["@", c] }), (0, t.jsx)("p", { className: d.default.body, children: "Keep up with Krillion between dives." }), (0, t.jsxs)("a", { className: `btn-descend ${d.default.cta}`, href: u, target: "_blank", rel: "noopener noreferrer", onClick: () => (0, s.track)("instagram_promo_click", { placement: e2 }), children: ["Follow ", (0, t.jsx)("span", { "aria-hidden": "true", children: "\u2197" }), (0, t.jsx)("span", { className: "sr-only", children: " (opens in a new tab)" })] }), (0, t.jsx)("p", { className: d.default.note, children: "This is Krillion's only account. @krillion.io is an impersonator." })] });
  }], 9371);
  var m = e.i(32368);
  e.s(["default", 0, function() {
    return (0, t.jsxs)("a", { className: m.default.link, href: "https://www.roblox.com/games/121347884701659/Krillion-Guess-the-Rarest-Answer", target: "_blank", rel: "noopener noreferrer", children: [(0, t.jsx)("svg", { className: m.default.icon, viewBox: "0 0 100 100", fill: "currentColor", "aria-hidden": "true", children: (0, t.jsx)("path", { fillRule: "evenodd", d: "M25 7 93 25 75 93 7 75ZM42 36 36 58 58 64 64 42Z" }) }), (0, t.jsxs)("span", { className: m.default.copy, children: [(0, t.jsx)("span", { className: m.default.label, children: "Play Krillion on Roblox" }), (0, t.jsx)("span", { className: m.default.detail, children: "A new way to dive in." })] }), (0, t.jsx)("span", { className: m.default.arrow, "aria-hidden": "true", children: "\u2197" }), (0, t.jsx)("span", { className: "sr-only", children: " (opens in a new tab)" })] });
  }], 98504), e.s(["formatPercentile", 0, function(e2) {
    return e2 >= 99.5 ? e2.toFixed(2) : String(e2);
  }], 95721);
}, 35897, (e) => {
  e.v({ grid: "CharacterControl-module__6oQ2ua__grid", key: "CharacterControl-module__6oQ2ua__key", locked: "CharacterControl-module__6oQ2ua__locked", name: "CharacterControl-module__6oQ2ua__name", req: "CharacterControl-module__6oQ2ua__req", sprite: "CharacterControl-module__6oQ2ua__sprite", trigger: "CharacterControl-module__6oQ2ua__trigger" });
}, 444, 28631, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(95721), a = e.i(86062);
  e.s(["default", 0, function({ dist: e2, score: n2, betterThan: i2, populationLabel: l2 = "today's players" }) {
    let o2, s2 = (o2 = [0.06, 0.24, 0.4, 0.24, 0.06], e2.map((t2, r2) => {
      let a2 = 0, n3 = 0;
      for (let t3 = -2; t3 <= 2; t3++) {
        let i3 = r2 + t3;
        if (i3 < 0 || i3 >= e2.length) continue;
        let l3 = o2[t3 + 2];
        a2 += e2[i3] * l3, n3 += l3;
      }
      return n3 > 0 ? a2 / n3 : 0;
    })), d2 = Math.max(...s2);
    if (!(d2 > 0)) return null;
    let c2 = s2.length, u2 = [[0, 78]];
    s2.forEach((e3, t2) => {
      u2.push([(t2 + 0.5) / c2 * 320, 78 - e3 / d2 * 68]);
    }), u2.push([320, 78]);
    let m = Math.min(n2, a.MAX_DAY_SCORE) / a.MAX_DAY_SCORE * 320, h = 78;
    for (let e3 = 0; e3 < u2.length - 1; e3++) {
      let [t2, r2] = u2[e3], [a2, n3] = u2[e3 + 1];
      if (m >= t2 && m <= a2) {
        h = r2 + (n3 - r2) * (a2 === t2 ? 0 : (m - t2) / (a2 - t2));
        break;
      }
    }
    let p = (function(e3) {
      if (e3.length < 2) return "";
      let t2 = `M ${e3[0][0]} ${e3[0][1]}`;
      for (let r2 = 0; r2 < e3.length - 1; r2++) {
        let a2 = e3[Math.max(0, r2 - 1)], n3 = e3[r2], i3 = e3[r2 + 1], l3 = e3[Math.min(e3.length - 1, r2 + 2)], o3 = n3[0] + (i3[0] - a2[0]) / 6, s3 = n3[1] + (i3[1] - a2[1]) / 6, d3 = i3[0] - (l3[0] - n3[0]) / 6, c3 = i3[1] - (l3[1] - n3[1]) / 6;
        t2 += ` C ${o3} ${s3}, ${d3} ${c3}, ${i3[0]} ${i3[1]}`;
      }
      return t2;
    })(u2), f = `${p} L 320 78 L 0 78 Z`, v = Math.min(Math.max(m, 14), 306);
    return (0, t.jsxs)("div", { className: "mt-3", children: [(0, t.jsxs)("svg", { viewBox: "0 0 320 96", className: "w-full h-auto", role: "img", "aria-label": null !== i2 ? `Score distribution of ${l2}; your score beats ${(0, r.formatPercentile)(i2)}% of them` : `Score distribution of ${l2}`, children: [(0, t.jsxs)("defs", { children: [(0, t.jsxs)("linearGradient", { id: "pc-fill", x1: "0", y1: "0", x2: "0", y2: "1", children: [(0, t.jsx)("stop", { offset: "0%", stopColor: "var(--color-lumen-cyan)", stopOpacity: "0.45" }), (0, t.jsx)("stop", { offset: "100%", stopColor: "var(--color-lumen-cyan)", stopOpacity: "0.02" })] }), (0, t.jsx)("clipPath", { id: "pc-beaten", children: (0, t.jsx)("rect", { x: "0", y: "0", width: m, height: 96 }) })] }), (0, t.jsx)("path", { d: f, fill: "url(#pc-fill)", opacity: "0.28" }), (0, t.jsx)("path", { d: f, fill: "url(#pc-fill)", clipPath: "url(#pc-beaten)" }), (0, t.jsx)("path", { d: p, fill: "none", stroke: "var(--color-lumen-cyan)", strokeWidth: "1.4", strokeOpacity: "0.75" }), (0, t.jsx)("line", { x1: "0", y1: 78, x2: 320, y2: 78, stroke: "var(--hairline)" }), [100, 200, 300, 400, 500, 600].map((e3) => {
      let r2 = e3 / a.MAX_DAY_SCORE * 320, n3 = 18 > Math.abs(r2 - m);
      return (0, t.jsxs)("g", { children: [(0, t.jsx)("line", { x1: r2, y1: 78, x2: r2, y2: 81.5, stroke: "var(--color-drift)", strokeOpacity: "0.5" }), !n3 && (0, t.jsx)("text", { x: r2, y: 90, textAnchor: "middle", className: "font-mono-ui", fontSize: "9", fill: "var(--color-drift)", opacity: "0.55", children: e3 })] }, e3);
    }), (0, t.jsx)("line", { x1: m, y1: Math.min(h, 74) - 3, x2: m, y2: 78, stroke: "var(--color-lumen-pink)", strokeWidth: "1.2" }), (0, t.jsx)("circle", { cx: m, cy: h, r: "2.6", fill: "var(--color-lumen-pink)" }), (0, t.jsx)("text", { x: v, y: 90, textAnchor: "middle", className: "font-mono-ui", fontSize: "9", letterSpacing: "0.12em", fill: "var(--color-lumen-pink)", children: "YOU" }), (0, t.jsx)("text", { x: "0", y: 90, className: "font-mono-ui", fontSize: "9", fill: "var(--color-drift)", opacity: "0.6", children: "0" }), (0, t.jsx)("text", { x: 320, y: 90, textAnchor: "end", className: "font-mono-ui", fontSize: "9", fill: "var(--color-drift)", opacity: "0.6", children: a.MAX_DAY_SCORE })] }), null !== i2 && (0, t.jsxs)("p", { className: "font-mono-ui text-[13px] tracking-[0.14em] uppercase text-lumen-cyan mt-1", style: { textShadow: "0 0 6px var(--color-abyss), 0 1px 3px var(--color-abyss)" }, children: ["better than ", (0, r.formatPercentile)(i2), "% of ", l2] })] });
  }], 444);
  var n = e.i(36484), i = e.i(71645), l = e.i(86968), o = e.i(12260), s = e.i(3823), d = e.i(37812), c = e.i(21166), u = e.i(35897);
  e.s(["default", 0, function() {
    let [e2, r2] = (0, i.useState)(false), { character: a2 } = (0, o.usePreferences)(), m = (0, i.useMemo)(() => e2 ? (0, d.loadStats)().maxStreak : 0, [e2]), h = (0, i.useRef)(null), p = (0, i.useRef)(null), f = (0, i.useRef)(null);
    return (0, i.useEffect)(() => {
      if (!e2) return;
      (0, s.setSettingsModalOpen)(true);
      let t2 = h.current, a3 = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      let n2 = requestAnimationFrame(() => f.current?.focus()), i2 = (e3) => {
        if ("Escape" === e3.key) {
          e3.preventDefault(), r2(false);
          return;
        }
        if ("Tab" !== e3.key) return;
        let t3 = p.current;
        if (!t3) return;
        let a4 = Array.from(t3.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((e4) => e4.getClientRects().length > 0);
        if (0 === a4.length) {
          e3.preventDefault(), t3.focus();
          return;
        }
        let n3 = a4[0], i3 = a4[a4.length - 1];
        e3.shiftKey && document.activeElement === n3 ? (e3.preventDefault(), i3.focus()) : e3.shiftKey || document.activeElement !== i3 || (e3.preventDefault(), n3.focus());
      };
      return document.addEventListener("keydown", i2), () => {
        cancelAnimationFrame(n2), document.removeEventListener("keydown", i2), document.body.style.overflow = a3, (0, s.setSettingsModalOpen)(false), t2?.focus();
      };
    }, [e2]), (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { ref: h, type: "button", className: u.default.trigger, "aria-label": "Open wardrobe", "aria-haspopup": "dialog", "aria-expanded": e2, onClick: () => {
      (0, s.setSettingsModalOpen)(true), r2(true);
    }, children: (0, t.jsx)("svg", { viewBox: "0 0 20 20", shapeRendering: "crispEdges", fill: "currentColor", "aria-hidden": "true", children: (0, t.jsx)("path", { fillRule: "evenodd", d: "M4 3H8V5H4Z M12 3H16V5H12Z M2 5H18V9H2Z M5 9H15V17H5Z M9 5H11V7H9Z" }) }) }), e2 && (0, t.jsx)("div", { className: c.default.backdrop, onMouseDown: (e3) => {
      e3.target === e3.currentTarget && r2(false);
    }, children: (0, t.jsxs)("div", { ref: p, className: c.default.dialog, role: "dialog", "aria-modal": "true", "aria-label": "Wardrobe", tabIndex: -1, children: [(0, t.jsx)("button", { ref: f, type: "button", className: c.default.close, "aria-label": "Close wardrobe", onClick: () => r2(false), children: "\xD7" }), (0, t.jsx)("div", { className: u.default.grid, role: "group", "aria-label": "Dive buddy", children: l.MASCOT_CHARACTERS.map((e3) => {
      let r3 = !(0, l.isMascotUnlocked)(e3, m);
      return (0, t.jsxs)("button", { type: "button", className: r3 ? `${u.default.key} ${u.default.locked}` : u.default.key, disabled: r3, "aria-pressed": r3 ? void 0 : a2 === e3.id, "aria-label": r3 ? `${e3.name} \u2014 unlocks at a ${e3.unlockStreak}-day streak` : void 0, onClick: () => (0, o.setCharacter)(e3.id), children: [(0, t.jsx)(n.default, { src: e3.sprite, alt: "", className: u.default.sprite, draggable: false }), (0, t.jsx)("span", { className: u.default.name, children: e3.name }), r3 && (0, t.jsxs)("span", { className: u.default.req, children: [e3.unlockStreak, "-day streak"] })] }, e3.id);
    }) })] }) })] });
  }], 28631);
}, 35406, (e) => {
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
  let h = () => false;
  function p(e2) {
    let t2 = (0, r.useCallback)((t3) => {
      let r2 = window.matchMedia(e2);
      return r2.addEventListener("change", t3), () => r2.removeEventListener("change", t3);
    }, [e2]);
    return (0, r.useSyncExternalStore)(t2, () => window.matchMedia(e2).matches, h);
  }
  let f = (e2) => (window.addEventListener("popstate", e2), () => window.removeEventListener("popstate", e2)), v = () => "1" === new URLSearchParams(window.location.search).get("ads"), x = () => "high-impact" === new URLSearchParams(window.location.search).get("adhesion");
  function g() {
    return (0, r.useSyncExternalStore)(f, v, h);
  }
  function y({ slot: e2, sizes: r2, label: a2, preview: n2 }) {
    return (0, t.jsx)("div", { className: "kr-ad-placement", "aria-label": "Advertisement", children: n2 ? (0, t.jsxs)("div", { className: "kr-ad-placeholder", children: [a2, (0, t.jsx)("small", { children: "layout preview" })] }) : (0, t.jsx)("div", { className: "mv_slot_target", "data-slot": e2, "data-hint-slot-sizes": r2 }) });
  }
  e.s(["ResultsAd", 0, function() {
    let e2 = (0, a.useAdsEnabled)(), r2 = g();
    return e2 ? (0, t.jsx)("aside", { className: "kr-ad-results", "aria-label": "Results advertisement", children: (0, t.jsx)(y, { slot: "content", sizes: "300x250", label: "Results \xB7 300 \xD7 250", preview: r2 }) }) : null;
  }, "default", 0, function({ children: e2, phase: d2, disabled: v2 = false, railMode: _ = "both", allowAdPreview: b = false, keyboardBehavior: w = "pan" }) {
    let A = (0, a.useAdsEnabled)(), k = (0, a.useAdLoadState)(), j = p("(min-width: 1024px) and (hover: hover) and (pointer: fine)"), E = p("(min-width: 1200px) and (min-height: 710px) and (hover: hover) and (pointer: fine)"), N = p("(max-width: 767px)") ? n.ADHESION_ENABLED.mobile : j ? n.ADHESION_ENABLED.desktop : n.ADHESION_ENABLED.tablet, P = g(), S = A || b && P, M = (0, r.useSyncExternalStore)(f, x, h), R = (0, r.useRef)(null), C = (0, r.useRef)(o), $ = (0, r.useRef)(/* @__PURE__ */ new WeakMap()), L = (0, r.useRef)(null);
    return ((0, r.useLayoutEffect)(() => {
      let e3, t2, r2, a2, n2, h2, p2, f2, x2 = R.current;
      if (!x2 || v2 || !S) {
        C.current = o;
        return;
      }
      let g2 = document.documentElement, y2 = () => {
        var e4;
        for (let e5 of x2.querySelectorAll(".kr-ad-placement")) {
          let t4 = [...e5.querySelectorAll(i)].map((e6) => m(e6)).filter((e6) => null !== e6);
          t4.push(...[...e5.querySelectorAll(c)].filter((e6) => !e6.closest(i)).flatMap(u));
          let r4 = String(P || t4.length > 0);
          e5.dataset.adFilled !== r4 && (e5.dataset.adFilled = r4);
          let a4 = P ? "" : `${(function(e6, t5) {
            if (!t5.length) return 0;
            let r5 = Math.max(...t5.map((e7) => e7.height));
            return Math.ceil(Math.min(Math.max(r5, Math.max(...t5.map((e7) => e7.bottom)) - e6), r5 + 64));
          })(e5.getBoundingClientRect().top, t4)}px`;
          e5.style.getPropertyValue("--kr-ad-height") !== a4 && (a4 ? e5.style.setProperty("--kr-ad-height", a4) : e5.style.removeProperty("--kr-ad-height"));
        }
        let t3 = (e5) => !!x2.querySelector(`${e5} [data-ad-filled="true"]`), r3 = x2.querySelector(".kr-ad-leaderboard .kr-ad-placement");
        r3 && !$.current.has(r3) && $.current.set(r3, performance.now());
        let a3 = r3 && (function({ filled: e5, unavailable: t4, blocked: r4, responded: a4, elapsed: n4 }) {
          return !!e5 || !t4 && !r4 && !a4 && n4 < 3e4;
        })({ filled: t3(".kr-ad-leaderboard"), unavailable: "failed" === k || "inactive" === k, blocked: !!r3.querySelector('[data-hint-slot-inserted="blocked"]'), responded: [...r3.querySelectorAll(".mv-empty-wrapper .adunit[data-google-query-id]")].some((e5) => "none" === getComputedStyle(e5).display), elapsed: performance.now() - ($.current.get(r3) ?? 0) }), n3 = j && a3 ? Math.max(90, parseFloat(r3?.style.getPropertyValue("--kr-ad-height") || "0")) : 0, o2 = 0, h3 = 0, p3 = x2.hasAttribute("data-visual-viewport") ? window.visualViewport : null, f3 = [];
        for (let e5 of document.querySelectorAll(l)) {
          let t4 = m(e5, false);
          t4 && t4.bottom > 0 && t4.top < window.innerHeight && t4.right > 0 && t4.left < window.innerWidth && (h3 = Math.max(h3, Math.ceil(t4.height)), o2 = Math.max(o2, Math.ceil(!p3 || t4.bottom <= p3.offsetTop || t4.top >= p3.offsetTop + p3.height ? t4.height : Math.max(t4.height, p3.offsetTop + p3.height - t4.top))), f3.push(t4));
        }
        let v3 = (function(e5, t4, r4 = false, a4 = true) {
          return e5 ? Math.max(a4 ? r4 ? 150 : 90 : 0, t4) : 0;
        })(S, h3, P && M, N), y3 = `${v3}px`;
        x2.style.getPropertyValue("--kr-rail-bottom") !== y3 && x2.style.setProperty("--kr-rail-bottom", y3);
        let b3 = E && window.innerHeight - v3 >= 620;
        x2.dataset.railsFit = String(b3);
        let w3 = P || "failed" !== k && "inactive" !== k, A2 = (function({ serving: e5, viewportWidth: t4, rails: r4, measured: a4, adhesionEnabled: n4 = true, railMode: i2 = "both" }) {
          return e5 ? { top: a4.top, left: r4 ? 180 : a4.left, right: r4 && "both" === i2 ? 180 : a4.right, bottom: Math.max(n4 ? s(t4) : 0, a4.bottom) } : a4;
        })({ adhesionEnabled: N, serving: w3, viewportWidth: window.innerWidth, rails: E, railMode: _, measured: { top: n3, left: b3 && t3(".kr-ad-rail-left") ? 180 : 0, right: b3 && t3(".kr-ad-rail-right") ? 180 : 0, bottom: o2 } }), R2 = { ...C.current };
        j || (R2.top = 0), E || (R2.left = R2.right = 0), "left" === _ && (R2.right = 0), p3 && (R2.bottom = 0), N || (R2.bottom = 0);
        let L2 = (e4 = w3 && ("preview" === d2 || "answering" === d2), Object.fromEntries(Object.entries(A2).map(([t4, r4]) => [t4, e4 ? Math.max(R2[t4], r4) : r4])));
        for (let [e5, t4] of (C.current = L2, Object.entries(L2))) {
          let r4 = "bottom" === e5 && P && N ? `max(${t4}px, calc(${M ? 150 : s(window.innerWidth)}px + env(safe-area-inset-bottom, 0px)))` : `${t4}px`;
          g2.style.getPropertyValue(`--kr-ad-${e5}`) !== r4 && g2.style.setProperty(`--kr-ad-${e5}`, r4);
        }
        let I = x2.querySelector(".ds-dock"), T = parseFloat(x2.style.getPropertyValue("--kr-ad-dock-lift")) || 0, q = `${p3 ? 0 : (function(e5, t4, r4 = 0) {
          if (!e5) return 0;
          let a4 = e5.top + r4, n4 = e5.bottom + r4, i2 = 0;
          for (let r5 of [...t4].sort((e6, t5) => t5.top - e6.top)) {
            if (r5.left >= e5.right || r5.right <= e5.left || r5.top >= n4 || r5.bottom <= a4) continue;
            let t5 = Math.ceil(n4 - r5.top);
            i2 += t5, a4 -= t5, n4 -= t5;
          }
          return i2;
        })(I?.getBoundingClientRect() ?? null, f3, T)}px`;
        x2.style.getPropertyValue("--kr-ad-dock-lift") !== q && x2.style.setProperty("--kr-ad-dock-lift", q);
      };
      L.current = y2;
      let b2 = (e3 = 0, t2 = /* @__PURE__ */ new Set(), r2 = () => {
        let e4 = /* @__PURE__ */ new Set([x2, ...x2.querySelectorAll(`${i}, .adunit, .adunit iframe`), ...document.querySelectorAll(l)]);
        for (let r3 of t2) e4.has(r3) || (p2.unobserve(r3), t2.delete(r3));
        for (let r3 of e4) t2.has(r3) || (p2.observe(r3), t2.add(r3));
        y2();
      }, a2 = () => {
        e3 || (e3 = requestAnimationFrame(() => {
          e3 = 0, r2();
        }));
      }, n2 = `${i}, .kr-ad-placement`, (h2 = new MutationObserver((e4) => {
        e4.some((e5) => {
          let t3 = e5.target;
          return !!(t3 instanceof Element && (t3.closest(n2) || t3 === x2 || t3 === document.body || t3 === document.documentElement)) || [...e5.addedNodes, ...e5.removedNodes].some((e6) => e6 instanceof Element && (e6.matches(n2) || e6.querySelector(n2)));
        }) && a2();
      })).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "width", "height", "data-slot-wrapper-hidden"] }), p2 = new ResizeObserver(a2), window.addEventListener("resize", a2), f2 = window.setInterval(a2, 1e3), r2(), () => {
        h2.disconnect(), p2.disconnect(), window.removeEventListener("resize", a2), clearInterval(f2), cancelAnimationFrame(e3);
      }), w2 = window.visualViewport;
      return w2?.addEventListener("resize", y2), w2?.addEventListener("scroll", y2), () => {
        for (let e4 of (L.current = null, b2(), w2?.removeEventListener("resize", y2), w2?.removeEventListener("scroll", y2), x2.style.removeProperty("--kr-ad-dock-lift"), Object.keys(o))) g2.style.removeProperty(`--kr-ad-${e4}`);
      };
    }, [v2, S, N, j, E, _, P, M, k, d2]), (0, r.useLayoutEffect)(() => {
      if (!v2 && R.current) return "resize" === w ? (function(e3, t2 = () => {
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
      })(R.current, () => L.current?.()) : (function(e3, t2 = () => {
      }) {
        let r2, a2, n2, i2 = window.visualViewport, l2 = e3.querySelector(".ds-root");
        if (!i2 || !l2 || !window.matchMedia("(pointer: coarse)").matches) return () => {
        };
        let o2 = document.documentElement.clientHeight, s2 = document.documentElement.clientWidth, d3 = null, c2 = 0, u2 = false, m2 = (e4) => {
          c2 = e4;
          let r3 = e4 ? `0 ${-e4}px` : "";
          l2.style.getPropertyValue("--kr-game-pan") !== r3 && (r3 ? l2.style.setProperty("--kr-game-pan", r3) : l2.style.removeProperty("--kr-game-pan"), t2());
        }, h2 = () => {
          void 0 !== n2 && cancelAnimationFrame(n2), n2 = void 0;
        }, p2 = () => {
          clearTimeout(r2), h2(), u2 = false, m2(0);
        }, f2 = () => !!d3?.isConnected && document.activeElement === d3, v3 = (t3 = true) => (function(e4) {
          if (!e4.focused || e4.closedHeight - e4.height < 120 || Math.abs(e4.width / e4.closedWidth - 1) > 0.08) return 0;
          let t4 = Math.max(0, e4.pageTop - e4.scrollY) + e4.height;
          return Math.max(0, Math.ceil(e4.dockBottom + e4.appliedPan - t4 + 8));
        })({ focused: f2(), closedHeight: o2, closedWidth: s2, height: i2.height, width: i2.width, pageTop: i2.pageTop, scrollY: window.scrollY, dockBottom: (e3.querySelector(".ds-dock")?.getBoundingClientRect().bottom ?? 0) + (t3 && parseFloat(e3.style.getPropertyValue("--kr-ad-dock-lift")) || 0), appliedPan: c2 }), x2 = () => {
          if (u2 = false, !c2 && 0 === v3(false)) return;
          let e4 = d3, t3 = v3();
          if (t3 <= c2) return void m2(t3);
          let r3 = c2, a3 = performance.now(), i3 = (l3) => {
            if (n2 = void 0, d3 !== e4 || !f2()) return void p2();
            let o3 = v3();
            if (o3 < c2) return void m2(o3);
            let s3 = Math.min(1, (l3 - a3) / 160);
            m2(Math.min(o3, r3 + (t3 - r3) * (1 - (1 - s3) ** 3))), s3 < 1 && (n2 = requestAnimationFrame(i3));
          };
          h2(), n2 = requestAnimationFrame(i3);
        }, g2 = () => {
          clearTimeout(r2), r2 = setTimeout(x2, 500);
        }, y2 = (t3) => {
          t3.target instanceof HTMLInputElement && t3.target.matches(".ds-input") && e3.contains(t3.target) && (d3 = t3.target, o2 - i2.height < 120 && (o2 = i2.height, s2 = i2.width), u2 = true, g2());
        }, _2 = () => {
          if (!f2()) return void p2();
          if (Math.abs(document.documentElement.clientWidth / s2 - 1) > 0.2) {
            p2(), o2 = document.documentElement.clientHeight, s2 = document.documentElement.clientWidth;
            return;
          }
          if (c2 || void 0 !== n2) {
            let e4 = v3();
            e4 < c2 && (h2(), m2(e4));
          }
          u2 && g2();
        }, b2 = () => {
          clearTimeout(a2), a2 = setTimeout(() => {
            f2() || p2();
          }, 0);
        }, w2 = (e4) => {
          e4.touches.length > 1 && p2();
        }, A2 = () => {
          u2 = false, clearTimeout(r2), h2();
        };
        return e3.addEventListener("pointerdown", y2), e3.addEventListener("focusin", y2), e3.addEventListener("focusout", b2), e3.addEventListener("touchstart", w2, { passive: true }), e3.addEventListener("touchmove", A2, { passive: true }), i2.addEventListener("resize", _2), i2.addEventListener("scroll", _2), window.addEventListener("scroll", _2, { passive: true }), window.addEventListener("resize", _2), () => {
          p2(), clearTimeout(a2), e3.removeEventListener("pointerdown", y2), e3.removeEventListener("focusin", y2), e3.removeEventListener("focusout", b2), e3.removeEventListener("touchstart", w2), e3.removeEventListener("touchmove", A2), i2.removeEventListener("resize", _2), i2.removeEventListener("scroll", _2), window.removeEventListener("scroll", _2), window.removeEventListener("resize", _2);
        };
      })(R.current, () => L.current?.());
    }, [v2, d2, w]), v2) ? e2 : (0, t.jsxs)("div", { className: "kr-ad-layout", ref: R, children: [e2, S && E && (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("aside", { className: "kr-ad-rail kr-ad-rail-left", "aria-label": "Left advertisement", children: (0, t.jsx)(y, { slot: "sidebarBtf", sizes: "d160x600", label: "Rail \xB7 160 \xD7 600", preview: P }) }), "both" === _ && (0, t.jsx)("aside", { className: "kr-ad-rail kr-ad-rail-right", "aria-label": "Right advertisement", children: (0, t.jsx)(y, { slot: "sidebarBtf", sizes: "d160x600", label: "Rail \xB7 160 \xD7 600", preview: P }) })] }), S && P && N && (0, t.jsx)("div", { className: "kr-ad-adhesion-preview", "aria-hidden": "true", children: (0, t.jsxs)("span", { className: "kr-ad-placeholder", children: [M ? "High-impact adhesion \xB7 150px" : "Standard adhesion \xB7 reserved space", (0, t.jsx)("small", { children: "layout preview" })] }) })] });
  }], 35406);
}, 92347, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(36484);
  let a = { plankton: "var(--tier-plankton)", tooclever: "var(--tier-tooclever)", schooler: "var(--tier-schooler)", rare: "var(--tier-rare)", deepcut: "var(--tier-deepcut)", krillion: "var(--tier-krillion)", miss: "var(--tier-miss)" };
  e.s(["default", 0, function({ tier: e2, size: n = 24, glow: i = false, className: l }) {
    let o = a[e2], s = { imageRendering: "pixelated", filter: i ? `drop-shadow(0 0 ${Math.max(4, n / 4)}px ${o})` : void 0 };
    return "miss" === e2 ? (0, t.jsx)("svg", { width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: o, strokeWidth: 1.8, strokeLinecap: "round", className: l, style: i ? { filter: s.filter } : void 0, "aria-hidden": true, children: (0, t.jsx)("circle", { cx: "12", cy: "12", r: "7.5", strokeDasharray: "2.8 4" }) }) : (0, t.jsx)(r.default, { src: `/tiers/${e2}.png`, alt: "", width: n, height: n, className: l, style: s, "aria-hidden": true, draggable: false });
  }]);
}, 17335, (e) => {
  "use strict";
  var t = e.i(86062);
  async function r(e2) {
    let t2 = document.activeElement, r2 = document.createElement("textarea");
    r2.value = e2, r2.readOnly = true, r2.style.cssText = "position:fixed;left:0;top:0;opacity:0;font-size:16px;pointer-events:none", document.body.appendChild(r2);
    try {
      if (r2.select(), r2.setSelectionRange(0, e2.length), document.execCommand("copy")) return;
    } catch {
    } finally {
      r2.remove(), t2 instanceof HTMLElement && t2.focus({ preventScroll: true });
    }
    await navigator.clipboard.writeText(e2);
  }
  e.s(["buildArchiveShareText", 0, function(e2, r2, a) {
    let n = a.map((e3) => "miss" === e3 ? t.MISS_EMOJI : t.TIERS[e3].emoji).join("");
    return `Krillion \u27F2 #${e2} \u{1F990}
${r2}

${n}`;
  }, "buildShareText", 0, function(e2, r2, a) {
    let n = a.map((e3) => "miss" === e3 ? t.MISS_EMOJI : t.TIERS[e3].emoji).join("");
    return `Krillion #${e2} \u{1F990}
${r2}

${n}`;
  }, "buildUnlimitedShareText", 0, function(e2, r2, a, n = "\u221E") {
    let i = a.map((e3) => "miss" === e3 ? t.MISS_EMOJI : t.TIERS[e3].emoji).join("");
    return `Krillion ${n} #${e2} \u{1F990}
${r2}

${i}`;
  }, "copyShareText", 0, r, "withShareLink", 0, function(e2, t2 = "") {
    return `${e2}

https://krillion.io${t2}`;
  }]);
}, 72318, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(86062), a = e.i(92347);
  e.s(["default", 0, function({ results: e2, title: n = "dive log", unit: i = "m", sub: l, tick: o }) {
    return (0, t.jsxs)("div", { children: [(0, t.jsxs)("p", { className: "fathom mb-3", children: [(0, t.jsx)("span", { children: n }), (0, t.jsx)("span", { className: "fathom-depth", children: l ?? "deeper = rarer" })] }), (0, t.jsxs)("div", { className: "relative h-60", children: [[0, 0.25, 0.5, 0.75, 1].map((e3) => (0, t.jsxs)("div", { children: [(0, t.jsx)("div", { "aria-hidden": true, className: "absolute left-6 right-0 border-t border-dashed", style: { top: `${100 * e3}%`, borderColor: "var(--hairline)", opacity: 0 === e3 ? 1 : 0.5 } }), (0, t.jsx)("span", { className: "absolute left-0 font-mono-ui text-[10px] text-drift/60 tabular-nums -translate-y-1/2", style: { top: `${100 * e3}%` }, children: o ? o(e3) : 0 === e3 ? `0${i}` : `-${100 * e3}` })] }, e3)), (0, t.jsx)("div", { className: "absolute inset-y-0 left-8 right-0 grid grid-cols-7", children: e2.map((e3, n2) => {
      let i2 = e3.tier ? r.TIERS[e3.tier] : null, l2 = i2 ? i2.depth : 0.03, o2 = i2 ? i2.color : "var(--tier-miss)";
      return (0, t.jsxs)("div", { className: "relative", children: [(0, t.jsx)("div", { "aria-hidden": true, className: "absolute left-1/2 -translate-x-1/2 w-px", style: { top: 0, height: `calc(${100 * l2}% - 8px)`, background: `linear-gradient(180deg, transparent, ${o2})`, opacity: 0.45 } }), (0, t.jsx)("div", { className: "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 animate-sink", style: { top: `${100 * l2}%`, animationDelay: `${90 * n2}ms` }, title: `Round ${n2 + 1}: ${e3.answer ?? "miss"}, ${e3.score} pts`, children: (0, t.jsx)(a.default, { tier: e3.tier ?? "miss", size: 19, glow: !!i2 }) }), (0, t.jsx)("span", { className: "absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono-ui text-[11px] text-drift/70", children: n2 + 1 })] }, e3.promptId);
    }) })] }), (0, t.jsx)("div", { className: "h-5" })] });
  }]);
}, 54801, (e) => {
  "use strict";
  var t = e.i(43476), r = e.i(35406), a = e.i(71645), n = e.i(48992);
  let i = (0, a.forwardRef)(function({ phase: e2, opts: i2, onReady: l, children: o }, s) {
    let d = (0, a.useRef)(null), c = (0, a.useRef)(null), u = (0, a.useRef)(l);
    u.current = l;
    let m = (0, a.useRef)(i2);
    return (0, a.useEffect)(() => {
      if (!d.current) return;
      let e3 = (0, n.createDescentEngine)(d.current, m.current);
      return c.current = e3, u.current?.(), () => {
        e3.destroy(), c.current = null;
      };
    }, []), (0, a.useImperativeHandle)(s, () => ({ intro: (...e3) => c.current?.intro(...e3), finale: (...e3) => c.current?.finale(...e3), descendToRound: (...e3) => c.current?.descendToRound(...e3), restore: (...e3) => c.current?.restore(...e3), plunge: (...e3) => c.current?.plunge(...e3), showLanded: (...e3) => c.current?.showLanded(...e3), setUrgency: (...e3) => c.current?.setUrgency(...e3), typeFx: (...e3) => c.current?.typeFx(...e3), submitFx: (...e3) => c.current?.submitFx(...e3), rejectFx: (...e3) => c.current?.rejectFx(...e3), destroy: () => {
    } }), []), (0, t.jsx)(r.default, { phase: e2, disabled: "tour" === e2, children: (0, t.jsxs)("div", { className: "ds-root", "data-phase": e2, "data-world": m.current?.theme?.world ?? "ocean", children: [(0, t.jsx)("div", { ref: d, style: { position: "absolute", inset: 0 } }), o] }) });
  });
  e.s(["default", 0, i]);
}, 67115, (e) => {
  "use strict";
  e.s(["MAX_ANSWER_LENGTH", 0, 256]);
}, 98890, 93705, (e) => {
  "use strict";
  e.s(["ANSWER_MS", 0, 25e3, "PREVIEW_MS", 0, 3e3], 98890);
  var t = e.i(43476);
  e.s(["default", 0, function({ correction: e2 }) {
    return (0, t.jsx)("div", { id: "answer-correction", className: "ds-correction", role: "status", "aria-live": "polite", "aria-atomic": "true", children: e2 && (0, t.jsxs)("div", { className: "ds-preview-pill ds-px ds-correction-panel", children: [(0, t.jsxs)("span", { className: "ds-correction-change", children: [(0, t.jsxs)("span", { children: ["\u201C", e2.from, "\u201D"] }), (0, t.jsx)("span", { className: "ds-correction-arrow", "aria-hidden": "true", children: " \u2192 " }), (0, t.jsx)("span", { className: "sr-only", children: " corrects to " }), (0, t.jsxs)("b", { children: ["\u201C", e2.to, "\u201D"] })] }), (0, t.jsx)("span", { className: "ds-correction-hint", children: "submit again to confirm \xB7 or edit" })] }) });
  }], 93705);
}]);
