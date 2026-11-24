(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 92347, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(36484);
  let s = { plankton: "var(--tier-plankton)", tooclever: "var(--tier-tooclever)", schooler: "var(--tier-schooler)", rare: "var(--tier-rare)", deepcut: "var(--tier-deepcut)", krillion: "var(--tier-krillion)", miss: "var(--tier-miss)" };
  e.s(["default", 0, function({ tier: e2, size: l = 24, glow: n = false, className: r }) {
    let i = s[e2], o = { imageRendering: "pixelated", filter: n ? `drop-shadow(0 0 ${Math.max(4, l / 4)}px ${i})` : void 0 };
    return "miss" === e2 ? (0, t.jsx)("svg", { width: l, height: l, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: 1.8, strokeLinecap: "round", className: r, style: n ? { filter: o.filter } : void 0, "aria-hidden": true, children: (0, t.jsx)("circle", { cx: "12", cy: "12", r: "7.5", strokeDasharray: "2.8 4" }) }) : (0, t.jsx)(a.default, { src: `/tiers/${e2}.png`, alt: "", width: l, height: l, className: r, style: o, "aria-hidden": true, draggable: false });
  }]);
}, 10552, 25657, (e) => {
  "use strict";
  let t = ["mobile", "tablet", "desktop", "unknown"];
  var a = e.i(37812), s = e.i(55067), l = e.i(98284);
  async function n(e2, t2 = "calibration") {
    let a2 = await fetch(`/api/${t2}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e2), signal: AbortSignal.timeout(15e3) }), s2 = await a2.json();
    if (!a2.ok) throw Error(s2.error ?? "The test is unavailable right now.");
    return s2;
  }
  e.s(["dailyContext", 0, function(e2 = false, n2 = "calibration") {
    var r2;
    let i, o, d = (0, a.loadStats)(), c = (0, l.etDateString)(), u = d.history[c];
    return u || e2 ? { ..."answer-count" === n2 ? { playedGameKeys: [...Object.keys((0, a.loadArchiveDone)()).map((e3) => `archive:${e3}`), ...s.CLIENT_PACKS.flatMap((e3) => Object.keys((0, a.loadPackDone)(e3.id)).map((t2) => `${e3.id}:${t2}`))].slice(0, 3e3) } : {}, dailyDate: c, dailyScore: u?.score ?? 0, dailyImported: u?.imported ?? !u, playedDailyDates: Object.keys(d.history).filter((e3) => e3 <= c), device: (r2 = { type: (function(e3, t2 = "", a2 = 0) {
      return /iPad|Tablet|PlayBook|Silk/i.test(e3) || "MacIntel" === t2 && a2 > 1 ? "tablet" : /Android/i.test(e3) ? /Mobile/i.test(e3) ? "mobile" : "tablet" : /iPhone|iPod|Windows Phone|IEMobile|Mobi/i.test(e3) ? "mobile" : /Windows|Macintosh|Mac OS|Linux|CrOS/i.test(e3) ? "desktop" : "unknown";
    })(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), screenWidth: window.screen.width, viewportWidth: window.innerWidth }, i = r2, o = (e3) => "number" == typeof e3 && Number.isInteger(e3) && e3 > 0 && e3 <= 32768 ? e3 : null, { type: t.includes(i.type) ? i.type : "unknown", screenWidth: o(i.screenWidth), viewportWidth: o(i.viewportWidth) }) } : null;
  }, "request", 0, n], 10552);
  var r = e.i(71645);
  e.s(["useCollectionWindow", 0, function() {
    let [e2, t2] = (0, r.useState)(false), [a2, s2] = (0, r.useState)(false), [l2, n2] = (0, r.useState)(true), i = (0, r.useRef)(true), o = (0, r.useRef)(null), d = (0, r.useCallback)((e3) => {
      o.current = null == e3.closesAt ? null : performance.now() + e3.closesAt - (e3.serverNow ?? Date.now()), void 0 !== e3.deviceEligible && (i.current = e3.deviceEligible, n2(e3.deviceEligible)), t2(true === e3.accepting && i.current), s2(true);
    }, []);
    return (0, r.useEffect)(() => {
      let e3 = () => {
        null !== o.current && performance.now() >= o.current && t2(false);
      }, a3 = setInterval(e3, 1e3);
      return document.addEventListener("visibilitychange", e3), () => {
        clearInterval(a3), document.removeEventListener("visibilitychange", e3);
      };
    }, []), { accepting: e2, checked: a2, deviceEligible: l2, syncWindow: d };
  }], 25657);
}, 67471, (e) => {
  e.v({ actions: "game-module__Ip5tNa__actions", answer: "game-module__Ip5tNa__answer", bubble: "game-module__Ip5tNa__bubble", card: "game-module__Ip5tNa__card", "card-in": "game-module__Ip5tNa__card-in", catch: "game-module__Ip5tNa__catch", "catch-in": "game-module__Ip5tNa__catch-in", catches: "game-module__Ip5tNa__catches", comparison: "game-module__Ip5tNa__comparison", copy: "game-module__Ip5tNa__copy", cta: "game-module__Ip5tNa__cta", cur: "game-module__Ip5tNa__cur", dock: "game-module__Ip5tNa__dock", dockFoot: "game-module__Ip5tNa__dockFoot", done: "game-module__Ip5tNa__done", "dot-pulse": "game-module__Ip5tNa__dot-pulse", dots: "game-module__Ip5tNa__dots", endEarly: "game-module__Ip5tNa__endEarly", equalCatch: "game-module__Ip5tNa__equalCatch", error: "game-module__Ip5tNa__error", familiar: "game-module__Ip5tNa__familiar", feedback: "game-module__Ip5tNa__feedback", float: "game-module__Ip5tNa__float", fuse: "game-module__Ip5tNa__fuse", hint: "game-module__Ip5tNa__hint", hot: "game-module__Ip5tNa__hot", hud: "game-module__Ip5tNa__hud", input: "game-module__Ip5tNa__input", inputCol: "game-module__Ip5tNa__inputCol", label: "game-module__Ip5tNa__label", miss: "game-module__Ip5tNa__miss", note: "game-module__Ip5tNa__note", num: "game-module__Ip5tNa__num", ocean: "game-module__Ip5tNa__ocean", pod: "game-module__Ip5tNa__pod", preview: "game-module__Ip5tNa__preview", prompt: "game-module__Ip5tNa__prompt", pt: "game-module__Ip5tNa__pt", result: "game-module__Ip5tNa__result", resultBlock: "game-module__Ip5tNa__resultBlock", resultLabel: "game-module__Ip5tNa__resultLabel", resultTitle: "game-module__Ip5tNa__resultTitle", rise: "game-module__Ip5tNa__rise", rnd: "game-module__Ip5tNa__rnd", rules: "game-module__Ip5tNa__rules", scorePod: "game-module__Ip5tNa__scorePod", section: "game-module__Ip5tNa__section", shell: "game-module__Ip5tNa__shell", sub: "game-module__Ip5tNa__sub", title: "game-module__Ip5tNa__title", wide: "game-module__Ip5tNa__wide" });
}, 28081, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(71645), s = e.i(22016), l = e.i(92347);
  function n({ totalMs: e2, remainingMs: a2, size: s2 = 72, numeral: l2 = true }) {
    let r2 = Math.max(0, Math.min(1, a2 / e2)), i2 = Math.ceil(a2 / 1e3), o2 = a2 <= 5e3 && e2 > 5e3, d2 = o2 ? "#ff5d8f" : "#4de3ff", c2 = 360 * r2;
    return (0, t.jsxs)("div", { className: "relative inline-flex items-center justify-center", style: { width: s2, height: s2 }, role: "timer", "aria-label": `${i2} seconds left`, children: [(0, t.jsx)("div", { className: "absolute inset-[3px] rounded-full", style: { background: `conic-gradient(from 0deg, ${d2}2e 0deg, ${d2}14 ${c2}deg, transparent ${c2}deg)` } }), (0, t.jsx)("div", { className: "absolute inset-[3px]", style: { transform: `rotate(${c2}deg)` }, children: (0, t.jsx)("div", { className: "absolute left-1/2 top-0 w-px", style: { height: "50%", background: `linear-gradient(180deg, ${d2}, transparent 85%)`, boxShadow: o2 ? `0 0 6px ${d2}` : "none" } }) }), (0, t.jsxs)("svg", { width: s2, height: s2, viewBox: "0 0 100 100", className: "absolute inset-0", children: [(0, t.jsx)("circle", { cx: "50", cy: "50", r: "47", fill: "none", stroke: "var(--hairline)", strokeWidth: "1.5" }), (0, t.jsx)("circle", { cx: "50", cy: "50", r: "30", fill: "none", stroke: "var(--hairline)", strokeWidth: "1", strokeDasharray: "2.5 5" }), (0, t.jsx)("line", { x1: "50", y1: "3", x2: "50", y2: "13", stroke: "var(--hairline)", strokeWidth: "1" }), (0, t.jsx)("line", { x1: "50", y1: "87", x2: "50", y2: "97", stroke: "var(--hairline)", strokeWidth: "1" }), (0, t.jsx)("line", { x1: "3", y1: "50", x2: "13", y2: "50", stroke: "var(--hairline)", strokeWidth: "1" }), (0, t.jsx)("line", { x1: "87", y1: "50", x2: "97", y2: "50", stroke: "var(--hairline)", strokeWidth: "1" })] }), l2 && (0, t.jsx)("span", { className: `relative font-mono-ui tabular-nums ${o2 ? "animate-glow-pulse" : ""}`, style: { fontSize: 0.3 * s2, color: o2 ? d2 : "#e8f1ff" }, children: i2 })] });
  }
  var r = e.i(86062), i = e.i(10552), o = e.i(39233), d = e.i(12260), c = e.i(67471), u = e.i(25657);
  e.s(["default", 0, function({ preview: e2, experiment: h = "calibration" }) {
    var m;
    let p = "answer-count" === h, f = (0, a.useCallback)((e3) => (0, i.request)(e3, h), [h]), [_, x] = (0, a.useState)(null), [g, N] = (0, a.useState)(false), [y, b] = (0, a.useState)(false), { accepting: j, checked: v, deviceEligible: w, syncWindow: I } = (0, u.useCollectionWindow)(), [k, $] = (0, a.useState)(false), [S, T] = (0, a.useState)(false), [C, E] = (0, a.useState)(""), [W, M] = (0, a.useState)(""), [P, R] = (0, a.useState)(""), [A, L] = (0, a.useState)(60), O = (0, a.useRef)(null), q = (0, a.useRef)(null), D = (0, a.useRef)(false), B = (0, a.useRef)(null), F = (0, a.useRef)(0), K = (0, a.useRef)(false), Y = (0, a.useRef)(0);
    function z(e3) {
      e3 && (q.current = e3, x(e3), F.current = performance.now() + Math.max(0, e3.endsAt - e3.serverNow), L(Math.max(0, Math.ceil((e3.endsAt - e3.serverNow) / 1e3))));
    }
    async function U() {
      if (D.current || !j) return;
      let t2 = (0, i.dailyContext)(e2, h);
      if (!t2) return void E("Finish today\u2019s daily to join the test.");
      D.current = true, T(true), E("");
      try {
        let e3 = await f({ action: "start", context: t2 });
        z(e3.run), M(""), R(""), O.current = null, $(false), (0, o.track)(`${h.replaceAll("-", "_")}_round_start`, { round: e3.run?.slot ?? 0 }), setTimeout(() => B.current?.focus(), 0);
      } catch (e3) {
        E(e3.message);
      } finally {
        D.current = false, T(false);
      }
    }
    async function G(e3) {
      if (e3.preventDefault(), D.current || !_ || !W.trim() || A <= 0) return;
      D.current = true, T(true), E("");
      let t2 = O.current ?? { answer: W.trim(), requestId: crypto.randomUUID() };
      O.current = t2, $(true);
      try {
        let e4 = await f({ action: "submit", runId: _.id, ...t2 });
        z(e4.run);
        let a2 = e4.run?.guesses.find((e5) => e5.requestId === t2.requestId);
        R(a2?.status === "accepted" ? `${a2.answer} \xB7 +${a2.points}` : a2?.status === "duplicate" ? "Already caught that one." : a2 ? "Not found." : "Time\u2019s up!"), O.current = null, $(false), a2 && ("rejected" !== a2.status || (0, d.shouldClearRejectedEntry)()) && M("");
      } catch (e4) {
        E(e4.message + " Your guess is kept\u2014tap Retry.");
      } finally {
        D.current = false, T(false), B.current?.focus();
      }
    }
    async function J() {
      if (_ && !D.current) {
        D.current = true, T(true);
        try {
          z((await f({ action: "quit", runId: _.id })).run), E("");
        } catch (e3) {
          E(e3.message);
        } finally {
          D.current = false, T(false);
        }
      }
    }
    async function H(e3) {
      if (_ && !D.current) {
        D.current = true, T(true);
        try {
          z((await f({ action: "exposure", runId: _.id, value: e3 })).run), E("");
        } catch (e4) {
          E(e4.message);
        } finally {
          D.current = false, T(false);
        }
      }
    }
    (0, a.useEffect)(() => {
      let t2 = true;
      return f({ action: "offer", context: (0, i.dailyContext)(e2, h) }).then(async (e3) => {
        if (t2 && (I(e3), b(!!e3.eligible), e3.eligible)) {
          let e4 = await f({ action: "status" });
          t2 && (I(e4), z(e4.run));
        }
      }).catch((e3) => {
        t2 && E(e3.message);
      }).finally(() => {
        t2 && N(true);
      }), () => {
        t2 = false;
      };
    }, [e2, h, f, I]), (0, a.useEffect)(() => {
      if (_?.status !== "active") return;
      let e3 = setInterval(() => {
        let e4 = Math.max(0, Math.ceil((F.current - performance.now()) / 1e3));
        L(e4), 0 === e4 && !K.current && !D.current && performance.now() >= Y.current && (K.current = true, f({ action: "finish", runId: _.id }).then((e5) => {
          z(e5.run), E(""), (0, o.track)(`${h.replaceAll("-", "_")}_round_complete`, { round: _.slot });
        }).catch((e5) => {
          E(e5.message), Y.current = performance.now() + 3e3;
        }).finally(() => {
          K.current = false;
        }));
      }, 250);
      return () => clearInterval(e3);
    }, [_?.id, _?.status, _?.slot, f, h]), (0, a.useEffect)(() => {
      let e3 = () => {
        let e4 = q.current;
        document.hidden && e4?.status === "active" && fetch(`/api/${h}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hidden", runId: e4.id }), keepalive: true }).catch(() => {
        });
      };
      return document.addEventListener("visibilitychange", e3), () => document.removeEventListener("visibilitychange", e3);
    }, [h]);
    let Q = _?.status === "active", V = _?.guesses.filter((e3) => "accepted" === e3.status) ?? [], X = Q && A <= 5, Z = _?.status === "complete" ? (m = _.promptStanding) ? null === m.percentile ? "More players need to finish this prompt before we can compare scores." : `You scored higher than ${m.percentile}% of players on this prompt.` : "Player comparison isn\u2019t available right now." : null;
    return (0, t.jsxs)("main", { className: "hub-root", children: [(0, t.jsx)("div", { className: "hub-crt", "aria-hidden": true }), (0, t.jsxs)("div", { className: `hub-inner ${c.default.shell}`, children: [(0, t.jsxs)("header", { children: [(0, t.jsx)("p", { className: "hub-wordmark font-display", children: "KRILLION" }), (0, t.jsx)("p", { className: "hub-sub", children: "test dive \xB7 beta" })] }), e2 && (0, t.jsx)("p", { className: c.default.preview, children: "local preview \xB7 test data only" }), (!g || !y || !_) && (0, t.jsxs)("div", { className: c.default.ocean, "aria-hidden": "true", children: [(0, t.jsx)("span", { className: c.default.bubble }), (0, t.jsx)("span", { className: c.default.bubble }), (0, t.jsx)("span", { className: c.default.bubble }), (0, t.jsx)(l.default, { tier: "krillion", size: 64 })] }), g ? !v || j || _ ? y ? _ ? (0, t.jsxs)("section", { className: c.default.section, children: [(0, t.jsxs)("div", { className: c.default.hud, children: [(0, t.jsxs)("div", { className: c.default.pod, children: [(0, t.jsx)("span", { className: c.default.label, children: "round" }), (0, t.jsxs)("span", { className: c.default.num, children: [_.slot, (0, t.jsxs)("small", { children: ["/", 10] })] })] }), (0, t.jsx)("div", { className: c.default.dots, "aria-hidden": "true", children: Array.from({ length: 10 }, (e3, a2) => (0, t.jsx)("i", { className: a2 + 1 < _.slot ? c.default.done : a2 + 1 === _.slot ? c.default.cur : void 0 }, a2)) }), (0, t.jsxs)("div", { className: `${c.default.pod} ${c.default.scorePod}`, children: [(0, t.jsx)("span", { className: c.default.label, children: "points" }), (0, t.jsx)("span", { className: c.default.num, children: _.score })] })] }), (0, t.jsxs)("div", { className: c.default.card, children: [(0, t.jsx)("p", { className: c.default.rnd, children: Q ? "60 seconds \xB7 go" : "complete" === _.status ? "time\u2019s up" : "round ended" }), (0, t.jsx)("h1", { className: c.default.prompt, children: _.prompt }), (0, t.jsx)("p", { className: c.default.hint, children: Q ? p ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { className: c.default.pt, children: "+1" }), " every different answer"] }) : "every different answer counts" : `${V.length} different answer${1 === V.length ? "" : "s"} landed` })] }), Q ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsxs)("form", { onSubmit: G, className: `${c.default.dock}${X ? ` ${c.default.hot}` : ""}`, children: [(0, t.jsx)(n, { totalMs: 6e4, remainingMs: 1e3 * A, size: 58 }), (0, t.jsxs)("div", { className: c.default.inputCol, children: [(0, t.jsx)("label", { htmlFor: "test-answer", className: "sr-only", children: "Your answer" }), (0, t.jsx)("input", { id: "test-answer", ref: B, className: c.default.input, value: W, maxLength: 100, autoComplete: "off", autoCorrect: "off", spellCheck: false, readOnly: k, disabled: 0 === A, onChange: (e3) => M(e3.target.value), placeholder: "Name another\u2026" }), (0, t.jsx)("div", { className: c.default.fuse, role: "progressbar", "aria-label": "Time remaining", "aria-valuenow": A, "aria-valuemin": 0, "aria-valuemax": 60, children: (0, t.jsx)("div", { style: { width: `${A / 60 * 100}%` } }) })] }), (0, t.jsx)("button", { className: `btn-descend ${c.default.catch}`, disabled: S || 0 === A || !W.trim(), children: S ? "\u2026" : k ? "Retry" : "Catch \u2192" })] }), (0, t.jsxs)("div", { className: c.default.dockFoot, children: [(0, t.jsx)("p", { className: `${c.default.feedback}${P && !/\+\d/.test(P) ? ` ${c.default.miss}` : ""}`, "aria-live": "polite", children: P }), (0, t.jsx)("button", { className: `btn-quiet ${c.default.endEarly}`, disabled: S, onClick: J, children: "End this round early" })] })] }) : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsxs)("div", { className: c.default.resultBlock, children: [(0, t.jsx)("p", { className: c.default.resultLabel, children: p ? "points this round" : "round score" }), (0, t.jsxs)("div", { className: c.default.result, children: [(0, t.jsx)("span", { className: c.default.num, children: _.score }), (0, t.jsx)("span", { className: c.default.sub, children: p ? "1 per different answer" : `${V.length} different answer${1 === V.length ? "" : "s"}` })] }), (0, t.jsx)("h2", { className: c.default.resultTitle, children: "complete" === _.status ? "That\u2019s your catch." : "Thanks for giving it a go." })] }), Z && (0, t.jsxs)("div", { className: c.default.comparison, children: [(0, t.jsx)("p", { children: Z }), _.promptStanding?.percentile != null && (0, t.jsxs)("p", { className: c.default.note, children: ["Based on ", _.promptStanding.sample.toLocaleString(), " other players who completed this prompt. Tied scores aren\u2019t counted as beaten."] })] }), (0, t.jsxs)("fieldset", { className: c.default.familiar, children: [(0, t.jsx)("legend", { className: "fathom", children: (0, t.jsx)("span", { children: "had you seen this prompt before?" }) }), ["no", "yes", "unknown"].map((e3) => (0, t.jsx)("button", { type: "button", className: "btn-quiet", "aria-pressed": _.exposure === e3, disabled: S, onClick: () => H(e3), children: "no" === e3 ? "No" : "yes" === e3 ? "Yes" : "Not sure" }, e3))] }), (0, t.jsxs)("div", { className: c.default.actions, children: [j && _.slot < 10 && (0, t.jsx)("button", { className: "btn-descend", disabled: S, onClick: U, children: S ? "Getting ready\u2026" : "Try another prompt \u2192" }), (0, t.jsx)(s.default, { href: "/", className: "btn-quiet", children: _.slot >= 10 ? "All done \xB7 back to Krillion" : "Done for now" })] }), (0, t.jsx)("p", { className: c.default.note, children: w ? j ? _.slot >= 10 ? "That\u2019s all 10 for today. Thanks for helping us build this." : "Every round helps. You can stop here or keep going." : "The three-day test has ended. Thanks for helping us build this." : "Continue the test on your phone or tablet." })] }), V.length > 0 && (0, t.jsxs)("div", { children: [(0, t.jsxs)("p", { className: "fathom mb-1", children: [(0, t.jsx)("span", { children: "the catch" }), (0, t.jsxs)("span", { className: "fathom-depth", children: [V.length, " landed"] })] }), (0, t.jsx)("ul", { className: c.default.catches, children: V.slice().reverse().map((e3, a2) => (0, t.jsxs)("li", { children: [p ? (0, t.jsx)("span", { className: c.default.equalCatch, "aria-hidden": true, children: String(V.length - a2).padStart(2, "0") }) : (0, t.jsx)(l.default, { tier: e3.tier, size: 19 }), (0, t.jsx)("span", { className: c.default.answer, children: e3.answer }), (0, t.jsxs)("strong", { style: { color: p ? "var(--color-foam)" : r.TIERS[e3.tier].color }, children: ["+", e3.points] })] }, e3.requestId)) })] })] }) : (0, t.jsxs)("section", { className: `hub-panel ${c.default.section}`, children: [(0, t.jsx)("p", { className: "fathom", children: (0, t.jsx)("span", { children: "help shape the next dive" }) }), (0, t.jsx)("h1", { className: c.default.title, children: "How many can you name?" }), (0, t.jsxs)("ul", { className: c.default.rules, children: [(0, t.jsxs)("li", { children: [(0, t.jsx)("b", { children: "60s" }), (0, t.jsx)("span", { children: "one prompt, one minute" })] }), (0, t.jsxs)("li", { children: [(0, t.jsx)("b", { children: p ? "+1" : "+pts" }), (0, t.jsx)("span", { children: p ? "every different answer" : "rarer answers earn more" })] }), (0, t.jsxs)("li", { children: [(0, t.jsx)("b", { children: 10 }), (0, t.jsx)("span", { children: "rounds a day, at most" })] })] }), (0, t.jsxs)("p", { className: c.default.copy, children: ["You have 60 seconds to name as many different answers as you can. ", p ? "Every different answer earns 1 point. All answers count the same." : "Every catch adds points. Rarer answers earn more."] }), (0, t.jsxs)("p", { className: c.default.copy, children: ["Play one round, or up to ", 10, " today. Keep going for the full minute, even if you\u2019re doing well."] }), (0, t.jsx)("button", { className: `btn-descend ${c.default.cta} ${c.default.wide}`, disabled: S, onClick: U, children: S ? "Getting ready\u2026" : "Start a test round \u2192" }), (0, t.jsx)("p", { className: c.default.note, children: "We save your guesses, timing and play history to help improve Krillion. Your daily score and streak aren\u2019t affected." })] }) : (0, t.jsxs)("section", { className: `hub-panel ${c.default.section}`, children: [(0, t.jsx)("p", { className: "fathom", children: (0, t.jsx)("span", { children: "not open yet" }) }), (0, t.jsx)("h1", { className: c.default.title, children: "Thanks for stopping by." }), (0, t.jsx)("p", { className: c.default.copy, children: "Finish today\u2019s daily to see whether this test is available to you." }), (0, t.jsx)(s.default, { href: "/", className: `btn-descend ${c.default.cta}`, children: "Play the daily \u2192" })] }) : (0, t.jsxs)("section", { className: `hub-panel ${c.default.section}`, children: [(0, t.jsx)("p", { className: "fathom", children: (0, t.jsx)("span", { children: "test dive" }) }), (0, t.jsx)("h1", { className: c.default.title, children: w ? "The test isn\u2019t open right now." : "Take this dive on mobile." }), (0, t.jsx)("p", { className: c.default.copy, children: w ? "This is a three-day test. Thanks to everyone who helped us shape the next dive." : "We\u2019re testing how this mode plays on phones and tablets. Open Krillion on your mobile device to join." }), (0, t.jsx)(s.default, { href: "/", className: `btn-descend ${c.default.cta}`, children: "Back to the daily \u2192" })] }) : (0, t.jsx)("p", { className: "hub-charting", children: "finding your test dive\u2026" }), C && (0, t.jsx)("p", { role: "alert", className: c.default.error, children: C }), (0, t.jsx)("div", { className: "flex justify-center", children: (0, t.jsx)(s.default, { href: "/", prefetch: false, className: "hub-back", children: "\u2190 today\u2019s dive" }) })] })] });
  }], 28081);
}]);
