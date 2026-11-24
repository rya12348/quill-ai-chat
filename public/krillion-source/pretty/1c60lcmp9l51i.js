(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 49213, (e) => {
  e.v({ krill: "Day100Thanks-module__WHaWRW__krill", note: "Day100Thanks-module__WHaWRW__note", signoff: "Day100Thanks-module__WHaWRW__signoff", title: "Day100Thanks-module__WHaWRW__title" });
}, 81337, (e) => {
  e.v({ keepDiving: "DoneView-module__Ao4LTq__keepDiving" });
}, 27305, (e) => {
  "use strict";
  e.i(47167);
  var t = e.i(43476), a = e.i(1900), s = e.i(22016), r = e.i(71645), n = e.i(39233), l = e.i(10552), i = e.i(25657);
  function o({ date: e2, entry: a2, onVisibilityChange: c2, experiment: d2 = "calibration" }) {
    let [u2, m2] = (0, r.useState)(false), { accepting: h2, syncWindow: p2 } = (0, i.useCollectionWindow)();
    (0, r.useEffect)(() => {
      let t2 = true, s2 = (0, l.dailyContext)(false, d2);
      if (s2 && s2.dailyDate === e2 && ("calibration" !== d2 || !a2.imported)) return (0, l.request)({ action: "offer", context: s2 }, d2).then((e3) => {
        t2 && (p2(e3), e3.invited && e3.accepting && (m2(true), (0, n.track)(`${d2.replaceAll("-", "_")}_invite`, { placement: "daily_results" })));
      }).catch(() => {
      }), () => {
        t2 = false;
      };
    }, [e2, a2.imported, p2, d2]);
    let x2 = u2 && h2;
    return ((0, r.useEffect)(() => {
      c2?.(x2);
    }, [x2, c2]), x2) ? (0, t.jsxs)("section", { className: "hub-panel", children: [(0, t.jsxs)("p", { className: "fathom", children: [(0, t.jsx)("span", { children: "a new way to dive" }), (0, t.jsx)("span", { className: "fathom-depth", children: "beta" })] }), (0, t.jsx)("h2", { className: "font-display text-[26px] leading-tight text-foam", children: "Help us test a new game mode" }), (0, t.jsx)("p", { className: "text-[15px] leading-relaxed text-drift", children: "Name as many answers as you can in 60 seconds." }), (0, t.jsx)(s.default, { href: `/${d2}`, prefetch: false, className: "btn-descend inline-block self-start", onClick: () => (0, n.track)(`${d2.replaceAll("-", "_")}_invite_click`), children: "Try the new mode \u2192" }), (0, t.jsx)("p", { className: "font-mono-ui text-[12px] leading-relaxed text-drift/70", children: "Your test rounds help us balance the game. Your daily score and streak stay as they are." })] }) : null;
  }
  var c = e.i(50684), d = e.i(52250), u = e.i(9371), m = e.i(98504), h = e.i(35406), p = e.i(86062), x = e.i(95721);
  e.i(98284);
  var f = e.i(37812), b = e.i(17335), g = e.i(12260), y = e.i(17747);
  async function j(e2) {
    let { date: t2, playerId: a2, score: s2, runId: r2, results: n2 } = e2, l2 = (e3, n3) => fetch("/api/today/complete", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ date: t2, playerId: a2, score: s2, record: e3, ...e3 ? { runId: r2, receipts: n3 } : {} }) });
    if (!(e2.record && (0, y.isCompletionRunId)(r2) && 7 === n2.length && n2.every((e3, t3) => e3.promptId === `p${t3 + 1}` && (e3.receipt || 0 === e3.score)))) return l2(false);
    try {
      let e3 = await Promise.all(n2.map(async (e4) => {
        if (e4.receipt) return e4.receipt;
        let s4 = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5e3), body: JSON.stringify({ date: t2, playerId: a2, runId: r2, promptId: e4.promptId, answer: "" }) });
        if (!s4.ok) throw Error("Zero receipt unavailable");
        let n3 = await s4.json();
        if (n3.accepted || !n3.receipt) throw Error("Invalid zero receipt");
        return n3.receipt;
      })), s3 = await l2(true, e3);
      if (s3.ok) return s3;
    } catch {
    }
    return l2(false);
  }
  let w = (e2) => e2.trim().toLowerCase();
  var v = e.i(95219), N = e.i(939);
  function k() {
    let [e2, a2] = (0, r.useState)(""), [s2, l2] = (0, r.useState)("idle");
    async function i2(t2) {
      t2.preventDefault();
      let a3 = e2.trim();
      if (!(a3.length < 3) && "sending" !== s2) {
        l2("sending");
        try {
          let e3 = await fetch("/api/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: (0, f.getPlayerId)(), text: a3 }) }), t3 = await e3.json();
          t3.ok ? ((0, n.track)("question_suggested"), l2("sent")) : "throttled" === t3.reason ? l2("throttled") : l2("error");
        } catch {
          l2("error");
        }
      }
    }
    return "sent" === s2 ? (0, t.jsx)("p", { className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: "logged \u2014 it might surface in a future dive." }) : "throttled" === s2 ? (0, t.jsx)("p", { className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: "that's plenty for today \u2014 resurface tomorrow." }) : (0, t.jsxs)("form", { onSubmit: i2, className: "flex flex-col gap-1.5", children: [(0, t.jsx)("label", { htmlFor: "suggest-question", className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: "got an idea for a question? tell us what to ask" }), (0, t.jsxs)("div", { className: "flex items-baseline gap-3 max-w-sm", children: [(0, t.jsx)("input", { id: "suggest-question", value: e2, onChange: (e3) => {
      a2(e3.target.value), "error" === s2 && l2("idle");
    }, maxLength: 160, placeholder: "name a type of cloud\u2026", className: "flex-1 bg-transparent border-b border-drift/40 focus:border-lumen-cyan outline-none font-mono-ui text-[13px] text-foam placeholder:text-drift/40 py-1" }), (0, t.jsx)("button", { type: "submit", disabled: e2.trim().length < 3 || "sending" === s2, className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase underline text-drift hover:text-lumen-cyan disabled:opacity-40 disabled:no-underline", children: "sending" === s2 ? "sending\u2026" : "submit" })] }), "error" === s2 && (0, t.jsx)("p", { className: "font-mono-ui text-[11px] tracking-[0.12em] uppercase text-lumen-pink/80", children: "couldn't send \u2014 try again in a moment." })] });
  }
  var S = e.i(31408), I = e.i(92347);
  let C = "2026-10-01";
  function T(e2, t2) {
    let a2 = Object.hasOwn(e2, t2) ? e2[t2] : 0;
    return Number.isSafeInteger(a2) && a2 > 0 ? a2 : 0;
  }
  function _(e2) {
    return e2 && ("matched" === e2.status || "reviewed" === e2.status) && "number" == typeof e2.votes && Number.isSafeInteger(e2.votes) && e2.votes >= 0 ? e2.votes : null;
  }
  function E(e2) {
    let t2 = _(e2);
    return null !== t2 ? `${t2.toLocaleString()} IMDb votes` : e2?.status === "ambiguous" ? "IMDb: match needs review" : e2?.status === "format review" ? "IMDb: format needs review" : e2?.status === "no rating data" ? "IMDb: no vote data" : "IMDb: not matched";
  }
  function A(e2) {
    return e2?.status === "matched" && "number" == typeof e2.rank && Number.isSafeInteger(e2.rank) && e2.rank > 0 ? e2.rank : null;
  }
  function D(e2, t2, a2) {
    return [...e2].sort((e3, s2) => {
      let r2 = t2(e3), n2 = t2(s2);
      if (void 0 === r2 && void 0 !== n2) return 1;
      if (void 0 === n2 && void 0 !== r2) return -1;
      let l2 = (r2 ?? 0) - (n2 ?? 0);
      return (a2 ? l2 : -l2) || e3.answer.localeCompare(s2.answer);
    });
  }
  let L = (0, r.memo)(function({ answers: e2, playerAnswer: a2, showCounts: s2 = false, counts: n2, countsAsOf: l2 }) {
    let [i2, o2] = (0, r.useState)(""), [c2, d2] = (0, r.useState)(100), [u2, m2] = (0, r.useState)("all"), [h2, x2] = (0, r.useState)("alphabetical"), f2 = e2.find((e3) => e3.imdb)?.imdb?.asOf, b2 = !!f2, g2 = (0, r.useMemo)(() => e2.some((e3) => e3.goodreads), [e2]), y2 = (0, r.useMemo)(() => e2.some((e3) => e3.octoberPlayers), [e2]), j2 = "october-high" === h2 || "october-low" === h2, w2 = e2.some((e3) => e3.familiarity), v2 = (0, r.useRef)(null), N2 = (0, r.useMemo)(() => {
      let t2 = /* @__PURE__ */ new Map();
      for (let a3 of e2) t2.set(a3.tier, (t2.get(a3.tier) ?? 0) + 1);
      return t2;
    }, [e2]), k2 = (0, r.useMemo)(() => {
      var t2, a3;
      let r2 = e2.filter((e3) => "all" === u2 || e3.tier === u2);
      return j2 ? D(r2, (e3) => e3.octoberPlayers?.count, "october-low" === h2) : "goodreads-high" === h2 || "goodreads-low" === h2 ? D(r2, (e3) => e3.goodreads?.count, "goodreads-low" === h2) : "imdb-high" === h2 || "imdb-low" === h2 ? (t2 = "imdb-low" === h2 ? "ascending" : "descending", [...r2].sort((e3, a4) => {
        let s3 = _(e3.imdb), r3 = _(a4.imdb);
        return null === s3 && null !== r3 ? 1 : null === r3 && null !== s3 ? -1 : (null !== s3 && null !== r3 ? (s3 - r3) * ("ascending" === t2 ? 1 : -1) : 0) || e3.answer.localeCompare(a4.answer);
      })) : "familiarity-high" === h2 || "familiarity-low" === h2 ? (a3 = "familiarity-high" === h2 ? "most" : "least", [...r2].sort((e3, t3) => {
        let s3 = A(e3.familiarity), r3 = A(t3.familiarity);
        return null === s3 && null !== r3 ? 1 : null === r3 && null !== s3 ? -1 : (null !== s3 && null !== r3 ? (s3 - r3) * ("most" === a3 ? 1 : -1) : 0) || e3.answer.localeCompare(t3.answer);
      })) : s2 && "alphabetical" !== h2 && n2 ? (function(e3, t3, a4 = "descending") {
        let s3 = "ascending" === a4 ? 1 : -1;
        return [...e3].sort((e4, a5) => s3 * (T(t3, e4.answer) - T(t3, a5.answer)) || e4.answer.localeCompare(a5.answer));
      })(r2, n2, "least" === h2 ? "ascending" : "descending") : r2;
    }, [e2, u2, s2, h2, j2, n2]), S2 = (0, r.useMemo)(() => (function(e3, t2) {
      let a3 = t2.trim().toLowerCase();
      if (!a3) return [...e3];
      let s3 = [], r2 = [];
      for (let t3 of e3) {
        if (t3.answer.toLowerCase().includes(a3)) {
          s3.push(t3);
          continue;
        }
        t3.aliases?.some((e4) => e4.toLowerCase().includes(a3)) && r2.push(t3);
      }
      return [...s3, ...r2];
    })(k2, i2), [k2, i2]), C2 = S2.slice(0, c2), L2 = C2.length < S2.length, $2 = a2?.toLowerCase(), M2 = () => {
      v2.current && (v2.current.scrollTop = 0);
    };
    return (0, t.jsxs)("div", { className: "mt-2 mb-1 pl-[27px]", children: [(e2.length > 100 || s2 || b2 || w2 || g2 || y2) && (0, t.jsx)("div", { role: "group", "aria-label": "Filter answers by tier", className: "mb-2 flex flex-wrap gap-1.5", children: [{ id: "all", name: "All", color: "var(--color-foam)" }, ...p.TIERS_BY_DEPTH].filter((e3) => "all" === e3.id || N2.has(e3.id)).map((a3) => (0, t.jsxs)("button", { type: "button", "aria-pressed": u2 === a3.id, onClick: () => {
      m2(a3.id), o2(""), d2(100), M2();
    }, className: "rounded border px-2 py-1 font-mono-ui text-[12px]", style: { color: a3.color, borderColor: u2 === a3.id ? a3.color : "var(--hairline)", background: u2 === a3.id ? "rgba(255,255,255,0.08)" : "transparent" }, children: ["krillion" === a3.id ? "Krillion" : a3.name, " ", (0, t.jsx)("span", { className: "opacity-70", children: ("all" === a3.id ? e2.length : N2.get(a3.id) ?? 0).toLocaleString() })] }, a3.id)) }), (s2 || b2 || w2 || g2 || y2) && (0, t.jsxs)("div", { className: "mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-drift/70", children: [(0, t.jsxs)("label", { className: "flex items-center gap-2", children: ["Sort answers", (0, t.jsxs)("select", { "aria-label": "Sort answers", value: h2, onChange: (e3) => {
      x2(e3.target.value), d2(100), M2();
    }, className: "rounded border px-2 py-1 text-foam", style: { background: "var(--color-abyss, #101d33)", borderColor: "var(--hairline)" }, children: [(0, t.jsx)("option", { value: "alphabetical", children: "A\u2013Z" }), y2 && (0, t.jsx)("option", { value: "october-high", children: "Oct 24 player counts \xB7 high to low" }), y2 && (0, t.jsx)("option", { value: "october-low", children: "Oct 24 player counts \xB7 low to high" }), g2 && (0, t.jsx)("option", { value: "goodreads-high", children: "Goodreads ratings \xB7 high to low" }), g2 && (0, t.jsx)("option", { value: "goodreads-low", children: "Goodreads ratings \xB7 low to high" }), b2 && (0, t.jsx)("option", { value: "imdb-high", children: "IMDb votes \xB7 high to low" }), b2 && (0, t.jsx)("option", { value: "imdb-low", children: "IMDb votes \xB7 low to high" }), w2 && (0, t.jsx)("option", { value: "familiarity-high", children: "Linguabase familiarity \xB7 high to low" }), w2 && (0, t.jsx)("option", { value: "familiarity-low", children: "Linguabase familiarity \xB7 low to high" }), s2 && (0, t.jsx)("option", { value: "popular", disabled: !n2, children: "Most chosen \xB7 high to low" }), s2 && (0, t.jsx)("option", { value: "least", disabled: !n2, children: "Least chosen \xB7 low to high" })] })] }), s2 && (0, t.jsx)("span", { role: "status", children: n2 && l2 ? `Live counts \xB7 updated ${new Date(l2).toLocaleTimeString()} \xB7 refreshes every 45s` : "Live counts unavailable \xB7 retrying every 45s" })] }), j2 && (0, t.jsx)("p", { className: "mb-2 text-[12px] text-drift/70", children: "Players whose first accepted answer in the Oct 24 book round was the displayed title. Unmatched series sort last." }), ("goodreads-high" === h2 || "goodreads-low" === h2) && (0, t.jsx)("p", { className: "mb-2 text-[12px] text-drift/70", children: "Sorted by ratings on the linked book. Series without a recent verified count sort last." }), b2 && (0, t.jsxs)("p", { className: "mb-2 text-[12px] text-drift/70", children: ["IMDb votes \xB7 ", f2, " snapshot \xB7 sorts across the selected tiers \xB7 unresolved matches last"] }), e2.length > 100 && (0, t.jsx)("input", { type: "search", "aria-label": "Search answers", placeholder: "all" === u2 ? "Search all answers\u2026" : `Search ${p.TIERS[u2].name} answers\u2026`, value: i2, onChange: (e3) => {
      o2(e3.target.value), d2(100), M2();
    }, className: "w-full mb-2 rounded border px-2 py-1 text-sm text-foam", style: { background: "rgba(16,29,51,0.5)", borderColor: "var(--hairline)" } }), (0, t.jsx)("ul", { ref: v2, "aria-label": "Answers", tabIndex: 0, onScroll: (e3) => {
      let t2 = e3.currentTarget;
      L2 && t2.scrollHeight - t2.scrollTop - t2.clientHeight <= 200 && d2(Math.min(c2 + 100, S2.length));
    }, className: "flex flex-col gap-1 max-h-72 overflow-y-auto pr-1", children: C2.map((e3) => (0, t.jsxs)("li", { className: "flex items-start gap-2 px-1.5 py-1", style: e3.answer.toLowerCase() === $2 ? { background: "rgba(16,29,51,0.5)" } : void 0, children: [(0, t.jsx)("span", { className: "mt-0.5", children: (0, t.jsx)(I.default, { tier: e3.tier, size: 14 }) }), (0, t.jsxs)("span", { className: "flex-1 min-w-0", children: [(0, t.jsx)("span", { className: "text-[14px] text-foam", children: e3.answer }), e3.answer.toLowerCase() === $2 && (0, t.jsx)("span", { className: "ml-2 font-mono-ui text-[10px] tracking-[0.14em] uppercase text-lumen-cyan", children: "you" }), e3.quip && (0, t.jsx)("span", { className: "block text-[13px] leading-snug text-drift/70", children: e3.quip }), j2 && (0, t.jsx)("span", { className: "block font-mono-ui text-[12px] tabular-nums text-drift/70", children: e3.octoberPlayers ? `${e3.octoberPlayers.count.toLocaleString()} players \xB7 ${e3.octoberPlayers.book}` : "No verified October count" }), g2 && (0, t.jsx)("span", { className: "block font-mono-ui text-[12px] tabular-nums text-drift/70", children: e3.goodreads ? (0, t.jsxs)("a", { href: `https://www.goodreads.com/book/show/${e3.goodreads.id}`, target: "_blank", rel: "noopener noreferrer", className: "underline decoration-dotted underline-offset-2", children: [e3.goodreads.count.toLocaleString(), " ratings \xB7 ", e3.goodreads.book, " \xB7 checked ", e3.goodreads.asOf, e3.goodreads.shared && " \xB7 book shared across series"] }) : "No recent verified Goodreads count" }), b2 && (0, t.jsx)("span", { className: "block font-mono-ui text-[12px] tabular-nums text-drift/70", children: e3.imdb?.id ? (0, t.jsx)("a", { href: `https://www.imdb.com/title/${e3.imdb.id}/`, target: "_blank", rel: "noopener noreferrer", className: "underline decoration-dotted underline-offset-2", children: E(e3.imdb) }) : E(e3.imdb) })] }), s2 && (0, t.jsx)("span", { className: "font-mono-ui text-[11px] tabular-nums shrink-0 text-drift/70", title: "Players whose first accepted answer was this answer", children: n2 ? `${T(n2, e3.answer).toLocaleString()} players` : "\u2014 players" }), (0, t.jsxs)("span", { className: "font-mono-ui text-[11px] tabular-nums ml-auto shrink-0 min-w-7 text-right", style: { color: p.TIERS[e3.tier].color }, children: ["+", e3.score] })] }, e3.answer)) }), e2.length > 100 && (0, t.jsxs)("div", { className: "mt-2 flex flex-wrap items-center justify-between gap-2 font-mono-ui text-[12px] text-drift/70", children: [(0, t.jsx)("span", { role: "status", children: 0 === S2.length ? "No matching answers" : `${C2.length.toLocaleString()} of ${S2.length.toLocaleString()} answers` }), L2 && (0, t.jsx)("span", { children: "Scroll for more" })] })] });
  });
  var $ = e.i(72318), M = e.i(444), P = e.i(78877), O = e.i(45394), R = e.i(23524), q = e.i(46513);
  function H({ placement: e2 }) {
    let a2 = (0, R.useAdsEnabled)(), l2 = (0, r.useRef)(null);
    if (!a2) return null;
    let i2 = () => l2.current?.close();
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", onClick: () => {
      (0, n.track)("no_ads_opened", { placement: e2 }), l2.current?.showModal();
    }, className: "btn-quiet inline-block self-start", children: "NO ADS \u2715" }), (0, t.jsx)("dialog", { ref: l2, className: q.default.dialog, "aria-labelledby": "no-ads-title", "aria-describedby": "no-ads-body", onCancel: (e3) => {
      e3.preventDefault(), i2();
    }, onKeyDown: (e3) => {
      "Escape" === e3.key && (e3.preventDefault(), i2());
    }, children: (0, t.jsxs)("div", { className: q.default.panel, children: [(0, t.jsx)("button", { className: q.default.close, type: "button", onClick: i2, "aria-label": "Close", children: "\xD7" }), (0, t.jsx)("p", { className: q.default.eyebrow, children: "One purchase" }), (0, t.jsx)("h2", { className: q.default.title, id: "no-ads-title", children: "No ads, anywhere." }), (0, t.jsx)("p", { className: q.default.body, id: "no-ads-body", children: "Unlock Unlimited or any themed pack for $5 and ads turn off across the whole site. One time, and it follows you when you link your Google account." }), (0, t.jsxs)("div", { className: q.default.actions, children: [(0, t.jsx)(s.default, { href: "/unlimited/classic", prefetch: false, className: `btn-descend ${q.default.cta}`, onClick: () => (0, n.track)("no_ads_cta", { placement: e2, target: "unlimited" }), children: "UNLIMITED \xB7 $5" }), (0, t.jsx)(s.default, { href: "/packs", prefetch: false, className: `btn-descend ${q.default.cta}`, onClick: () => (0, n.track)("no_ads_cta", { placement: e2, target: "packs" }), children: "THEMED PACKS \xB7 $5" }), (0, t.jsx)("button", { className: `btn-quiet ${q.default.dismiss}`, type: "button", onClick: i2, children: "Close" })] })] }) })] });
  }
  var W = e.i(74365);
  function K() {
    let [e2, a2] = (0, r.useState)(null);
    return ((0, r.useEffect)(() => {
      let e3 = true;
      return (0, W.loadCurrentAnnouncement)().then((t2) => {
        e3 && a2(t2?.showOnResults ? t2 : null);
      }).catch(() => {
      }), () => {
        e3 = false;
      };
    }, []), e2) ? (0, t.jsxs)("section", { role: "note", "aria-label": e2.title, className: "rounded-md border px-4 py-3", style: { borderColor: "var(--hairline)", background: "linear-gradient(180deg, rgba(16, 29, 51, 0.92), rgba(11, 21, 38, 0.92))" }, children: [(0, t.jsx)("p", { className: "font-mono-ui text-[13px] tracking-[0.14em] uppercase text-lumen-cyan", children: e2.title }), (0, t.jsx)("p", { className: "text-[15px] text-foam mt-1.5 whitespace-pre-line", children: e2.body })] }) : null;
  }
  var F = e.i(36484), U = e.i(49213);
  function z() {
    return (0, t.jsxs)("section", { className: U.default.note, "aria-labelledby": "day-100-thanks-title", children: [(0, t.jsx)("h2", { id: "day-100-thanks-title", className: U.default.title, children: "A little thank-you" }), (0, t.jsx)("p", { children: "Today was Krillion\u2019s 100th dive. I didn\u2019t even realize it was number 100 at first. I suppose I\u2019ve been too locked in lol, but then some of y\u2019all pointed it out and it made me realize I should do a little something." }), (0, t.jsx)("p", { children: "This game has completely changed my life, and I\u2019m so grateful to all of you who play it." }), (0, t.jsx)("p", { children: "Seeing it pop up on my FYP is still completely surreal. So is knowing it\u2019s become a part of people\u2019s days and even something people have their own jokes about. It\u2019s insane to me that something I made has found its own little corner in the culture. I don\u2019t want to sound too vain saying that. It\u2019s just something I never imagined would happen." }), (0, t.jsx)("p", { children: "Thank you for caring about this game enough to keep coming back, even when you\u2019re arguing with me about which answers should count lol. I\u2019m so happy Krillion has come this far, and you\u2019re the reason it has." }), (0, t.jsx)("p", { children: "And shout out to my parents and little brother." }), (0, t.jsxs)("p", { className: U.default.signoff, children: ["Here\u2019s to the next 100.", " ", (0, t.jsx)(F.default, { className: U.default.krill, width: 18, height: 18, alt: "" })] })] });
  }
  var G = e.i(62557), V = e.i(81337);
  e.s(["default", 0, function({ today: e2, entry: l2, stats: i2 }) {
    let [y2, _2] = (0, r.useState)(false), [E2, A2] = (0, r.useState)(false), [D2, R2] = (0, r.useState)(null), q2 = D2?.date === e2.date, W2 = q2 ? D2.prompts : null, F2 = (0, r.useMemo)(() => {
      let e3;
      return (e3 = (function(e4, t2) {
        if (!t2) return e4;
        let a2 = false, s2 = e4.map((e5) => {
          if (null === e5.answer || null === e5.tier) return e5;
          let s3 = w(e5.answer), r2 = t2.find((t3) => t3.id === e5.promptId)?.answers.find((e6) => w(e6.answer) === s3);
          if (!r2) return e5;
          let n2 = p.TIERS[r2.tier].score;
          return r2.tier === e5.tier && n2 === e5.score ? e5 : (a2 = true, { ...e5, tier: r2.tier, score: n2 });
        });
        return a2 ? s2 : e4;
      })(l2.results, W2)) === l2.results ? l2 : { ...l2, results: e3, score: e3.reduce((e4, t2) => e4 + t2.score, 0), tiers: e3.map((e4) => e4.tier ?? "miss") };
    }, [l2, W2]), U2 = F2 === l2 ? i2 : (0, v.statsFromHistory)({ ...i2.history, [e2.date]: F2 }, e2.date, (0, f.voidedStreakDates)()), [B, Y] = (0, r.useState)({ score: null, betterThan: null, dist: null }), J = B.score === F2.score ? B : { betterThan: null, dist: null };
    (0, r.useEffect)(() => {
      let t2 = true;
      return j({ date: e2.date, playerId: (0, f.getPlayerId)(), score: F2.score, runId: l2.runId, results: l2.results, record: !l2.imported && F2.score === l2.score }).then((e3) => e3.ok ? e3.json() : null).then((e3) => {
        t2 && e3 && "number" == typeof e3.betterThan && Y({ score: F2.score, betterThan: e3.betterThan, dist: Array.isArray(e3.dist) ? e3.dist : null });
      }).catch(() => {
      }), () => {
        t2 = false;
      };
    }, [e2.date, F2.score, l2.score, l2.imported, l2.runId, l2.results]);
    let Z = (function(e3) {
      let [t2, a2] = (0, r.useState)();
      return (0, r.useEffect)(() => {
        let t3;
        if (e3 < C) return;
        let s2 = true, r2 = false, n2 = false, l3 = async () => {
          if (!s2 || r2 || n2 || "hidden" === document.visibilityState) return;
          r2 = true, t3 = new AbortController();
          let l4 = setTimeout(() => t3?.abort(), 8e3);
          try {
            let r3 = await fetch(`/api/answer-popularity?date=${encodeURIComponent(e3)}`, { signal: t3.signal });
            if (403 === r3.status) {
              n2 = true;
              return;
            }
            if (!r3.ok) return;
            let l5 = await r3.json();
            s2 && l5.date === e3 && "string" == typeof l5.asOf && l5.prompts && "object" == typeof l5.prompts && a2(l5);
          } catch {
          } finally {
            clearTimeout(l4), r2 = false;
          }
        };
        l3();
        let i3 = setInterval(() => {
          l3();
        }, 45e3), o2 = () => {
          l3();
        };
        return document.addEventListener("visibilitychange", o2), window.addEventListener("focus", o2), () => {
          s2 = false, t3?.abort(), clearInterval(i3), document.removeEventListener("visibilitychange", o2), window.removeEventListener("focus", o2);
        };
      }, [e3]), e3 >= C && t2?.date === e3 ? t2 : void 0;
    })(e2.date), [Q, X] = (0, r.useState)(null), [ee, et] = (0, r.useState)(false), [ea, es] = (0, r.useState)(false), [er, en] = (0, r.useState)("");
    (0, r.useEffect)(() => {
      let t2 = true, a2 = new AbortController(), s2 = setTimeout(() => a2.abort(), 8e3), r2 = requestAnimationFrame(() => {
        es("u" > typeof navigator && !!navigator.share);
      });
      return fetch(`/api/reveal?date=${e2.date}`, { signal: a2.signal }).then((e3) => e3.ok ? e3.json() : null).then((a3) => {
        t2 && R2({ date: e2.date, prompts: Array.isArray(a3?.prompts) ? a3.prompts : null });
      }).catch(() => {
        t2 && R2({ date: e2.date, prompts: null });
      }).finally(() => clearTimeout(s2)), () => {
        t2 = false, clearTimeout(s2), a2.abort(), cancelAnimationFrame(r2);
      };
    }, [e2.date]), (0, r.useEffect)(() => {
      let t2 = new Date(e2.resetsAt).getTime(), a2 = () => {
        let e3 = t2 - Date.now();
        if (e3 <= 0) return void en("ready");
        let a3 = Math.floor(e3 / 36e5), s3 = Math.floor(e3 % 36e5 / 6e4), r2 = Math.floor(e3 % 6e4 / 1e3);
        en(`${String(a3).padStart(2, "0")}:${String(s3).padStart(2, "0")}:${String(r2).padStart(2, "0")}`);
      };
      a2();
      let s2 = setInterval(a2, 1e3);
      return () => clearInterval(s2);
    }, [e2.resetsAt]);
    let { shareLink: el } = (0, g.usePreferences)(), ei = () => {
      let e3 = (0, b.buildShareText)(F2.dayNumber, F2.score, F2.tiers);
      return el ? (0, b.withShareLink)(e3) : e3;
    }, eo = async () => {
      (0, n.track)("share_copied", { score: F2.score });
      try {
        await navigator.clipboard.writeText(ei()), et(true), setTimeout(() => et(false), 2e3);
      } catch {
      }
    }, ec = async () => {
      (0, n.track)("share_native", { score: F2.score });
      try {
        await navigator.share({ text: ei() });
      } catch {
      }
    }, ed = U2.gamesPlayed ? Math.round(U2.totalScore / U2.gamesPlayed) : 0;
    return q2 ? (0, t.jsxs)("div", { className: "flex flex-col gap-9 mt-1 pb-12 w-full", children: [(0, t.jsxs)("div", { children: [(0, t.jsxs)("div", { className: "flex items-baseline justify-between", children: [(0, t.jsx)("span", { className: "ds-done-krill", children: "KRILLION" }), (0, t.jsxs)("span", { className: "font-mono-ui text-[13px] tracking-[0.14em] text-drift uppercase", children: ["Dive #", F2.dayNumber, " complete"] })] }), (0, t.jsxs)("div", { className: "flex items-baseline gap-2 mt-4", children: [(0, t.jsx)("span", { className: "font-display text-[5rem] leading-none text-foam tabular-nums", children: F2.score }), (0, t.jsxs)("span", { className: "font-mono-ui text-sm text-lumen-cyan tabular-nums ml-2", children: ["-", (10 * F2.score).toLocaleString("en-US"), "m"] })] }), J.dist ? (0, t.jsx)(M.default, { dist: J.dist, score: F2.score, betterThan: J.betterThan }) : null !== J.betterThan ? (0, t.jsxs)("p", { className: "font-mono-ui text-[13px] tracking-[0.14em] uppercase text-lumen-cyan mt-2", children: ["better than ", (0, x.formatPercentile)(J.betterThan), "% of today's players"] }) : null] }), (0, t.jsx)(K, {}), (0, t.jsx)($.default, { results: F2.results }), (0, t.jsxs)("section", { children: [(0, t.jsx)("p", { className: "fathom mb-1", children: (0, t.jsx)("span", { children: "the bearing" }) }), (0, t.jsx)("ul", { children: p.SCORE_BANDS.map((e3) => {
      let a2 = (0, p.bandFor)(F2.score) === e3;
      return (0, t.jsxs)("li", { className: "flex items-center gap-3 px-1.5 py-2 border-b last:border-b-0", style: { borderColor: "var(--hairline)" }, children: [(0, t.jsx)(I.default, { tier: e3.tier, size: 17 }), (0, t.jsx)("span", { className: "font-mono-ui text-[13px] tabular-nums w-[4.5rem] shrink-0", style: { color: p.TIERS[e3.tier].color }, children: e3.range }), (0, t.jsx)("span", { className: `text-[15px] flex-1 min-w-0 ${a2 ? "text-foam" : "text-drift/70"}`, children: e3.verdict })] }, e3.min);
    }) })] }), (0, t.jsxs)("div", { className: "flex flex-col gap-4", children: [(0, t.jsxs)("div", { className: "flex gap-3", children: [(0, t.jsx)("button", { onClick: eo, className: "btn-descend flex-1", children: ee ? "Copied \u2713" : "Copy result" }), ea && (0, t.jsx)("button", { onClick: ec, className: "btn-quiet", "aria-label": "Share via apps", children: "Share\u2026" })] }), (0, t.jsxs)("div", { className: "flex flex-col gap-6", children: [(0, t.jsx)(s.default, { href: "/unlimited/classic", prefetch: false, className: V.default.keepDiving, children: "KEEP DIVING \u221E" }), 100 === e2.dayNumber && (0, t.jsx)(z, {}), (0, t.jsxs)("div", { className: "flex flex-col gap-3", children: [(0, t.jsx)(s.default, { href: "/archive", prefetch: false, className: "btn-quiet inline-block self-start", children: "ARCHIVE \u27F2" }), (0, t.jsx)(s.default, { href: "/packs", prefetch: false, className: "btn-quiet inline-block self-start", children: "THEMED PACKS \u2192" }), (0, t.jsx)(H, { placement: "daily_results" })] })] })] }), (0, t.jsx)(G.default, { placement: "daily_results" }), (0, t.jsx)(d.default, {}), (0, t.jsx)(u.default, { placement: "daily_results" }), (0, t.jsx)(o, { experiment: "answer-count", date: e2.date, entry: F2, onVisibilityChange: A2 }), (0, t.jsx)(o, { date: e2.date, entry: F2, onVisibilityChange: _2 }), (0, t.jsxs)("div", { className: "flex flex-col gap-3", children: [(0, t.jsx)(O.default, { placement: "daily_results" }), (0, t.jsx)(P.default, { placement: "daily_results" }), (0, t.jsx)(m.default, {})] }), (0, t.jsx)(h.ResultsAd, {}), (0, t.jsxs)("section", { children: [(0, t.jsxs)("p", { className: "fathom mb-1", children: [(0, t.jsx)("span", { children: "the catch" }), (0, t.jsx)("span", { className: "fathom-depth", children: "tap a round for every answer" })] }), (0, t.jsx)("ul", { children: F2.results.map((a2, s2) => {
      let r2 = W2?.find((e3) => e3.id === a2.promptId), n2 = Z?.prompts[a2.promptId], i3 = a2.answer && n2 ? (function(e3, t2, a3 = false) {
        return Math.max(0, T(e3, t2) - !a3);
      })(n2, a2.answer, l2.imported) : null;
      return (0, t.jsxs)("li", { className: "py-2.5 border-b last:border-b-0", style: { borderColor: "var(--hairline)" }, children: [(0, t.jsxs)("button", { type: "button", className: "flex items-center gap-3 w-full text-left", onClick: () => X(Q === a2.promptId ? null : a2.promptId), "aria-expanded": Q === a2.promptId, children: [(0, t.jsx)("span", { className: "font-mono-ui text-[12px] text-drift/60 w-3 shrink-0", children: s2 + 1 }), (0, t.jsx)(I.default, { tier: a2.tier ?? "miss", size: 19 }), (0, t.jsxs)("div", { className: "min-w-0 flex-1", children: [(0, t.jsx)("p", { className: "font-mono-ui text-[12px] text-drift/70 truncate uppercase tracking-[0.05em]", children: r2?.text ?? e2.prompts.find((e3) => e3.id === a2.promptId)?.text ?? a2.promptText }), (0, t.jsx)("p", { className: "text-[17px] text-foam truncate", children: a2.answer ?? (a2.rawAnswer ? `"${a2.rawAnswer}"` : "\u2014") }), null !== i3 && (0, t.jsxs)("p", { className: "mt-0.5 text-[12px] text-drift/70", "aria-live": "polite", children: [(0, t.jsx)("span", { className: "tabular-nums text-lumen-cyan", children: i3.toLocaleString() }), ` ${1 === i3 ? "other player" : "other players"} chose this`] })] }), (0, t.jsx)("span", { className: "font-mono-ui text-sm tabular-nums", style: { color: a2.tier ? p.TIERS[a2.tier].color : "var(--tier-miss)" }, children: a2.score }), (0, t.jsx)("span", { className: "font-mono-ui text-[11px] text-drift/50 w-3", children: Q === a2.promptId ? "\u2212" : "+" })] }), r2?.resultsNote && (0, t.jsx)("p", { className: "mt-1.5 pl-[55px] text-[14px] leading-snug text-drift/70", children: r2.resultsNote }), Q === a2.promptId && (r2 ? (0, t.jsx)(L, { answers: r2.answers, playerAnswer: a2.answer, showCounts: false, counts: void 0, countsAsOf: void 0 }, `${e2.date}:${a2.promptId}`) : (0, t.jsx)("p", { className: "mt-2 mb-1 pl-[27px] font-mono-ui text-[12px] text-drift/50", children: null === W2 ? "surfacing the answer sheets\u2026" : "answer sheet lost at sea" }))] }, a2.promptId);
    }) })] }), (0, t.jsxs)("section", { children: [(0, t.jsx)("p", { className: "fathom mb-2", children: (0, t.jsx)("span", { children: "logbook" }) }), (0, t.jsxs)("p", { className: "font-mono-ui text-[14px] tracking-[0.1em] text-drift uppercase tabular-nums", children: ["streak ", (0, t.jsx)("span", { className: "text-foam", children: U2.currentStreak }), " \xB7 played ", (0, t.jsx)("span", { className: "text-foam", children: U2.gamesPlayed }), " \xB7 avg", " ", (0, t.jsx)("span", { className: "text-foam", children: ed }), " \xB7 best", " ", (0, t.jsx)("span", { className: "text-foam", children: U2.bestScore })] })] }), (0, t.jsxs)("p", { className: "font-mono-ui text-[13px] tracking-[0.12em] uppercase text-drift", children: ["next dive in", " ", (0, t.jsx)("span", { className: "text-lumen-cyan tabular-nums", children: er }), "ready" === er && (0, t.jsx)("button", { onClick: () => window.location.reload(), className: "ml-2 underline text-lumen-pink", children: "refresh" })] }), (0, t.jsx)(N.default, {}), (0, t.jsx)(a.AdPrivacyLocation, {}), (0, t.jsx)(k, {}), (0, t.jsx)(S.default, { game: `daily:${e2.date}`, score: F2.score }), false, !y2 && !E2 && (0, t.jsx)(c.default, {})] }) : (0, t.jsx)("p", { role: "status", className: "ds-boot-label py-12 text-center", children: "Checking your result\u2026" });
  }], 27305);
}, 83655, (e) => {
  e.v({ actions: "DailyIntro-module__e61tQq__actions" });
}, 84822, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(22016), s = e.i(1900), r = e.i(62557), n = e.i(83655);
  e.s(["default", 0, function({ dayNumber: e2, streak: l, onBegin: i }) {
    return (0, t.jsx)("div", { className: "ds-intro", children: (0, t.jsxs)("div", { className: "ds-intro-inner", children: [(0, t.jsxs)("details", { className: "ds-howto", children: [(0, t.jsx)("summary", { children: "how to play" }), (0, t.jsxs)("ul", { children: [(0, t.jsx)("li", { children: "7 prompts a day. same for everyone." }), (0, t.jsx)("li", { children: "25 seconds to name one thing." }), (0, t.jsx)("li", { children: "rare answers score big. obvious ones float." }), (0, t.jsx)("li", { children: "the pick that feels clever? the school thought of it too." }), (0, t.jsx)("li", { children: "every point sinks you 10 metres. 700 is the trench." }), (0, t.jsx)("li", { children: "one dive per day. no second chances." })] })] }), (0, t.jsx)(s.AdPrivacyLocation, {}), (0, t.jsxs)("div", { className: n.default.actions, children: [(0, t.jsx)(r.default, { placement: "home" }), (0, t.jsx)("button", { className: "ds-begin-btn", onClick: i, children: "\u25BC BEGIN DESCENT \u25BC" })] }), (0, t.jsxs)("div", { className: "ds-intro-meta", style: { flexWrap: "wrap" }, children: [(0, t.jsxs)("span", { children: ["dive #", e2, void 0 !== l && (0, t.jsxs)(t.Fragment, { children: [" \xB7 streak ", l] })] }), (0, t.jsxs)("div", { className: "flex flex-wrap items-center gap-[10px]", children: [(0, t.jsx)(a.default, { href: "/archive", prefetch: false, children: "ARCHIVE \u27F2" }), (0, t.jsx)(a.default, { href: "/packs", prefetch: false, children: "THEMED PACKS" }), (0, t.jsx)(a.default, { href: "/unlimited/classic", prefetch: false, children: "UNLIMITED \u221E" })] })] })] }) });
  }]);
}]);
