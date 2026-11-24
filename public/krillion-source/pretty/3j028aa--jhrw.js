(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 99363, 40806, (e) => {
  "use strict";
  var t = e.i(71645);
  let r = Date.parse("2026-10-16T00:00:00-04:00"), n = Date.parse("2026-11-01T00:00:00-04:00"), o = [["/tiers/krillion.png", "/tiers/krillion-halloween-2026.png"], ["/tiers/krillion-gold.png", "/tiers/krillion-halloween-2026-gold.png"]];
  function i(e2 = Date.now()) {
    return e2 >= r && e2 < n;
  }
  function a(e2, t2) {
    let r2 = o.find(([t3, r3]) => e2 === t3 || e2 === r3);
    return r2 ? r2[+!!t2] : e2;
  }
  function l(e2, t2 = Date.now()) {
    return a(e2, i(t2));
  }
  function s(e2) {
    let t2, o2 = i(), a2 = () => {
      clearTimeout(t2);
      let l2 = Date.now(), s2 = i(l2);
      s2 !== o2 && (o2 = s2, e2());
      let c2 = l2 < r ? r : n;
      l2 < c2 && (t2 = setTimeout(a2, Math.min(c2 - l2, 2147483647)));
    };
    return a2(), document.addEventListener("visibilitychange", a2), window.addEventListener("pageshow", a2), window.addEventListener("focus", a2), () => {
      clearTimeout(t2), document.removeEventListener("visibilitychange", a2), window.removeEventListener("pageshow", a2), window.removeEventListener("focus", a2);
    };
  }
  e.s(["HALLOWEEN_KRILL_END", 0, n, "HALLOWEEN_KRILL_START", 0, r, "isHalloweenKrill", 0, i, "krillSpriteForSeason", 0, a, "seasonalKrillSprite", 0, l], 40806);
  let c = () => false;
  e.s(["subscribeKrillSeason", 0, s, "useSeasonalKrillSprite", 0, function(e2) {
    return a(e2, (0, t.useSyncExternalStore)(s, i, c));
  }, "watchSeasonalKrillImages", 0, function(e2) {
    let t2 = () => {
      for (let t3 of e2.querySelectorAll("img[src]")) {
        if (t3.closest(".ds-mascot")) continue;
        let e3 = t3.getAttribute("src"), r2 = l(e3);
        e3 !== r2 && t3.setAttribute("src", r2);
      }
    };
    return t2(), s(t2);
  }], 99363);
}, 37812, 98284, 95219, 33827, (e) => {
  "use strict";
  let t;
  e.i(47167);
  var r = e.i(86062);
  let n = "America/New_York", o = "2026-07-16", i = new Intl.DateTimeFormat("en-CA", { timeZone: n, year: "numeric", month: "2-digit", day: "2-digit" });
  function a(e2 = /* @__PURE__ */ new Date()) {
    return i.format(e2);
  }
  function l(e2) {
    let [t2, r2, n2] = e2.split("-").map(Number);
    return [t2, r2, n2];
  }
  function s(e2) {
    if ("string" != typeof e2 || !/^\d{4}-\d{2}-\d{2}$/.test(e2)) return false;
    let [t2, r2, n2] = l(e2), o2 = new Date(Date.UTC(t2, r2 - 1, n2));
    return o2.getUTCFullYear() === t2 && o2.getUTCMonth() === r2 - 1 && o2.getUTCDate() === n2;
  }
  function c(e2) {
    let [t2, r2, n2] = l(o), [i2, a2, s2] = l(e2);
    return Math.round((Date.UTC(i2, a2 - 1, s2) - Date.UTC(t2, r2 - 1, n2)) / 864e5) + 1;
  }
  function u(e2, t2) {
    let [r2, n2, o2] = l(e2);
    return new Date(Date.UTC(r2, n2 - 1, o2 + t2)).toISOString().slice(0, 10);
  }
  e.s(["EPOCH_DATE", 0, o, "addDays", 0, u, "dayNumberFor", 0, c, "etDateString", 0, a, "isValidDateString", 0, s, "nextResetISO", 0, function(e2 = /* @__PURE__ */ new Date()) {
    return (function(e3) {
      for (let t2 of ["-04:00", "-05:00"]) {
        let r2 = /* @__PURE__ */ new Date(`${e3}T00:00:00${t2}`);
        if (i.format(r2) === e3 && "00" === new Intl.DateTimeFormat("en-US", { timeZone: n, hour: "2-digit", hourCycle: "h23" }).format(r2)) return r2;
      }
      return /* @__PURE__ */ new Date(`${e3}T00:00:00-05:00`);
    })(u(a(e2), 1)).toISOString();
  }], 98284);
  let d = "krillion:progress-changed", p = "krillion:progress-downloaded";
  function g(e2) {
    return `${e2.kind}:${e2.scope}:${String(e2.game).padStart(10, "0")}`;
  }
  function h(e2) {
    return `${e2.results ? "2" : e2.prompts ? "1" : "0"}:${JSON.stringify(e2).replace(/[^\x20-\x7e]/g, (e3) => `\\u${e3.charCodeAt(0).toString(16).padStart(4, "0")}`)}`;
  }
  function f(...e2) {
    let t2 = /* @__PURE__ */ new Map();
    for (let r2 of e2.flat()) {
      let e3 = g(r2), n2 = t2.get(e3);
      t2.set(e3, n2 ? r2.score > n2.score || r2.score === n2.score && h(r2) > h(n2) ? r2 : n2 : r2);
    }
    return [...t2.values()].sort((e3, t3) => g(e3).localeCompare(g(t3)));
  }
  let m = (e2, t2) => "string" == typeof e2 && e2.length <= t2, w = (e2) => !!e2 && "object" == typeof e2 && !Array.isArray(e2);
  function y(e2, t2 = a()) {
    if (!w(e2)) return null;
    let { kind: n2, scope: i2, game: l2, tiers: u2 } = e2;
    if ("daily" !== n2 && "archive" !== n2 && "pack" !== n2 || !m(i2, 64) || !Number.isSafeInteger(l2) || l2 < 1 || l2 > 1e5 || "daily" === n2 && (!s(i2) || i2 < o || i2 > t2 || c(i2) !== l2) || "archive" === n2 && ("archive" !== i2 || l2 >= c(t2)) || "pack" === n2 && !/^[a-z][a-z0-9-]{0,39}$/.test(i2) || !Array.isArray(u2) || u2.length !== r.ROUNDS_PER_DAY || !u2.every((e3) => "miss" === e3 || "string" == typeof e3 && Object.hasOwn(r.TIERS, e3))) return null;
    let d2 = u2.reduce((e3, t3) => e3 + ("miss" === t3 ? 0 : r.TIERS[t3].score), 0);
    if (d2 !== e2.score) return null;
    let p2 = { kind: n2, scope: i2, game: l2, score: d2, tiers: [...u2] };
    if (void 0 !== e2.prompts) {
      if (!Array.isArray(e2.prompts) || e2.prompts.length !== r.ROUNDS_PER_DAY || !e2.prompts.every((e3) => m(e3, 1e3))) return null;
      p2.prompts = [...e2.prompts];
    }
    if (void 0 !== e2.results) {
      if (!Array.isArray(e2.results) || e2.results.length !== r.ROUNDS_PER_DAY) return null;
      let t3 = [];
      for (let [n3, o2] of e2.results.entries()) {
        if (!w(o2) || !m(o2.promptId, 128) || !m(o2.promptText, 1e3) || !(null === o2.rawAnswer || m(o2.rawAnswer, 1e3)) || !(null === o2.answer || m(o2.answer, 1e3)) || o2.tier !== ("miss" === u2[n3] ? null : u2[n3]) || o2.score !== (null === o2.tier ? 0 : r.TIERS[o2.tier].score) || void 0 !== o2.quip && !m(o2.quip, 1e3)) return null;
        t3.push({ promptId: o2.promptId, promptText: o2.promptText, rawAnswer: o2.rawAnswer, answer: o2.answer, tier: o2.tier, score: o2.score, ...o2.quip ? { quip: o2.quip } : {} });
      }
      p2.results = t3, p2.prompts = t3.map((e3) => e3.promptText);
    }
    if (void 0 !== e2.version) {
      if (!m(e2.version, 128)) return null;
      p2.version = e2.version;
    }
    return "daily" !== n2 || p2.results ? p2 : null;
  }
  function b(e2, t2 = a(), r2 = []) {
    let n2 = (e3) => s(e3) && e3 <= t2, o2 = Object.keys(e2).filter(n2).sort(), i2 = [.../* @__PURE__ */ new Set([...o2, ...[...r2].filter(n2)])].sort(), l2 = 0, c2 = 0;
    for (let t3 of o2) l2 += e2[t3].score, c2 = Math.max(c2, e2[t3].score);
    let d2 = 0, p2 = 0, g2 = null;
    for (let e3 of i2) p2 = Math.max(p2, d2 = g2 && u(g2, 1) === e3 ? d2 + 1 : 1), g2 = e3;
    let h2 = g2 === t2 || g2 === u(t2, -1) ? d2 : 0;
    return { history: e2, gamesPlayed: o2.length, totalScore: l2, bestScore: c2, currentStreak: h2, maxStreak: p2, lastPlayedDate: g2 };
  }
  e.s(["PROGRESS_CHANGED", 0, d, "PROGRESS_DOWNLOADED", 0, p, "SYNC_BATCH_SIZE", 0, 50, "mergeCompletions", 0, f, "parseCompletion", 0, y, "progressKey", 0, g, "progressTie", 0, h, "statsFromHistory", 0, b], 95219);
  let k = "krillion:account-owner:v1", T = "krillion:progress-owner-changed";
  function v() {
    if (void 0 !== t) return t;
    try {
      t = localStorage.getItem(k);
    } catch {
      t = null;
    }
    return t;
  }
  function E(e2, t2 = v()) {
    return t2 ? `krillion:account:${encodeURIComponent(t2)}:${e2}` : e2;
  }
  e.s(["ACCOUNT_OWNER_KEY", 0, k, "PROGRESS_OWNER_CHANGED", 0, T, "progressOwner", 0, v, "progressStorageKey", 0, E, "selectProgressOwner", 0, function(e2) {
    e2 ? localStorage.setItem(k, e2) : localStorage.removeItem(k), t = e2, window.dispatchEvent?.(new Event(T));
  }], 33827);
  let S = "krillion:game:v1", A = "krillion:stats:v1", O = "krillion:player:v1", L = /* @__PURE__ */ new Map();
  function D(e2, t2 = v()) {
    try {
      let r2 = E(e2, t2), n2 = L.get(r2) ?? window.localStorage.getItem(r2);
      return n2 ? JSON.parse(n2) : null;
    } catch {
      return null;
    }
  }
  function I(e2, t2, r2 = true) {
    let n2 = E(e2), o2 = JSON.stringify(t2);
    try {
      window.localStorage.setItem(n2, o2), L.delete(n2);
    } catch {
      L.set(n2, o2);
    }
    r2 && (e2 === A || e2.endsWith("-done")) && window.dispatchEvent?.(new Event(d));
  }
  function N(e2) {
    let t2 = E(e2);
    try {
      window.localStorage.removeItem(t2), L.delete(t2);
    } catch {
      L.set(t2, "null");
    }
  }
  function C(e2) {
    let t2 = D(S);
    return t2 && t2.date === e2 ? t2 : null;
  }
  function P() {
    N(S);
  }
  let R = /* @__PURE__ */ new Set(["2026-09-29"]), $ = "krillion:voided-zero-days:v1", U = "krillion:voided-zero-cleared:v1";
  function H() {
    return D(U) ?? [];
  }
  function z(e2, t2) {
    return R.has(e2) && 0 === t2.score && t2.tiers.every((e3) => "miss" === e3);
  }
  function x(e2) {
    return !!e2 && "done" === e2.phase && e2.results.length === r.ROUNDS_PER_DAY;
  }
  function G(e2, t2) {
    return { score: e2.reduce((e3, t3) => e3 + t3.score, 0), tiers: e2.map((e3) => e3.tier ?? "miss"), prompts: e2.map((e3) => e3.promptText), results: e2.map((e3) => {
      let t3 = { ...e3 };
      return delete t3.receipt, t3;
    }), ...t2 ? { version: t2 } : {} };
  }
  let K = "krillion-unlimited-done", M = "classic", _ = (e2, t2) => e2 === M ? `krillion-unlimited-${t2}` : `krillion-pack-${e2}-${t2}`, V = (e2) => e2 === M ? K : `krillion-pack-${e2}-done`;
  function Y(e2) {
    return D(V(e2)) ?? {};
  }
  let B = "krillion-archive-", W = "krillion-archive-done";
  function j() {
    return D(W) ?? {};
  }
  function F() {
    return b(D(A)?.history ?? {}, void 0, H());
  }
  function J(e2 = v()) {
    let t2 = [], r2 = (e3) => {
      let r3 = y(e3);
      r3 && t2.push(r3);
    }, n2 = D(A, e2);
    for (let [e3, t3] of Object.entries(n2?.history ?? {})) r2({ ...t3, kind: "daily", scope: e3, game: t3.dayNumber });
    let o2 = /* @__PURE__ */ new Set();
    try {
      for (let e3 = 0; e3 < localStorage.length; e3++) {
        let t3 = localStorage.key(e3);
        t3 && o2.add(t3);
      }
    } catch {
    }
    for (let e3 of L.keys()) o2.add(e3);
    let i2 = e2 ? E("", e2) : "";
    for (let t3 of o2) {
      if (!t3.startsWith(i2)) continue;
      let n3 = t3.slice(i2.length), o3 = /^krillion-pack-([a-z][a-z0-9-]*)-done$/.exec(n3), a2 = n3 === W;
      if (!a2 && n3 !== K && !o3) continue;
      let l2 = a2 ? "archive" : o3?.[1] ?? M;
      for (let [t4, o4] of Object.entries(D(n3, e2) ?? {})) {
        let n4 = D(a2 ? `${B}${t4}` : _(l2, Number(t4)), e2), i3 = x(n4) && n4.results.reduce((e3, t5) => e3 + t5.score, 0) === o4.score && JSON.stringify(n4.results.map((e3) => e3.tier ?? "miss")) === JSON.stringify(o4.tiers) && (!o4.prompts || JSON.stringify(n4.results.map((e3) => e3.promptText)) === JSON.stringify(o4.prompts)) ? n4.results : void 0;
        r2({ ...o4, results: o4.results ?? i3, version: o4.version ?? (i3 ? n4?.version : void 0), kind: a2 ? "archive" : "pack", scope: l2, game: Number(t4) });
      }
    }
    return f(t2);
  }
  let q = "krillion-unlock", X = "krillion:purchases-changed", Z = /* @__PURE__ */ new Map(), Q = (e2) => e2 === M ? q : `krillion-unlock-${e2}`;
  function ee(e2, t2 = v()) {
    try {
      let r2 = E(Q(e2), t2);
      return Z.get(r2) ?? localStorage.getItem(r2);
    } catch {
      return null;
    }
  }
  function et(e2, t2) {
    let r2 = E(Q(e2));
    try {
      localStorage.setItem(r2, t2), Z.delete(r2);
    } catch {
      Z.set(r2, t2);
    }
    window.dispatchEvent?.(new Event(X));
  }
  let er = "krillion-google-linked";
  e.s(["PURCHASES_CHANGED", 0, X, "applyCompletedHistory", 0, function(e2) {
    e2 = e2.filter((e3) => !("daily" === e3.kind && z(e3.scope, e3)));
    let t2 = J(), r2 = f(t2, e2);
    if (JSON.stringify(t2) === JSON.stringify(r2)) return;
    let n2 = { ...F().history }, o2 = /* @__PURE__ */ new Map();
    for (let e3 of r2) if ("daily" === e3.kind) {
      let r3 = t2.find((t3) => "daily" === t3.kind && t3.scope === e3.scope);
      if (r3 && h(r3) === h(e3) && n2[e3.scope]) continue;
      n2[e3.scope] = { dayNumber: e3.game, score: e3.score, tiers: e3.tiers, results: e3.results, imported: true };
    } else {
      let t3 = "archive" === e3.kind ? W : V(e3.scope), r3 = o2.get(t3) ?? D(t3) ?? {};
      r3[e3.game] = { score: e3.score, tiers: e3.tiers, ...e3.prompts ? { prompts: e3.prompts } : {}, ...e3.results ? { results: e3.results } : {}, ...e3.version ? { version: e3.version } : {} }, o2.set(t3, r3);
    }
    for (let [e3, t3] of (I(A, b(n2, void 0, H()), false), o2)) I(e3, t3, false);
    window.dispatchEvent?.(new Event(p));
  }, "clearArchiveGame", 0, function(e2) {
    N(`${B}${e2}`);
  }, "clearGame", 0, P, "clearPackGame", 0, function(e2, t2) {
    N(_(e2, t2));
  }, "completedHistory", 0, J, "devResetDay", 0, function(e2) {
  }, "getPlayerId", 0, function() {
    let e2 = D(O);
    return e2 || I(O, e2 = "u" > typeof crypto && "randomUUID" in crypto ? crypto.randomUUID() : `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`), e2;
  }, "hasAnyPurchase", 0, function() {
    let e2 = E(q), t2 = (t3) => t3 === e2 || t3.startsWith(`${e2}-`);
    if ([...Z].some(([e3, r2]) => t2(e3) && !!r2.trim())) return true;
    try {
      for (let e3 = 0; e3 < localStorage.length; e3++) {
        let r2 = localStorage.key(e3);
        if (r2 && t2(r2) && localStorage.getItem(r2)?.trim()) return true;
      }
    } catch {
    }
    return false;
  }, "isFinishedGame", 0, x, "loadArchiveDone", 0, j, "loadArchiveGame", 0, function(e2) {
    let t2 = D(`${B}${e2}`);
    return t2 && t2.game === e2 ? t2 : null;
  }, "loadArchiveHistory", 0, function() {
    let e2 = { ...j() };
    for (let t2 of Object.values(F().history)) {
      let r2 = e2[t2.dayNumber];
      (!r2 || t2.score > r2.score) && (e2[t2.dayNumber] = { score: t2.score, tiers: t2.tiers, results: t2.results });
    }
    return e2;
  }, "loadGame", 0, C, "loadGoogleLinked", 0, function() {
    try {
      return "1" === localStorage.getItem(er);
    } catch {
      return false;
    }
  }, "loadPackDone", 0, Y, "loadPackGame", 0, function(e2, t2) {
    let r2 = D(_(e2, t2));
    return r2 && r2.game === t2 ? r2 : null;
  }, "loadPackUnlockToken", 0, ee, "loadStats", 0, F, "loadUnlockToken", 0, function(e2 = v()) {
    return ee(M, e2);
  }, "nextUnstartedGame", 0, function(e2, t2, r2 = 1) {
    let n2 = r2;
    for (; e2[n2] || (t2(n2)?.phase ?? "intro") !== "intro"; ) n2++;
    return n2;
  }, "recordArchiveDone", 0, function(e2, t2, r2) {
    let n2 = j(), o2 = G(t2, r2);
    if (n2[e2] && n2[e2].score >= o2.score) return n2;
    let i2 = { ...n2, [e2]: o2 };
    return I(W, i2), i2;
  }, "recordFinishedDay", 0, function(e2, t2, r2, n2) {
    let o2 = F(), i2 = r2.reduce((e3, t3) => e3 + t3.score, 0);
    if (o2.history[e2] && o2.history[e2].score >= i2) return o2;
    let a2 = { ...n2 ? { runId: n2 } : {}, dayNumber: t2, score: i2, tiers: r2.map((e3) => e3.tier ?? "miss"), results: r2 }, l2 = b({ ...o2.history, [e2]: a2 }, void 0, H());
    return I(A, l2), l2;
  }, "recordPackDone", 0, function(e2, t2, r2, n2) {
    let o2 = Y(e2), i2 = G(r2, n2);
    if (o2[t2] && o2[t2].score >= i2.score) return o2;
    let a2 = { ...o2, [t2]: i2 };
    return I(V(e2), a2), a2;
  }, "saveArchiveGame", 0, function(e2) {
    I(`${B}${e2.game}`, e2);
  }, "saveGame", 0, function(e2) {
    I(S, e2);
  }, "saveGoogleLinked", 0, function() {
    try {
      localStorage.setItem(er, "1");
    } catch {
    }
  }, "savePackGame", 0, function(e2, t2) {
    I(_(e2, t2.game), t2);
  }, "savePackUnlockToken", 0, et, "saveUnlockToken", 0, function(e2) {
    et(M, e2);
  }, "sparseDoneResults", 0, function(e2, t2) {
    let n2 = Array.isArray(e2.tiers) ? e2.tiers : [], o2 = Array.isArray(e2.prompts) && e2.prompts.length === t2.length && e2.prompts.every((e3) => "string" == typeof e3 && "" !== e3.trim()) ? e2.prompts : null;
    return t2.map((e3, t3) => {
      let i2 = n2[t3] ?? "miss";
      return { promptId: e3.id, promptText: o2 ? o2[t3] : e3.text, rawAnswer: null, answer: null, tier: "miss" === i2 ? null : i2, score: "miss" === i2 ? 0 : r.TIERS[i2].score };
    });
  }, "voidOutageZeroDay", 0, function(e2) {
    if (!R.has(e2)) return false;
    let t2 = D($) ?? [];
    if (t2.includes(e2)) return false;
    let r2 = false, n2 = F(), o2 = n2.history[e2];
    if (o2 && z(e2, o2)) {
      let t3 = { ...n2.history };
      delete t3[e2];
      let o3 = [.../* @__PURE__ */ new Set([...H(), e2])];
      I(U, o3, false), I(A, b(t3, void 0, o3)), r2 = true;
    }
    let i2 = C(e2);
    return i2 && i2.results.length > 0 && i2.results.every((e3) => !e3.tier) && (P(), r2 = true), I($, [...t2, e2], false), r2;
  }, "voidedStreakDates", 0, H], 37812);
}, 55067, 70246, (e) => {
  "use strict";
  var t = e.i(48992);
  let r = "https://buy.stripe.com/7sYdR833CgrJ3XZcR5eEo02";
  e.s(["UNLOCK_URL", 0, r], 70246);
  let n = { world: "hollywood", sky: "/gen/optimized/v1/cards/movies.webp", hills: "/gen/optimized/v1/hollywood/hills.webp", moon: "/gen/hollywood/moon.png", sign: "/gen/hollywood/sign.png", far: "/gen/optimized/v1/hollywood/bg-far.webp", mid: [{ from: 0, imgs: ["/gen/optimized/v1/hollywood/bg-mid.webp", "/gen/optimized/v1/hollywood/bg-mid-b.webp", "/gen/optimized/v1/hollywood/bg-mid-c.webp"] }, { from: 950, imgs: ["/gen/optimized/v1/hollywood/bg-mid-neon.webp", "/gen/optimized/v1/hollywood/bg-mid-neon-b.webp"] }, { from: 2950, imgs: ["/gen/optimized/v1/hollywood/bg-mid-hills.webp", "/gen/optimized/v1/hollywood/bg-mid-hills-b.webp"] }, { from: 5450, imgs: ["/gen/optimized/v1/hollywood/bg-mid-neon-b.webp", "/gen/optimized/v1/hollywood/bg-mid-neon.webp"] }], lamp: "/gen/hollywood/lamp.png?v=11", buddyCar: "/gen/hollywood/buddy-car.png", buddyCarGold: "/gen/hollywood/buddy-car-gold.png", gate: "/gen/optimized/v1/hollywood/gate.webp", premiere: "/gen/optimized/v1/hollywood/premiere.webp", skyTint: ["#030d33", "#131c52", "#1d2a75"], ambient: [], dust: ["232,214,180", "255,233,168"], particle: "255,229,180", sparkle: "#ffd166", copy: { promptWord: "SCENE", surfaceLabel: "THE STUDIO GATE", completeLabel: "THAT'S A WRAP", hint: "&#9654; rarer answers drive farther &#9654;", driveVerb: "drive", hudLabel: "BLOCK", fmtDist: (e2) => {
    let t2 = e2 / 10, r2 = Number.isInteger(t2) ? String(t2) : t2.toFixed(1);
    return `${r2} block${1 === t2 ? "" : "s"}`;
  }, missTitle: "DIDN'T MAKE THE CUT", tourLabel: "LOCATION SCOUT" } }, o = [{ id: "classic", hubArt: "/gen/optimized/v1/cards/classic.webp", href: "/unlimited/classic", name: "THE ENDLESS DIVE", hubTagline: "every prompt, every depth \xB7 the original \u221E", hubCta: "DESCEND \u221E \u2193", hubOpen: "OPEN WATERS", hubDone: (e2) => `${e2} dive${1 === e2 ? "" : "s"} surfaced`, tagline: "THE ENDLESS DIVE", subline: "dive after dive \xB7 rarer answers sink deeper", badge: "\u221E", diveLabel: "endless dive", theme: t.OCEAN_THEME, ui: { accent: "#4de3ff", boot: "descending\u2026", begin: "\u25BC BEGIN DESCENT \u25BC", submit: "DIVE", descend: "DESCEND \u25BC", surface: "SURFACE \u25B2", previewPrefix: "descending \xB7 the clock starts in", reject: (e2) => `"${e2}": no echo. try again`, unit: "m", doneHeadline: (e2) => `\u221E Dive #${e2} complete`, next: "NEXT DIVE \u221E \u2193", catchLabel: "the catch", bearingLabel: "the bearing", gaugeTitle: "dive log", gaugeUnit: "m", revealLoading: "sounding the depths\u2026" }, introLinks: [{ href: "/archive", label: "ARCHIVE \u27F2" }, { href: "/", label: "TODAY'S DIVE" }], apiBase: "/api/unlimited", payUrl: r, priceLabel: "$5", lockTitle: "the ocean continues", lockCta: "UNLOCK UNLIMITED \xB7 $5" }, { id: "movies", hubArt: "/gen/optimized/v1/cards/movies.webp", href: "/movies", name: "AT THE MOVIES", hubTagline: "30 pictures \xB7 a night drive down the boulevard", hubCta: "TAKE THE DRIVE \u2192", hubOpen: "NOW SHOWING", hubDone: (e2) => `${e2} picture${1 === e2 ? "" : "s"} wrapped`, tagline: "AT THE MOVIES", subline: "30 pictures \xB7 rarer answers drive farther", badge: "\u{1F3AC}", diveLabel: "picture", theme: n, ui: { accent: "#ffd166", boot: "warming up the projector\u2026", begin: "\u25BA START THE DRIVE \u25BA", submit: "ACTION", descend: "DRIVE ON \u2192", surface: "ROLL CREDITS", previewPrefix: "quiet on set \xB7 rolling in", reject: (e2) => `"${e2}": cut \u2014 not in this picture. try again`, unit: " blocks", dist: (e2) => {
    let t2 = e2 / 10, r2 = Number.isInteger(t2) ? String(t2) : t2.toFixed(1);
    return `${r2} blocks`;
  }, doneHeadline: (e2) => `Picture #${e2} \u2014 that's a wrap`, next: "NEXT PICTURE \u2192", catchLabel: "the final cut", bearingLabel: "the billing", gaugeTitle: "the route", gaugeUnit: "blk", gaugeSub: "farther = rarer", gaugeTick: (e2) => 0 === e2 ? "gate" : `${10 * e2} blk`, bandVerdicts: { 0: "Straight to video. The boulevard is still long.", 151: "A solid matinee. The crowd nods along.", 251: "Festival darling. Critics take notes.", 351: "Cult classic. Midnight screenings forever.", 450: "One in a krillion. Your star is on the boulevard." }, subCopy: { blurbs: { schooler: "Solid \u2014 steady box office.", krillion: "The designated gem. End of the boulevard." }, missTyped: "left on the cutting-room floor." }, pickerLabel: "choose a different picture", pickerGo: "Screen it", replayNote: (e2, t2) => `you wrapped #${e2} with ${t2} \xB7 driving again replays it`, revealLoading: "rolling the credits\u2026" }, introLinks: [{ href: "/packs", label: "THEMED PACKS" }, { href: "/", label: "THE DAILY DIVE" }], apiBase: "/api/packs/movies", payUrl: "https://buy.stripe.com/cNiaEWgUs1wP6676sHeEo05", priceLabel: "$5", lockTitle: "the boulevard continues", lockCta: "UNLOCK AT THE MOVIES \xB7 $5" }, { id: "sports", hubArt: "/gen/optimized/v1/cards/sports.webp", href: "/sports", name: "SPORTS", hubTagline: "30 games \xB7 run the gauntlet, court to podium", hubCta: "TAKE THE TUNNEL \u2193", hubOpen: "GAME ON", hubDone: (e2) => `${e2} game${1 === e2 ? "" : "s"} in the books`, tagline: "THE DEEP BENCH", subline: "30 games \xB7 rarer answers run farther", badge: "\u{1F3C6}", diveLabel: "game", theme: { world: "gauntlet", sky: "/gen/optimized/v1/cards/sports.webp", farBowl: "/gen/optimized/v1/gauntlet/bowl-far.webp", divider: "/gen/gauntlet/divider.png", venues: [{ from: -60, to: 700, surface: "hardwood", pane: "/gen/gauntlet/floor-hardwood.png" }, { from: 760, to: 1400, surface: "clay", pane: "/gen/optimized/v1/gauntlet/floor-clay.webp" }, { from: 1460, to: 2260, surface: "ice", pane: "/gen/optimized/v1/gauntlet/floor-ice.webp" }, { from: 2320, to: 3220, surface: "pitch", pane: "/gen/optimized/v1/gauntlet/floor-pitch.webp" }, { from: 3280, to: 4230, surface: "gridiron", pane: "/gen/optimized/v1/gauntlet/floor-gridiron.webp" }, { from: 4290, to: 5040, surface: "pool", pane: "/gen/optimized/v1/gauntlet/floor-pool.webp" }, { from: 5100, to: 5600, surface: "track", pane: "/gen/optimized/v1/gauntlet/floor-track.webp" }], tunnel: "/gen/optimized/v1/gauntlet/tunnel.webp", podium: "/gen/optimized/v1/gauntlet/podium.webp", skyTint: ["#04060b", "#0a0f1a", "#131c2c"], ambient: [], dust: ["226,232,244", "255,240,210"], particle: "255,213,130", sparkle: "#ffb000", confetti: ["#ffb000", "#ffd166", "#ff3b30", "#e8eef5", "#4de3ff"], copy: { promptWord: "ROUND", surfaceLabel: "THE TUNNEL", completeLabel: "FULL TIME", hint: "&#9654; rarer answers run farther &#9654;", driveVerb: "run", hudLabel: "YARD", fmtDist: (e2) => `${e2} yards`, missTitle: "WAVED OFF" } }, ui: { accent: "#ffb000", boot: "cutting the stadium lights\u2026", begin: "\u25BA TAKE THE TUNNEL \u25BA", submit: "SHOOT", descend: "RUN ON \u2192", surface: "FINAL WHISTLE", previewPrefix: "warming up \xB7 tip-off in", reject: (e2) => `"${e2}": waved off. try again`, unit: " yds", dist: (e2) => `${e2} yards`, doneHeadline: (e2) => `Game #${e2} \u2014 full time`, next: "NEXT GAME \u2192", catchLabel: "the box score", bearingLabel: "the scouting report", gaugeTitle: "the depth chart", gaugeUnit: "yds", gaugeSub: "farther = rarer", gaugeTick: (e2) => 0 === e2 ? "tunnel" : `${700 * e2} yds`, bandVerdicts: { 0: "Sent down to the practice squad. Run it back.", 151: "Solid starter. The tape holds up.", 251: "All-conference. Past midfield and pulling away.", 351: "Hall of Fame ballot. The jumbotron knows your name.", 450: "One in a krillion. Top of the podium." }, subCopy: { blurbs: { schooler: "Solid \u2014 makes the highlight reel.", krillion: "The designated gem. Raised at the podium." }, missTyped: "cut at training camp." }, pickerLabel: "choose a different game", pickerGo: "Play it", replayNote: (e2, t2) => `you closed #${e2} at ${t2} \xB7 playing again replays it`, revealLoading: "going to the replay booth\u2026" }, introLinks: [{ href: "/packs", label: "THEMED PACKS" }, { href: "/", label: "THE DAILY DIVE" }], apiBase: "/api/packs/sports", payUrl: "https://buy.stripe.com/fZufZggUsejB1PRdV9eEo06", priceLabel: "$5", lockTitle: "the season continues", lockCta: "UNLOCK THE DEEP BENCH \xB7 $5" }, { id: "geography", hubArt: "/gen/optimized/v1/cards/geography.webp", href: "/geography", name: "GEOGRAPHY", hubTagline: "30 expeditions \xB7 around the world in seven answers", hubCta: "SET OUT \u2192", hubOpen: "PASSPORT READY", hubDone: (e2) => `${e2} expedition${1 === e2 ? "" : "s"} logged`, tagline: "GEOGRAPHY", subline: "around the world in seven answers", badge: "\u{1F9ED}", diveLabel: "expedition", theme: { world: "globe", sky: "/gen/optimized/v1/cards/geography.webp", continents: [{ from: 16, to: 100, zone: "savanna", pane: "/gen/optimized/v1/atlas/scene-savanna.webp" }, { from: 100, to: 186, zone: "amazon", pane: "/gen/optimized/v1/atlas/scene-amazon.webp" }, { from: 186, to: 272, zone: "alps", pane: "/gen/optimized/v1/atlas/scene-alps.webp" }, { from: 272, to: 356, zone: "greatwall", pane: "/gen/optimized/v1/atlas/scene-greatwall.webp" }, { from: 356, to: 442, zone: "outback", pane: "/gen/optimized/v1/atlas/scene-outback.webp" }, { from: 442, to: 526, zone: "canyon", pane: "/gen/optimized/v1/atlas/scene-canyon.webp" }, { from: 526, to: 608, zone: "antarctica", pane: "/gen/optimized/v1/atlas/scene-antarctica.webp" }], baseCamp: "/gen/atlas/basecamp.png", pole: "/gen/atlas/pole.png", skyTint: ["#020308", "#070a14", "#0e1424"], ambient: [[4, "the kettle sings you off", "R"], [40, "the acacias keep their counsel", "L"], [70, "eyes shine in the tall grass", "R"], [106, "THE RAINFOREST", "L", true], [140, "the canopy closes overhead", "R"], [170, "the river talks in its sleep", "L"], [192, "THE ALPS", "R", true], [225, "thin air, honest stars", "L"], [250, "a castle keeps one window lit", "R"], [278, "THE GREAT WALL", "R", true], [310, "watchtowers count you through", "L"], [340, "lanterns climb the dark", "L"], [362, "THE OUTBACK", "R", true], [395, "red earth, still warm", "L"], [420, "a boomerang comes back. so will you", "R"], [448, "THE CANYON", "R", true], [480, "the milky way pours into the gorge", "L"], [532, "THE ICE", "R", true], [562, "the aurora clears its throat", "L"], [592, "every compass agrees: keep going", "R"], [652, "the last sea &mdash; home is over the horizon", "L"], [688, "the kettle. the tent. the whole world behind you", "L", true]], particle: "255,213,150", confetti: ["#ff6b3d", "#ffd166", "#7dffb0", "#e8eef5", "#4de3ff"], copy: { promptWord: "LEG", surfaceLabel: "BASE CAMP", completeLabel: "HOME AGAIN", hint: "&#9654; rarer answers carry you farther round &#9654;", driveVerb: "trek", hudLabel: "LEAGUES", fmtDist: (e2) => `${e2} league${1 === e2 ? "" : "s"}`, missTitle: "DEAD END" } }, ui: { accent: "#ff6b3d", boot: "spinning up the world\u2026", begin: "\u25BA SET OUT \u25BA", submit: "TREK", descend: "PRESS ON \u2192", surface: "STRIKE CAMP", previewPrefix: "checking the compass \xB7 departure in", reject: (e2) => `"${e2}": not on this map. try again`, unit: " leagues", dist: (e2) => `${e2} leagues`, doneHeadline: (e2) => `Expedition #${e2} \u2014 home again`, next: "NEXT EXPEDITION \u2192", catchLabel: "the field notes", bearingLabel: "the traveler's log", gaugeTitle: "the circumnavigation", gaugeUnit: "\xB0", gaugeSub: "farther = rarer", gaugeTick: (e2) => 0 === e2 ? "base camp" : 1 === e2 ? "home" : `${Math.round(360 * e2)}\xB0`, bandVerdicts: { 0: "Never left the harbor. The world stayed still.", 151: "A stamped passport and a sunburn. Respectable.", 251: "Three continents under your feet. The compass trusts you now.", 351: "The horizon keeps giving way. Home is closer ahead than behind.", 450: "One in a krillion. Around the world in seven answers." }, subCopy: { blurbs: { schooler: "Solid \u2014 the route holds.", krillion: "The designated gem. The world turns for you." }, missTyped: "left off the itinerary." }, pickerLabel: "choose a different expedition", pickerGo: "Set out", replayNote: (e2, t2) => `you logged #${e2} at ${t2} \xB7 trekking again replays it`, revealLoading: "consulting the atlas\u2026" }, introLinks: [{ href: "/packs", label: "THEMED PACKS" }, { href: "/", label: "THE DAILY DIVE" }], apiBase: "/api/packs/geography", payUrl: "https://buy.stripe.com/28E00i5bKcbtcuv9ETeEo07", priceLabel: "$5", lockTitle: "the world is wider", lockCta: "UNLOCK GEOGRAPHY \xB7 $5" }, { id: "lexicon", hubArt: "/gen/optimized/v1/cards/lexicon.webp", href: "/lexicon", name: "Words & Language (English)", hubTagline: "30 chapters \xB7 fill the notebook, word by word", hubCta: "OPEN THE NOTEBOOK \u2192", hubOpen: "FREE FOR NOW", hubDone: (e2) => `${e2} chapter${1 === e2 ? "" : "s"} inked`, tagline: "THE LEXICON", subline: "30 chapters \xB7 rarer answers write more words", badge: "\u2712\uFE0F", diveLabel: "chapter", theme: { world: "notebook", sky: "/gen/optimized/v1/cards/lexicon.webp", deskPortrait: "/gen/optimized/v1/lexicon/desk-portrait.webp", deskLandscape: "/gen/optimized/v1/lexicon/desk-landscape.webp", notebook: "/gen/optimized/v1/lexicon/notebook.webp", writer: "/gen/lexicon/krill-writer-clean.png", writerGold: "/gen/lexicon/krill-writer-clean-gold.png", ink: "#2a3466", goldInk: "#c29a2e", particle: "125,156,255", confetti: ["#f2e7c6", "#7d9cff", "#ffd166", "#ff6b3d", "#e8eef5"], copy: { promptWord: "ENTRY", surfaceLabel: "A BLANK PAGE", completeLabel: "THE INK IS DRY", hint: "&#9654; rarer answers write more words &#9654;", driveVerb: "pen", hudLabel: "PAGE", fmtDist: (e2) => `${e2} word${1 === e2 ? "" : "s"}`, missTitle: "LOST FOR WORDS" } }, ui: { accent: "#7d9cff", boot: "uncapping the pen\u2026", begin: "\u25BA OPEN THE NOTEBOOK \u25BA", submit: "WRITE", descend: "WRITE ON \u2192", surface: "CLOSE THE BOOK", previewPrefix: "dipping the pen \xB7 ink flows in", reject: (e2) => `"${e2}": not in the lexicon. try again`, unit: " words", dist: (e2) => `${e2} words`, doneHeadline: (e2) => `Chapter #${e2} \u2014 the ink is dry`, next: "NEXT CHAPTER \u2192", catchLabel: "the glossary", bearingLabel: "the marginalia", gaugeTitle: "the manuscript", gaugeUnit: "wds", gaugeSub: "fuller = rarer", gaugeTick: (e2) => 0 === e2 ? "page one" : 1 === e2 ? "the last page" : `${700 * e2} wds`, bandVerdicts: { 0: "A doodle in the margin. The page waits.", 151: "A tidy paragraph. The nib is warming up.", 251: "Pages turn on their own now. The inkwell worries.", 351: "Half the notebook in one sitting. Ink-stained fingers.", 450: "One in a krillion. Bound, shelved, quoted." }, subCopy: { blurbs: { schooler: "Solid \u2014 earns its line.", krillion: "The designated gem. Written in gold." }, missTyped: "left out of the lexicon." }, pickerLabel: "choose a different chapter", pickerGo: "Open it", replayNote: (e2, t2) => `you inked #${e2} at ${t2} \xB7 writing again replays it`, revealLoading: "blotting the page\u2026" }, introLinks: [{ href: "/packs", label: "THEMED PACKS" }, { href: "/", label: "THE DAILY DIVE" }], apiBase: "/api/packs/lexicon", payUrl: null, priceLabel: "$5", lockTitle: "the notebook has more pages", lockCta: "UNLOCK THE LEXICON \xB7 $5" }];
  e.s(["CLIENT_PACKS", 0, o, "HOLLYWOOD_THEME", 0, n, "clientPack", 0, function(e2) {
    return o.find((t2) => t2.id === e2) ?? o[0];
  }], 55067);
}, 45743, (e) => {
  "use strict";
  let t = { apiKey: "AIzaSyBaZVDjFZV4zv5OaOApvy-nVQSOl0bf_ok", authDomain: e.i(47167).default.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "krillion.io", projectId: "krillion-io", appId: "1:167885572463:web:e35c5630d193922e33409a" };
  async function r() {
    let { initializeApp: r2, getApps: n2 } = await e.A(28515), { getAuth: o } = await e.A(3975);
    return o(n2()[0] ?? r2(t));
  }
  async function n() {
    try {
      let t2 = await r(), { signInAnonymously: n2 } = await e.A(3975);
      return t2.currentUser || await n2(t2), await t2.currentUser?.getIdToken() ?? null;
    } catch {
      return null;
    }
  }
  e.s(["anonymousIdToken", 0, n, "firebaseAuth", 0, r, "withTimeout", 0, function(e2, t2 = 6e4) {
    return Promise.race([e2, new Promise((e3, r2) => setTimeout(() => r2(Error("auth-timeout")), t2))]);
  }]);
}, 33385, (e) => {
  "use strict";
  var t = e.i(33827), r = e.i(55067), n = e.i(37812);
  async function o(e2, i2 = (0, t.progressOwner)(), a) {
    return (await Promise.allSettled(r.CLIENT_PACKS.map(async (t2) => {
      let r2 = "classic" === t2.id ? (0, n.loadUnlockToken)(i2) : (0, n.loadPackUnlockToken)(t2.id, i2);
      if (!r2) return false;
      let o2 = r2.lastIndexOf(".");
      if (o2 <= 0) return false;
      let l = r2.slice(0, o2);
      if (!/^cs_/.test(l)) return false;
      let s = "classic" === t2.id ? "/api/unlock" : `/api/packs/${t2.id}/unlock`, c = await fetch(s, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: l, idToken: e2 }), signal: AbortSignal.timeout(2e4) });
      return c.ok && a?.(t2.id, r2), c.ok;
    }))).filter((e3) => "fulfilled" === e3.status && true === e3.value).length;
  }
  async function i(e2, i2, a) {
    let l = r.CLIENT_PACKS.filter((e3) => (0, n.loadPackUnlockToken)(e3.id, null)).length;
    if (!l || !a()) return { found: 0, linked: 0 };
    let s = "krillion:guest-purchase-owner:v1", c = localStorage.getItem(s);
    return c && c !== i2 ? { found: 0, linked: 0 } : (localStorage.setItem(s, i2), { found: l, linked: await o(e2, null, (e3, r2) => {
      a() && (0, t.progressOwner)() === i2 && !(0, n.loadPackUnlockToken)(e3) && (0, n.savePackUnlockToken)(e3, r2);
    }) });
  }
  e.s(["bindLocalPurchases", 0, o, "carryGuestPurchases", 0, i, "hasAnyLocalUnlock", 0, function() {
    return (0, n.hasAnyPurchase)();
  }]);
}, 67334, (e) => {
  "use strict";
  let t, r, n, o, i, a, l;
  var s, c = e.i(71645), u = e.i(45743), d = e.i(37812), p = e.i(33827), g = e.i(95219);
  async function h(e2) {
    let t2 = [], r2 = "", n2 = /* @__PURE__ */ new Set();
    for (; null !== r2; ) {
      if (!e2.current()) return;
      if (n2.has(r2)) throw Error("Invalid history cursor");
      n2.add(r2);
      let o3 = await e2.request(`/api/account/progress?after=${encodeURIComponent(r2)}`);
      if (!e2.current()) return;
      if (!Array.isArray(o3.records) || null !== o3.next && "string" != typeof o3.next) throw Error("Invalid history response");
      for (let e3 of o3.records) {
        let r3 = (0, g.parseCompletion)(e3);
        if (!r3) throw Error("Invalid saved game");
        t2.push(r3);
      }
      r2 = o3.next;
    }
    if (!e2.current()) return;
    e2.merge(t2), e2.onDownloaded?.();
    let o2 = new Map(t2.map((e3) => [(0, g.progressKey)(e3), (0, g.progressTie)(e3)])), i2 = (0, g.mergeCompletions)(e2.local()).filter((e3) => o2.get((0, g.progressKey)(e3)) !== (0, g.progressTie)(e3));
    for (let t3 = 0; t3 < i2.length; ) {
      if (!e2.current()) return;
      let r3 = [], n3 = 0;
      for (; t3 < i2.length && r3.length < g.SYNC_BATCH_SIZE; ) {
        let e3 = new TextEncoder().encode(JSON.stringify(i2[t3])).byteLength;
        if (r3.length && n3 + e3 > 5e5) break;
        r3.push(i2[t3++]), n3 += e3;
      }
      await e2.request("/api/account/progress", r3);
    }
  }
  var f = e.i(33385), m = e.i(55067);
  let w = { ready: false, user: null, status: "idle", error: null, lastSync: null, importCount: 0, importDismissed: false, purchaseMessage: null }, y = w, b = /* @__PURE__ */ new Set(), k = null, T = null, v = null, E = null, S = false, A = 0, O = null, L = (s = () => {
    let e2 = k;
    if (!e2) return null;
    let t2 = A;
    return { getIdToken: () => e2.getIdToken(), current: () => A === t2 && k?.uid === e2.uid && (0, p.progressOwner)() === e2.uid };
  }, n = null, o = 0, i = null, a = 0, l = 0, { refresh: function e2(t2 = false) {
    let c2 = s();
    if (!c2) return Promise.resolve();
    if (n) return n;
    if (Date.now() < a || null !== i && Date.now() - i < (t2 ? 3e4 : 3e5)) return Promise.resolve();
    let u2 = o, p2 = () => o === u2 && c2.current();
    return clearTimeout(r), n = (async () => {
      try {
        let e3 = await c2.getIdToken();
        if (!p2()) return;
        let t3 = await fetch("/api/account/purchases", { headers: { Authorization: `Bearer ${e3}` }, cache: "no-store", signal: AbortSignal.timeout(2e4) });
        if (!t3.ok) throw Error("Purchase refresh failed");
        let r2 = await t3.json();
        if (!r2?.packs || "object" != typeof r2.packs || Array.isArray(r2.packs)) throw Error("Invalid purchases");
        if (!p2()) return;
        for (let e4 of m.CLIENT_PACKS) {
          let t4 = r2.packs[e4.id];
          "string" == typeof t4 && t4 && t4 !== (0, d.loadPackUnlockToken)(e4.id) && (0, d.savePackUnlockToken)(e4.id, t4);
        }
        i = Date.now(), a = 0, l = 0;
      } catch {
        if (p2()) {
          let t3 = Math.min(5e3 * 2 ** Math.min(l++, 6), 3e5);
          a = Date.now() + t3, r = setTimeout(() => {
            p2() && e2();
          }, t3);
        }
      } finally {
        o === u2 && (n = null);
      }
    })();
  }, reset: function() {
    o++, n = null, i = null, a = 0, l = 0, clearTimeout(r);
  } }), D = (e2 = false) => L.refresh(e2);
  function I(e2) {
    y = { ...y, ...e2 }, b.forEach((e3) => e3());
  }
  let N = (e2) => `krillion:import-choice:${encodeURIComponent(e2)}`;
  function C() {
    I({ importCount: (0, d.completedHistory)(null).length, importDismissed: !!k && (function(e2) {
      try {
        return !!localStorage.getItem(N(e2));
      } catch {
        return false;
      }
    })(k.uid) });
  }
  async function P() {
    return T || (T = (async () => {
      let r2 = await (0, u.firebaseAuth)();
      await r2.authStateReady();
      let { onAuthStateChanged: n2 } = await e.A(3975), o2 = (e2) => {
        let r3 = e2?.providerData.some((e3) => "google.com" === e3.providerId) ? e2 : null;
        k = r3 && (0, p.progressOwner)() === r3.uid ? r3 : null, A++, L.reset(), clearTimeout(t), !k && (0, p.progressOwner)() && (0, p.selectProgressOwner)(null), I({ ready: true, user: k ? { uid: k.uid, email: k.email ?? "" } : null, status: "idle", error: null, lastSync: null }), C(), k && (U(), D());
      };
      o2(r2.currentUser), n2(r2, (e2) => {
        e2?.uid !== k?.uid && o2(e2);
      });
    })().catch(() => {
      T = null, I({ ready: true, status: "error", error: "Couldn\u2019t connect to Google. Try again." });
    }));
  }
  async function R() {
    await P();
    let e2 = k;
    return e2 && (0, p.progressOwner)() === e2.uid ? e2.getIdToken() : null;
  }
  async function $() {
    let t2 = await (0, u.firebaseAuth)();
    await t2.authStateReady();
    let { GoogleAuthProvider: r2, linkWithPopup: n2, signInWithPopup: o2 } = await e.A(3975), i2 = new r2(), a2 = t2.currentUser;
    if (a2?.isAnonymous) try {
      a2 = (await (0, u.withTimeout)(n2(a2, i2))).user;
    } catch (e2) {
      if (!["auth/credential-already-in-use", "auth/email-already-in-use"].includes(e2.code ?? "")) throw e2;
      a2 = (await (0, u.withTimeout)(o2(t2, i2))).user;
    }
    else a2?.providerData.some((e2) => "google.com" === e2.providerId) || (a2 = (await (0, u.withTimeout)(o2(t2, i2))).user);
    if (!a2) throw Error("Google sign-in did not complete.");
    O = null, (0, p.selectProgressOwner)(a2.uid), A++, L.reset(), k = a2, I({ ready: true, user: { uid: a2.uid, email: a2.email ?? "" }, error: null, purchaseMessage: null }), C(), await P(), U(), D();
    let l2 = a2, s2 = A, c2 = () => A === s2 && k?.uid === l2.uid && (0, p.progressOwner)() === l2.uid;
    try {
      let e2 = await (0, f.carryGuestPurchases)(await l2.getIdToken(), l2.uid, c2);
      c2() && e2.found && I({ purchaseMessage: e2.linked === e2.found ? "Your purchases are linked to Google and ready on this device." : "Some device purchases couldn\u2019t be linked. Use Restore purchases to retry." });
    } catch {
      c2() && I({ purchaseMessage: "Couldn\u2019t link device purchases. Use Restore purchases to retry." });
    }
  }
  async function U() {
    let e2;
    if (v) return S = true, v;
    let r2 = k;
    if (!r2) return;
    let n2 = A, o2 = () => A === n2 && k?.uid === r2.uid && (0, p.progressOwner)() === r2.uid;
    I({ status: "syncing", error: null }), clearTimeout(t);
    let i2 = { owner: r2.uid, pending: new Promise((t2) => {
      e2 = t2;
    }) };
    return E = i2, v = (async () => {
      try {
        let t2 = await r2.getIdToken();
        await h({ local: () => (0, d.completedHistory)(), merge: d.applyCompletedHistory, current: o2, onDownloaded: e2, request: async (e3, r3) => {
          if (!o2()) throw Error("Account changed");
          let n3 = await fetch(e3, { method: r3 ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${t2}`, ...r3 ? { "Content-Type": "application/json" } : {} }, ...r3 ? { body: JSON.stringify({ records: r3 }) } : {}, signal: AbortSignal.timeout(2e4) });
          if (!n3.ok) throw Error(401 === n3.status ? "Sign in again to continue syncing." : "Couldn\u2019t sync. Your progress is kept on this device; we\u2019ll retry.");
          return n3.json();
        } }), o2() && I({ status: "saved", lastSync: Date.now() });
      } catch (e3) {
        o2() && (I({ status: "error", error: e3 instanceof Error ? e3.message : "Couldn\u2019t sync. Please retry." }), t = setTimeout(() => {
          U();
        }, 6e4));
      } finally {
        e2(), E === i2 && (E = null), v = null, S && (S = false, U());
      }
    })();
  }
  async function H() {
    k && ((0, d.applyCompletedHistory)((0, d.completedHistory)(null)), localStorage.setItem(N(k.uid), "imported"), C(), await U());
  }
  async function z() {
    O = null, A++, L.reset(), clearTimeout(t);
    let { signOut: r2 } = await e.A(3975);
    await r2(await (0, u.firebaseAuth)()), k = null, (0, p.selectProgressOwner)(null), I({ ...w, ready: true }), window.location.assign("/account");
  }
  async function x() {
    if (!k) return;
    let e2 = k, t2 = A, r2 = await e2.getIdToken();
    await (0, f.bindLocalPurchases)(r2), await (0, f.bindLocalPurchases)(r2, null);
    let n2 = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: r2 }), signal: AbortSignal.timeout(2e4) });
    if (A !== t2) return;
    if (404 === n2.status) return void I({ purchaseMessage: "No purchases found. Progress sync is free." });
    if (!n2.ok) throw Error(429 === n2.status ? "Purchase restoration reached its device limit today. Try tomorrow." : "Couldn\u2019t restore purchases. Try again.");
    let o2 = await n2.json();
    for (let [e3, t3] of (o2.token && (0, d.saveUnlockToken)(o2.token), Object.entries(o2.packs ?? {}))) "string" == typeof t3 && (0, d.savePackUnlockToken)(e3, t3);
    I({ purchaseMessage: o2.limitedPacks?.length ? "Some purchases were restored. Others reached their device limit today." : "Your purchases are ready on this device." });
  }
  e.s(["accountIdToken", 0, R, "importGuestHistory", 0, H, "initializeAccount", 0, P, "recoverAccountPurchases", 0, D, "refreshImportCount", 0, C, "restoreAccountPurchases", 0, x, "signInAccount", 0, $, "signOutAccount", 0, z, "skipGuestImport", 0, function() {
    k && (localStorage.setItem(N(k.uid), "skipped"), C());
  }, "syncAccount", 0, U, "useAccount", 0, function() {
    return (0, c.useSyncExternalStore)((e2) => (b.add(e2), () => b.delete(e2)), () => y, () => w);
  }, "waitForAccountHistory", 0, function() {
    let e2, t2 = (0, p.progressOwner)();
    if (!t2) return Promise.resolve();
    if (O?.owner === t2) return O.pending;
    let r2 = Promise.race([(async () => {
      for (await P(); (0, p.progressOwner)() === t2 && v; ) {
        let e3 = E;
        if (e3?.owner === t2) {
          await e3.pending;
          break;
        }
        await v;
      }
    })(), new Promise((t3) => {
      e2 = setTimeout(t3, 8e3);
    })]).finally(() => clearTimeout(e2));
    return O = { owner: t2, pending: r2 }, r2;
  }], 67334);
}]);
