(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 10552, 25657, (e) => {
  "use strict";
  let t = ["mobile", "tablet", "desktop", "unknown"];
  var n = e.i(37812), r = e.i(55067), a = e.i(98284);
  async function s(e2, t2 = "calibration") {
    let n2 = await fetch(`/api/${t2}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e2), signal: AbortSignal.timeout(15e3) }), r2 = await n2.json();
    if (!n2.ok) throw Error(r2.error ?? "The test is unavailable right now.");
    return r2;
  }
  e.s(["dailyContext", 0, function(e2 = false, s2 = "calibration") {
    var i2;
    let l, d, o = (0, n.loadStats)(), u = (0, a.etDateString)(), c = o.history[u];
    return c || e2 ? { ..."answer-count" === s2 ? { playedGameKeys: [...Object.keys((0, n.loadArchiveDone)()).map((e3) => `archive:${e3}`), ...r.CLIENT_PACKS.flatMap((e3) => Object.keys((0, n.loadPackDone)(e3.id)).map((t2) => `${e3.id}:${t2}`))].slice(0, 3e3) } : {}, dailyDate: u, dailyScore: c?.score ?? 0, dailyImported: c?.imported ?? !c, playedDailyDates: Object.keys(o.history).filter((e3) => e3 <= u), device: (i2 = { type: (function(e3, t2 = "", n2 = 0) {
      return /iPad|Tablet|PlayBook|Silk/i.test(e3) || "MacIntel" === t2 && n2 > 1 ? "tablet" : /Android/i.test(e3) ? /Mobile/i.test(e3) ? "mobile" : "tablet" : /iPhone|iPod|Windows Phone|IEMobile|Mobi/i.test(e3) ? "mobile" : /Windows|Macintosh|Mac OS|Linux|CrOS/i.test(e3) ? "desktop" : "unknown";
    })(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), screenWidth: window.screen.width, viewportWidth: window.innerWidth }, l = i2, d = (e3) => "number" == typeof e3 && Number.isInteger(e3) && e3 > 0 && e3 <= 32768 ? e3 : null, { type: t.includes(l.type) ? l.type : "unknown", screenWidth: d(l.screenWidth), viewportWidth: d(l.viewportWidth) }) } : null;
  }, "request", 0, s], 10552);
  var i = e.i(71645);
  e.s(["useCollectionWindow", 0, function() {
    let [e2, t2] = (0, i.useState)(false), [n2, r2] = (0, i.useState)(false), [a2, s2] = (0, i.useState)(true), l = (0, i.useRef)(true), d = (0, i.useRef)(null), o = (0, i.useCallback)((e3) => {
      d.current = null == e3.closesAt ? null : performance.now() + e3.closesAt - (e3.serverNow ?? Date.now()), void 0 !== e3.deviceEligible && (l.current = e3.deviceEligible, s2(e3.deviceEligible)), t2(true === e3.accepting && l.current), r2(true);
    }, []);
    return (0, i.useEffect)(() => {
      let e3 = () => {
        null !== d.current && performance.now() >= d.current && t2(false);
      }, n3 = setInterval(e3, 1e3);
      return document.addEventListener("visibilitychange", e3), () => {
        clearInterval(n3), document.removeEventListener("visibilitychange", e3);
      };
    }, []), { accepting: e2, checked: n2, deviceEligible: a2, syncWindow: o };
  }], 25657);
}, 31408, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(71645), r = e.i(37812), a = e.i(39233);
  let s = [1, 2, 3, 4, 5], i = (e2) => `krillion-feedback:${e2}`, l = /* @__PURE__ */ new Set();
  function d(e2) {
    return l.add(e2), window.addEventListener("storage", e2), () => {
      l.delete(e2), window.removeEventListener("storage", e2);
    };
  }
  let o = () => null;
  e.s(["default", 0, function({ game: e2, score: u, prompt: c = "how was that dive? 1 = meh \xB7 5 = great", scaleLabels: p, notesPlaceholder: h = "the third prompt was way too narrow\u2026", preview: m = false }) {
    let f = (0, n.useId)(), w = (function(e3) {
      if (!e3) return null;
      try {
        let t2 = JSON.parse(e3);
        return "number" == typeof t2.rating ? { rating: t2.rating, noted: !!t2.noted } : null;
      } catch {
        return null;
      }
    })((0, n.useSyncExternalStore)(d, () => m ? null : (function(e3) {
      try {
        return window.localStorage.getItem(i(e3));
      } catch {
        return null;
      }
    })(e2), o)), [g, x] = (0, n.useState)(null), b = m ? g : w, [v, y] = (0, n.useState)(null), [E, N] = (0, n.useState)(""), [j, A] = (0, n.useState)("idle"), S = v ?? b?.rating ?? null, k = b?.noted ?? false;
    function I(t2) {
      if (m) x(t2);
      else {
        try {
          window.localStorage.setItem(i(e2), JSON.stringify(t2));
        } catch {
        }
        l.forEach((e3) => e3());
      }
    }
    async function R(t2, n2) {
      if (m) return true;
      try {
        let a2 = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: (0, r.getPlayerId)(), game: e2, rating: t2, score: u, ...n2 ? { notes: n2 } : {} }) }), s2 = await a2.json();
        return !!s2.ok || "throttled" === s2.reason;
      } catch {
        return false;
      }
    }
    async function D(t2) {
      "sending" === j || k || (y(t2), A("sending"), await R(t2) ? (m || (0, a.track)("game_rated", { rating: t2, mode: e2.split(":")[0] }), I({ rating: t2, noted: false }), A("idle")) : A("error"));
    }
    async function C(t2) {
      t2.preventDefault();
      let n2 = E.trim();
      null === S || n2.length < 2 || "sending" === j || (A("sending"), await R(S, n2) ? (m || (0, a.track)("game_feedback_noted", { rating: S, mode: e2.split(":")[0] }), I({ rating: S, noted: true }), A("idle")) : A("error"));
    }
    return (0, t.jsxs)("div", { className: "flex flex-col gap-1.5", children: [(0, t.jsx)("p", { id: `${f}-rating-label`, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: k ? m ? "preview only \u2014 nothing was sent." : "logged \u2014 thanks for the note." : c }), (0, t.jsxs)("div", { className: "feedback-scale", children: [(0, t.jsx)("div", { role: "radiogroup", "aria-labelledby": `${f}-rating-label`, className: "flex items-center gap-2", children: s.map((e3) => (0, t.jsx)("button", { type: "button", role: "radio", "aria-checked": S === e3, "aria-label": `${e3} out of 5`, disabled: k || "sending" === j, onClick: () => D(e3), className: "font-mono-ui text-[14px] tabular-nums min-w-9 h-9 border border-drift/40 text-drift hover:text-lumen-cyan hover:border-lumen-cyan aria-checked:text-lumen-cyan aria-checked:border-lumen-cyan aria-checked:bg-lumen-cyan/10 disabled:cursor-default disabled:hover:text-drift disabled:hover:border-drift/40 aria-checked:disabled:text-lumen-cyan aria-checked:disabled:border-lumen-cyan", children: e3 }, e3)) }), p && (0, t.jsxs)("div", { className: "feedback-scale-labels", children: [(0, t.jsx)("span", { children: p[0] }), (0, t.jsx)("span", { children: p[1] })] })] }), null !== S && !k && (0, t.jsxs)("form", { onSubmit: C, className: "flex flex-col gap-1.5", children: [(0, t.jsx)("label", { htmlFor: `${f}-notes`, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: "any notes? what worked, what didn't" }), (0, t.jsxs)("div", { className: "flex items-baseline gap-3 max-w-sm", children: [(0, t.jsx)("input", { id: `${f}-notes`, value: E, onChange: (e3) => {
      N(e3.target.value), "error" === j && A("idle");
    }, maxLength: 500, placeholder: h, className: "flex-1 min-w-0 bg-transparent border-b border-drift/40 focus:border-lumen-cyan outline-none font-mono-ui text-[13px] text-foam placeholder:text-drift/40 py-1" }), (0, t.jsx)("button", { type: "submit", disabled: E.trim().length < 2 || "sending" === j, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase underline text-drift hover:text-lumen-cyan disabled:opacity-40 disabled:no-underline", children: "sending" === j ? "sending\u2026" : "submit" })] })] }), "error" === j && (0, t.jsx)("p", { className: "font-mono-ui text-[11px] tracking-[0.12em] uppercase text-lumen-pink/80", children: "couldn't send \u2014 try again in a moment." })] });
  }]);
}, 939, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(22016);
  e.s(["default", 0, function({ prompt: e2 = "found a bug? lost an unlock?" }) {
    return (0, t.jsxs)("p", { className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: [e2, " ", (0, t.jsx)("a", { href: "mailto:support@krillion.io", className: "underline text-drift hover:text-lumen-cyan", children: "contact us" }), " \xB7 ", (0, t.jsx)("a", { href: "mailto:business@krillion.io", className: "underline hover:text-lumen-cyan", children: "business inquiries" }), " \xB7 ", (0, t.jsx)("a", { href: "https://www.instagram.com/youareoneinakrillion/", target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-lumen-cyan", children: "instagram" }), " \xB7 ", (0, t.jsx)(n.default, { href: "/privacy", prefetch: false, className: "underline hover:text-lumen-cyan", children: "privacy" })] });
  }]);
}, 41341, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(36484), r = e.i(71645), a = e.i(17747), s = e.i(95219), i = e.i(67334), l = e.i(61194), d = e.i(87588), o = e.i(86062), u = e.i(67115), c = e.i(37812), p = e.i(98890), h = e.i(27305), m = e.i(84822), f = e.i(39233), w = e.i(54801), g = e.i(48992), x = e.i(66732), b = e.i(12260), v = e.i(23644), y = e.i(28631), E = e.i(93705);
  function N(e2, t2, n2, r2) {
    return { promptId: e2.id, promptText: e2.text, rawAnswer: t2, answer: null, tier: null, score: 0, ...r2 ? { quip: r2 } : {}, ...n2 ? { receipt: n2 } : {} };
  }
  e.s(["default", 0, function() {
    let [e2, j] = (0, r.useState)(null), [A, S] = (0, r.useState)(0), [k, I] = (0, r.useState)(null), [R, D] = (0, r.useState)(null), [C, T] = (0, r.useState)(null), [O, P] = (0, r.useState)(() => Date.now()), [M, _] = (0, r.useState)(""), [W, L] = (0, r.useState)(null), [$, F] = (0, r.useState)(null), [U, K] = (0, r.useState)(false), [q, G] = (0, r.useState)(0), [B, Y] = (0, r.useState)(false), [J, H] = (0, r.useState)(0), z = (0, r.useRef)(null), V = (0, r.useRef)(false), X = (0, r.useRef)(0), Z = (0, r.useRef)(""), Q = (0, r.useRef)(null), ee = (0, r.useRef)(null), et = (0, r.useRef)({ restored: false, round: -1, plunged: 0 }), [en, er] = (0, r.useState)(0), ea = (0, r.useCallback)(() => {
      et.current = { restored: false, round: -1, plunged: 0 }, er((e3) => e3 + 1);
    }, []), es = (0, r.useCallback)((e3) => {
      z.current = e3, D(e3), "done" !== e3.phase && (0, c.saveGame)(e3);
    }, []);
    (0, r.useEffect)(() => {
      let e3 = () => {
        if (!z.current) return;
        T((0, c.loadStats)());
        let e4 = z.current?.phase;
        ("intro" === e4 || "done" === e4) && (et.current = { restored: false, round: -1, plunged: 0 }, S((e5) => e5 + 1));
      };
      return window.addEventListener(s.PROGRESS_DOWNLOADED, e3), () => window.removeEventListener(s.PROGRESS_DOWNLOADED, e3);
    }, []), (0, r.useEffect)(() => {
      Z.current = (0, c.getPlayerId)();
      let e3 = new URLSearchParams(window.location.search).get("preview"), t2 = e3 ? `/api/today?preview=${encodeURIComponent(e3)}` : "/api/today", n2 = (0, i.waitForAccountHistory)(), r2 = false;
      return fetch(t2).then(async (e4) => {
        if (!e4.ok) {
          let t3 = await e4.json().catch(() => null);
          throw Error(t3?.error ?? "Couldn't load today's puzzle");
        }
        return e4.json();
      }).then(async (e4) => {
        var t3, s2;
        let i2;
        if (await n2, r2) return;
        j(e4), (0, c.voidOutageZeroDay)(e4.date);
        let l2 = (0, c.loadStats)();
        T(l2);
        let u2 = l2.history[e4.date];
        if (u2) {
          let t4 = { runId: u2.runId, date: e4.date, dayNumber: e4.dayNumber, roundIndex: o.ROUNDS_PER_DAY - 1, phase: "done", previewEndsAt: null, answerEndsAt: null, results: u2.results };
          z.current = t4, D(t4);
          return;
        }
        let h2 = { runId: (0, a.createCompletionRunId)(), date: e4.date, dayNumber: e4.dayNumber, roundIndex: 0, phase: "intro", previewEndsAt: null, answerEndsAt: null, results: [] }, m2 = (t3 = (0, c.loadGame)(e4.date) ?? h2, s2 = Date.now(), "preview" === (i2 = { ...(0, d.resumeDive)(t3, s2), results: [...t3.results] }).phase && null !== i2.previewEndsAt && s2 >= i2.previewEndsAt && (i2.phase = "answering", i2.answerEndsAt = i2.previewEndsAt + p.ANSWER_MS), "answering" === i2.phase && null !== i2.answerEndsAt && s2 >= i2.answerEndsAt && (i2.results.push(N(e4.prompts[i2.roundIndex], null)), i2.phase = "feedback", i2.answerEndsAt = null), i2);
        z.current = m2, D(m2), P(Date.now()), _("answering" === m2.phase ? m2.draft ?? "" : ""), L("answering" === m2.phase ? m2.correction ?? null : null), F("answering" === m2.phase ? m2.rejected ?? null : null), (0, c.saveGame)(m2);
      }).catch((e4) => !r2 && I(e4.message)), () => {
        r2 = true;
      };
    }, [A]), (0, l.useDiveMenu)({ game: R, gameRef: z, setGame: es, input: M, correction: W, rejected: $, submitting: B, submittingRef: V, setNow: P, label: `Daily dive #${R?.dayNumber ?? ""} \xB7 round ${(R?.roundIndex ?? 0) + 1} of 7` });
    let ei = R?.phase;
    (0, r.useEffect)(() => {
      if (R?.pausedAt !== void 0 || "preview" !== ei && "answering" !== ei) return;
      let e3 = setInterval(() => P(Date.now()), 100);
      return () => clearInterval(e3);
    }, [ei, R?.pausedAt]), (0, r.useEffect)(() => {
      "answering" === ei && Q.current?.focus();
    }, [ei, R?.roundIndex]), (0, r.useEffect)(() => {
      if (!B) return;
      let e3 = setTimeout(() => {
        V.current && (V.current = false, Y(false), F("signal lost. resend"));
      }, 6500);
      return () => clearTimeout(e3);
    }, [B]);
    let el = e2 && R ? e2.prompts[R.roundIndex] : null, ed = (0, r.useCallback)((e3) => {
      let t2 = z.current;
      t2 && t2.results.length === t2.roundIndex && (_(""), L(null), F(null), es({ ...t2, phase: "feedback", draft: "", correction: null, rejected: null, previewEndsAt: null, answerEndsAt: null, results: [...t2.results, e3] }));
    }, [es]), eo = (0, r.useCallback)(async (t2, n2) => {
      let r2 = z.current;
      if (!r2 || void 0 !== r2.pausedAt || "answering" !== r2.phase || !e2 || !el || V.current) return;
      V.current = true, X.current = Date.now(), Y(true), L(null), F(null), Q.current && ee.current?.submitFx(Q.current.getBoundingClientRect());
      let a2 = new AbortController(), s2 = setTimeout(() => a2.abort(), 5e3);
      try {
        let s3 = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, signal: a2.signal, body: JSON.stringify({ date: e2.date, promptId: el.id, answer: t2, previewCorrection: !n2 && (0, b.shouldPreviewAnswerCorrections)(), playerId: Z.current, runId: r2.runId }) });
        if (403 === s3.status) return void K(true);
        if (!s3.ok) return void (n2 ? ed(N(el, t2)) : F("signal lost. resend"));
        let i2 = await s3.json(), l2 = z.current;
        if (!l2 || "answering" !== l2.phase || l2.date !== r2.date || l2.roundIndex !== r2.roundIndex) return;
        if (i2.correction) {
          _(i2.correction), L({ from: t2, to: i2.correction }), Q.current?.focus();
          return;
        }
        if (i2.accepted && i2.tier) ed({ promptId: el.id, promptText: el.text, rawAnswer: t2, answer: i2.answer ?? t2, tier: i2.tier, score: i2.score ?? o.TIERS[i2.tier].score, quip: i2.quip, receipt: i2.receipt });
        else {
          let e3 = z.current?.answerEndsAt != null && Date.now() >= z.current.answerEndsAt;
          n2 || e3 ? ed(N(el, t2, i2.receipt, i2.rejectionReason)) : (F(i2.rejectionReason ? `${i2.rejectionReason} Try again.` : `"${t2}": no echo. try again`), (0, b.shouldClearRejectedEntry)() && _(""), G((e4) => e4 + 1), ee.current?.rejectFx());
        }
      } catch {
        n2 ? ed(N(el, t2)) : F("signal lost. resend");
      } finally {
        clearTimeout(s2), V.current = false, Y(false);
      }
    }, [e2, el, ed]);
    (0, r.useEffect)(() => {
      if (R && e2 && void 0 === R.pausedAt) {
        if ("preview" === R.phase && null !== R.previewEndsAt && O >= R.previewEndsAt) {
          let e3 = requestAnimationFrame(() => {
            z.current?.pausedAt === void 0 && es({ ...R, phase: "answering", answerEndsAt: R.previewEndsAt + p.ANSWER_MS });
          });
          return () => cancelAnimationFrame(e3);
        } else if ("answering" === R.phase && null !== R.answerEndsAt && O >= R.answerEndsAt) {
          if (V.current) {
            if (O >= Math.max(R.answerEndsAt, X.current) + 4e3 && el) {
              let e4 = requestAnimationFrame(() => {
                V.current = false, Y(false), ed(N(el, M.trim() || null));
              });
              return () => cancelAnimationFrame(e4);
            }
            return;
          }
          let e3 = requestAnimationFrame(() => {
            if (z.current?.pausedAt !== void 0) return;
            let e4 = M.trim();
            e4 && el ? eo(e4, true) : el && ed(N(el, null));
          });
          return () => cancelAnimationFrame(e3);
        }
      }
    }, [O, R, e2, M, el, eo, ed, es]);
    let eu = (0, r.useCallback)((e3) => {
      let t2 = z.current;
      t2 && es({ ...t2, roundIndex: e3, phase: "preview", previewEndsAt: Date.now() + p.PREVIEW_MS, answerEndsAt: null });
    }, [es]), ec = (0, r.useCallback)(() => {
      let t2 = z.current;
      t2 && e2 && (t2.roundIndex >= o.ROUNDS_PER_DAY - 1 ? ((0, f.track)("game_complete", { day: t2.dayNumber, score: t2.results.reduce((e3, t3) => e3 + t3.score, 0) }), T((0, c.recordFinishedDay)(t2.date, t2.dayNumber, t2.results, t2.runId)), (0, c.clearGame)(), es({ ...t2, phase: "done" })) : eu(t2.roundIndex + 1));
    }, [e2, es, eu]);
    if ((0, r.useEffect)(() => {
      if (!R || "feedback" !== R.phase || 0 === R.results.length || J < R.results.length) return;
      let e3 = (e4) => {
        if ("Enter" !== e4.key || e4.repeat || e4.isComposing || e4.altKey || e4.ctrlKey || e4.metaKey || e4.shiftKey) return;
        let t2 = e4.target;
        t2 && (t2.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t2.tagName)) || document.querySelector('dialog[open], [role="dialog"]') || (e4.preventDefault(), R.roundIndex < o.ROUNDS_PER_DAY - 1 && (0, x.playSfx)("descend"), ec());
      };
      return window.addEventListener("keydown", e3), () => window.removeEventListener("keydown", e3);
    }, [R, J, ec]), (0, r.useEffect)(() => {
      let t2 = ee.current;
      if (!R || !e2 || !t2) return;
      let n2 = et.current, r2 = e2.prompts[R.roundIndex];
      if ("done" === R.phase) {
        -2 !== n2.round && (n2.round = -2, n2.restored = true, t2.finale());
        return;
      }
      if (!n2.restored) {
        if (n2.restored = true, "intro" === R.phase) return void t2.intro();
        let e3 = "feedback" === R.phase ? R.results.slice(0, -1) : R.results;
        if (t2.restore(R.roundIndex, r2?.text ?? "", e3.map((e4) => (0, g.outcomeToRestored)(e4))), n2.round = R.roundIndex, n2.plunged = e3.length, "feedback" === R.phase && R.results.length > 0) {
          let e4 = R.results.reduce((e5, t3) => e5 + t3.score, 0), r3 = R.results.length;
          t2.showLanded((0, g.outcomeToPlunge)(R.results[r3 - 1], e4), () => H((e5) => Math.max(e5, r3))), n2.plunged = r3;
        }
        return;
      }
      if ("preview" === R.phase && n2.round !== R.roundIndex && r2 && (n2.round = R.roundIndex, t2.descendToRound(R.roundIndex, r2.text, 2400)), "feedback" === R.phase && n2.plunged < R.results.length) {
        let e3 = R.results.length;
        n2.plunged = e3;
        let r3 = R.results.reduce((e4, t3) => e4 + t3.score, 0);
        t2.plunge((0, g.outcomeToPlunge)(R.results[e3 - 1], r3), () => H((t3) => Math.max(t3, e3)));
      }
    }, [R, e2, en]), (0, r.useEffect)(() => {
      if (R) if ("answering" === R.phase && void 0 === R.pausedAt && null !== R.answerEndsAt) {
        let e3 = Math.max(0, R.answerEndsAt - O);
        ee.current?.setUrgency(1 - e3 / p.ANSWER_MS);
      } else ee.current?.setUrgency(0);
    }, [O, R]), U) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(n.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-title", children: "midnight passed" }), (0, t.jsx)("p", { className: "ds-boot-msg", children: "A fresh dive went live while this tab sat open, so this one can no longer score." }), (0, t.jsx)("button", { onClick: () => window.location.reload(), className: "ds-next-btn", children: "DIVE INTO TODAY" })] });
    if (k) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(n.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-title", children: "no signal" }), (0, t.jsx)("p", { className: "ds-boot-msg", children: k }), (0, t.jsx)("button", { onClick: () => window.location.reload(), className: "ds-next-btn", children: "RETRY" })] });
    if (!e2 || !R || !C) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(n.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-label", children: "descending\u2026" })] });
    if ("done" === R.phase) {
      let n2 = C.history[e2.date];
      if (n2) return (0, t.jsxs)(w.default, { ref: ee, phase: "done", onReady: ea, children: [(0, t.jsx)(v.default, {}), (0, t.jsx)(y.default, {}), (0, t.jsx)("div", { className: "ds-done", children: (0, t.jsx)("div", { className: "ds-done-inner", children: (0, t.jsx)(h.default, { today: e2, entry: n2, stats: C }) }) })] });
    }
    let ep = R.results[R.results.length - 1], eh = J >= R.results.length, em = R.roundIndex >= o.ROUNDS_PER_DAY - 1, ef = "answering" === R.phase && null !== R.answerEndsAt ? Math.max(0, R.answerEndsAt - O) : p.ANSWER_MS, ew = "answering" === R.phase && ef <= 3050, eg = "preview" === R.phase && null !== R.previewEndsAt ? Math.max(0, Math.ceil((R.previewEndsAt - O) / 1e3)) : 0;
    return (0, t.jsxs)(w.default, { ref: ee, phase: R.phase, onReady: ea, opts: { surfaceNote: "2026-10-31" === e2.date ? "Happy Krilloween" : 100 === e2.dayNumber ? "100 days deep" : void 0 }, children: ["intro" === R.phase && (0, t.jsx)(v.default, {}), "intro" === R.phase && (0, t.jsx)(y.default, {}), "intro" === R.phase && (0, t.jsx)(m.default, { dayNumber: e2.dayNumber, streak: C.gamesPlayed > 0 ? C.currentStreak : void 0, onBegin: () => {
      (0, x.playSfx)("begin"), (0, f.track)("game_start", { day: e2.dayNumber }), eu(0);
    } }), "preview" === R.phase && (0, t.jsxs)("div", { className: "ds-preview-pill ds-px", children: ["descending \xB7 the clock starts in ", (0, t.jsx)("b", { children: eg })] }), "answering" === R.phase && (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)(E.default, { correction: W }), $ && (0, t.jsx)("div", { className: "ds-reject ds-reject-shake", "aria-live": "polite", children: $ }, q), (0, t.jsx)("form", { className: "ds-dock" + (ew ? " hot" : ""), onSubmit: (e3) => {
      if (e3.preventDefault(), z.current?.pausedAt !== void 0) return;
      let t2 = M.trim();
      t2 && !B && eo(t2, false);
    }, children: (0, t.jsxs)("div", { className: "ds-dock-inner", children: [(0, t.jsxs)("div", { className: "ds-sonar-wrap", children: [(0, t.jsx)("div", { className: "ds-sonar-scope", children: (0, t.jsx)("div", { className: "ds-sweep" + (ew ? " hot" : "") }) }), (0, t.jsx)("div", { className: "ds-time-digits" + (ew ? " hot" : ""), children: Math.ceil(ef / 1e3) })] }), (0, t.jsxs)("div", { className: "ds-input-col", children: [(0, t.jsx)("input", { ref: Q, className: "ds-input", value: M, "aria-describedby": W ? "answer-correction" : void 0, onChange: (e3) => {
      if (V.current) return;
      _(e3.target.value), L(null), F(null);
      let t2 = Q.current?.getBoundingClientRect();
      if (t2) {
        let n2 = t2.left + 14 + Math.min(11 * e3.target.value.length, t2.width - 28);
        ee.current?.typeFx(n2, t2.top);
      }
    }, placeholder: "type one answer\u2026", autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false, enterKeyHint: "send", maxLength: u.MAX_ANSWER_LENGTH, "aria-label": "Your answer" }), (0, t.jsx)("div", { className: "ds-fuse", children: (0, t.jsx)("div", { className: "ds-fuse-fill", style: { transform: `scaleX(${ef / p.ANSWER_MS})` } }) })] }), (0, t.jsx)("button", { type: "submit", disabled: !M.trim() || B, className: "ds-dive-btn", onMouseDown: (e3) => e3.preventDefault(), children: B ? "\u2026" : "DIVE" })] }) })] }), "feedback" === R.phase && ep && eh && (0, t.jsx)("div", { className: "ds-next-wrap", children: (0, t.jsx)("button", { className: "ds-next-btn", onClick: () => {
      em || (0, x.playSfx)("descend"), ec();
    }, children: em ? "SURFACE \u25B2" : "DESCEND \u25BC" }) })] });
  }]);
}]);
