(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 63796, (e) => {
  "use strict";
  e.s(["createPartyReconnectBackoff", 0, function(e2 = {}) {
    let t = 0, n = null;
    return { receivedRoom() {
      n ??= Date.now();
    }, disconnected() {
      null !== n && Date.now() - n >= 3e4 && (t = 0), n = null, t = Math.min(t + 1, 6);
      let r = e2.quickFirst ? t - 1 : t;
      return 0 === r ? Math.round(250 + 1e3 * Math.random()) : Math.round(Math.min(24e3, 3e3 * 2 ** (r - 1)) * (1 + 0.25 * Math.random()));
    } };
  }]);
}, 15326, (e) => {
  "use strict";
  var t = e.i(86062);
  let n = { plankton: (0, t.tierScore)("plankton"), tooclever: (0, t.tierScore)("tooclever"), schooler: (0, t.tierScore)("schooler"), rare: (0, t.tierScore)("rare"), deepcut: (0, t.tierScore)("deepcut"), krillion: (0, t.tierScore)("krillion") }, r = ["duel", "trio", "party", "crowd"];
  e.s(["CATEGORY_SWAP_MS", 0, 1300, "COUNTDOWN_MS", 0, 3e3, "DEFAULT_QUICK_PLAY_SIZE", 0, "party", "DEFAULT_SETTINGS", 0, { lives: 2, maxLives: 5, meterTarget: 600, minTurnMs: 8e3, fuseMinMs: 1e4, fuseMaxMs: 3e4, maxPlayers: 6, isPrivate: false }, "MAX_CHAT_LENGTH", 0, 160, "MAX_LIVES", 0, 10, "MAX_METER_TARGET", 0, 5e3, "MAX_NAME_LENGTH", 0, 16, "MAX_PLAYERS", 0, 16, "METER_BY_TIER", 0, n, "METER_FULL", 0, 600, "METER_TARGET_STEP", 0, 50, "MIN_PLAYERS_TO_START", 0, 2, "POP_FREEZE_MS", 0, 1500, "PRESENCE_PING_MS", 0, 15e3, "PUBLIC_ROOM_PAGE_SIZE", 0, 50, "QUICK_PLAY_SIZES", 0, r, "QUICK_PLAY_TABLES", 0, { duel: { label: "1V1", min: 2, max: 2, gatherMs: 0 }, trio: { label: "3S", min: 3, max: 3, gatherMs: 0 }, party: { label: "4\u20136", min: 4, max: 6, gatherMs: 15e3 }, crowd: { label: "8\u201310", min: 8, max: 10, gatherMs: 2e4 } }, "ROOM_CODE_ALPHABET", 0, "ABCDEFGHJKLMNPQRSTUVWXYZ", "ROOM_CODE_LENGTH", 0, 4, "ROOM_IDLE_TIMEOUT_MS", 0, 18e5, "SEATED_ELSEWHERE", 0, "seated-elsewhere", "SEEN_CATEGORIES_MAX", 0, 300, "categoryKey", 0, function(e2) {
    let t2 = e2.trim().toLowerCase().replace(/\s+/g, " "), n2 = 2166136261;
    for (let e3 = 0; e3 < t2.length; e3++) n2 ^= t2.charCodeAt(e3), n2 = Math.imul(n2, 16777619);
    return (n2 >>> 0).toString(36);
  }, "cleanSeenCategories", 0, function(e2) {
    return Array.isArray(e2) ? e2.filter((e3) => "string" == typeof e3 && /^[0-9a-z]{1,7}$/.test(e3)).slice(-300) : [];
  }, "isQuickPlaySize", 0, (e2) => "string" == typeof e2 && r.includes(e2), "normalizeName", 0, function(e2) {
    if ("string" != typeof e2) return null;
    let t2 = e2.replace(/\s+/g, " ").trim().slice(0, 16);
    return t2.length < 2 || !/^[\p{L}\p{N} _.'-]+$/u.test(t2) ? null : t2;
  }]);
}, 44252, 14528, (e) => {
  "use strict";
  var t = e.i(71645), n = e.i(67334);
  e.i(47167);
  var r = e.i(63796), a = e.i(15326);
  function i(e2, t2) {
    return void 0 === t2 ? e2 : e2.slice(Math.max(0, e2.length - t2));
  }
  class o extends Error {
  }
  let s = null;
  async function l(e2, t2) {
    let n2 = await (s ??= new Promise((e3, t3) => {
      let n3 = document.createElement("script"), r2 = setTimeout(() => a2(), 15e3), a2 = () => {
        clearTimeout(r2), n3.remove(), s = null, t3(new o("Verification couldn't load. Please try again."));
      };
      n3.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", n3.async = true, n3.onerror = a2, n3.onload = () => {
        clearTimeout(r2);
        let t4 = window.turnstile;
        t4 ? e3(t4) : a2();
      }, document.head.append(n3);
    }));
    return new Promise((r2, a2) => {
      let i2, s2 = document.createElement("dialog");
      s2.setAttribute("aria-labelledby", "puffer-verification-title"), Object.assign(s2.style, { color: "#e4f4ff", background: "#071b2d", border: "1px solid #527b91", borderRadius: "12px", padding: "24px", position: "fixed", inset: "0", margin: "auto", width: "370px", boxSizing: "border-box", maxWidth: "calc(100vw - 32px)", fontFamily: "system-ui, sans-serif" });
      let l2 = document.createElement("h2");
      l2.id = "puffer-verification-title", l2.textContent = "A quick check before you join", l2.style.fontSize = "20px";
      let c2 = document.createElement("p");
      c2.textContent = "Help keep bots out of Puffer Party. You can keep playing after this check.", c2.style.maxWidth = "320px";
      let u2 = document.createElement("div"), d2 = document.createElement("button");
      d2.textContent = "Cancel", d2.type = "button", Object.assign(d2.style, { marginTop: "16px", padding: "8px 16px", cursor: "pointer" }), s2.append(l2, c2, u2, d2);
      let m2 = false, h2 = (e3, t3) => {
        m2 || (m2 = true, clearTimeout(p2), i2 && n2.remove(i2), s2.close(), s2.remove(), e3 ? r2(e3) : a2(new o(t3 ?? "Verification cancelled. Choose Play when you're ready.")));
      }, p2 = setTimeout(() => h2(void 0, "Verification timed out. Please try again."), 18e4);
      d2.onclick = () => h2(), s2.oncancel = (e3) => {
        e3.preventDefault(), h2();
      }, document.body.append(s2), s2.showModal();
      try {
        i2 = n2.render(u2, { sitekey: e2, action: "puffer_join", cData: t2, theme: "dark", size: "flexible", callback: (e3) => h2(e3), "error-callback": () => (h2(void 0, "Verification failed to load. Please try again."), true), "expired-callback": () => h2(void 0, "Verification expired. Please try again.") });
      } catch {
        h2(void 0, "Verification couldn't start. Please try again.");
      }
    });
  }
  var c = e.i(33827);
  let u = "https://party.krillion.io".replace(/\/$/, ""), d = null, m = null, h = null;
  async function p(e2) {
    if (h) return h.owner === e2 ? h.load : (await h.load.catch(() => {
    }), p(e2));
    let t2 = (async () => {
      let e3 = await f(), t3 = e3 ? { Authorization: `Bearer ${e3}` } : {}, n2 = await fetch("/api/party/token", { cache: "no-store", credentials: "same-origin", headers: t3, signal: AbortSignal.timeout(15e3) });
      return { res: n2, data: await n2.json().catch(() => null), headers: t3 };
    })().finally(() => {
      h = null;
    });
    return h = { owner: e2, load: t2 }, t2;
  }
  async function f() {
    let t2;
    if (!(0, c.progressOwner)()) return null;
    try {
      let { accountIdToken: n2 } = await e.A(10150);
      return await Promise.race([n2(), new Promise((e2) => {
        t2 = setTimeout(() => e2(null), 6e3);
      })]);
    } catch {
      return null;
    } finally {
      void 0 !== t2 && clearTimeout(t2);
    }
  }
  async function y(e2 = true) {
    let t2 = (0, c.progressOwner)();
    return d && d.owner === t2 && 1e3 * d.exp - Date.now() > 6e4 ? d.value : e2 ? m ??= _(t2, true).finally(() => {
      m = null;
    }) : _(t2, false);
  }
  async function _(e2, t2) {
    let n2 = await p(e2), { headers: r2 } = n2, { res: a2, data: i2 } = n2;
    if (403 === a2.status && i2?.code === "party-verification") {
      if (!t2) throw new o("Verification needed.");
      if ("string" != typeof i2.siteKey || "string" != typeof i2.guestId) throw new o("Verification is unavailable.");
      let e3 = await l(i2.siteKey, i2.guestId);
      a2 = await fetch("/api/party/token", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { ...r2, "Content-Type": "application/json" }, body: JSON.stringify({ captchaToken: e3 }), signal: AbortSignal.timeout(15e3) }), i2 = await a2.json().catch(() => null);
    }
    if (a2.status >= 500 || 429 === a2.status) throw Error("The party token service didn't answer.");
    if (!a2.ok || "string" != typeof i2?.token || "number" != typeof i2.exp) throw new o(i2?.error ?? "Unable to connect. Please try again.");
    return d = { value: i2.token, exp: i2.exp, owner: e2 }, i2.token;
  }
  let g = (e2, t2) => 401 === e2 && !!t2 && "object" == typeof t2 && "guest-token" === t2.code, v = /* @__PURE__ */ new Map(), w = 0;
  class S {
    code;
    playerKey;
    feed;
    onStatus;
    ws;
    room;
    closed;
    retry;
    pinger;
    backoff;
    pending;
    removed;
    heardAt;
    probe;
    constructor(e2, t2, n2, i2) {
      this.code = e2, this.playerKey = t2, this.feed = n2, this.onStatus = i2, this.ws = null, this.room = null, this.closed = false, this.retry = null, this.pinger = null, this.backoff = (0, r.createPartyReconnectBackoff)({ quickFirst: true }), this.pending = /* @__PURE__ */ new Map(), this.removed = false, this.heardAt = 0, this.probe = null, this.onVisible = () => {
        "visible" === document.visibilityState && this.ping();
      }, this.ping = () => {
        if (!this.send({ t: "ping" }) || this.probe) return;
        let e3 = this.ws, t3 = Date.now();
        this.probe = setTimeout(() => {
          this.probe = null, e3 && this.ws === e3 && this.heardAt < t3 && this.drop(e3);
        }, 5e3);
      }, this.open(), this.pinger = setInterval(() => this.ping(), a.PRESENCE_PING_MS), globalThis.addEventListener?.("online", this.ping), globalThis.document?.addEventListener("visibilitychange", this.onVisible);
    }
    onVisible;
    ping;
    drop(e2) {
      if (this.ws === e2 && !this.closed) {
        this.ws = null;
        try {
          e2.close(4e3, "silent");
        } catch {
        }
        this.failPending(), this.onStatus("reconnecting"), this.retry = setTimeout(() => this.open(), this.backoff.disconnected());
      }
    }
    open() {
      this.closed || y().then((e2) => this.connect(e2), (e2) => {
        e2 instanceof o ? this.onStatus("refused") : this.closed || (this.onStatus("reconnecting"), this.retry = setTimeout(() => this.open(), this.backoff.disconnected()));
      });
    }
    connect(e2) {
      if (this.closed || this.ws) return;
      let t2 = u.replace(/^http/, "ws"), n2 = new WebSocket(`${t2}/rooms/${encodeURIComponent(this.code)}/ws?key=${encodeURIComponent(this.playerKey)}&token=${encodeURIComponent(e2)}`);
      this.ws = n2, n2.onmessage = (e3) => {
        let t3;
        this.ws === n2 && (this.heardAt = Date.now());
        try {
          t3 = JSON.parse(String(e3.data));
        } catch {
          return;
        }
        this.receive(t3);
      }, n2.onclose = (e3) => this.ws !== n2 || (this.ws = null, this.failPending(), this.closed) ? void 0 : this.removed ? this.onStatus("removed") : 4403 === e3.code ? this.onStatus("refused") : void (4404 !== e3.code && 4410 !== e3.code && (4401 === e3.code && (d = null), this.onStatus("reconnecting"), this.retry = setTimeout(() => this.open(), this.backoff.disconnected())));
    }
    receive(e2) {
      switch (e2.t) {
        case "snap":
          this.room = e2.room, this.backoff.receivedRoom(), this.onStatus("live"), this.feed.push(e2.room);
          return;
        case "patch": {
          let t2 = this.room ? (function(e3, t3) {
            if (t3.base !== e3.version) return null;
            let n2 = { ...e3, ...t3.set ?? {}, version: t3.v, now: t3.now };
            if (t3.players || t3.drop) {
              let r2 = new Map(e3.players.map((e4) => [e4.id, e4]));
              for (let e4 of t3.drop ?? []) r2.delete(e4);
              for (let e4 of t3.players ?? []) r2.set(e4.id, e4);
              n2.players = [...r2.values()].sort((e4, t4) => e4.seat - t4.seat);
            }
            return t3.eventsAll ? n2.events = t3.eventsAll : t3.events && (n2.events = i([...e3.events, ...t3.events], t3.eventsLength)), t3.chatAll ? n2.chat = t3.chatAll : t3.chat && (n2.chat = i([...e3.chat, ...t3.chat], t3.chatLength)), n2;
          })(this.room, e2.patch) : null;
          if (!t2) return void this.send({ t: "sync" });
          this.room = t2, this.feed.push(t2);
          return;
        }
        case "ack": {
          let t2 = this.pending.get(e2.cid);
          if (!t2) return;
          clearTimeout(t2.timer), this.pending.delete(e2.cid), t2.resolve({ ok: e2.ok, error: e2.error, submit: e2.submit, status: e2.status ?? (e2.ok ? 200 : 400), room: this.room ?? void 0 });
          return;
        }
        case "gone":
          this.closed = true, this.onStatus(e2.paused ? "paused" : "gone");
          return;
        case "removed":
          this.removed = true, e2.message && v.set(`${this.code}:${this.playerKey}`, e2.message), this.onStatus("removed");
          return;
        case "pong":
          return;
      }
    }
    send(e2) {
      return this.ws?.readyState === WebSocket.OPEN && (this.ws.send(JSON.stringify(e2)), true);
    }
    act(e2) {
      let t2 = `${Date.now().toString(36)}-${++w}`;
      return new Promise((n2) => {
        if (!this.send({ t: "act", cid: t2, action: e2 })) return void n2({ ok: false, error: "no signal", status: -1 });
        Date.now() - this.heardAt > 2e3 && this.ping();
        let r2 = setTimeout(() => {
          this.pending.delete(t2), n2({ ok: false, error: "no signal", status: 0 });
        }, 1e4);
        this.pending.set(t2, { resolve: n2, timer: r2 });
      });
    }
    failPending() {
      for (let [e2, t2] of this.pending) clearTimeout(t2.timer), t2.resolve({ ok: false, error: "no signal", status: 0 }), this.pending.delete(e2);
    }
    close() {
      this.closed = true, this.retry && clearTimeout(this.retry), this.pinger && clearInterval(this.pinger), this.probe && clearTimeout(this.probe), globalThis.removeEventListener?.("online", this.ping), globalThis.document?.removeEventListener("visibilitychange", this.onVisible), this.failPending(), this.ws?.close(1e3, "leaving"), this.ws = null;
    }
  }
  let b = /* @__PURE__ */ new Map();
  async function E(e2, t2, n2, r2) {
    let a2 = b.get(`${e2}:${t2}`);
    if (a2) {
      let e3 = await a2.act(n2);
      if (-1 !== e3.status && ("leave" !== n2.type || 0 !== e3.status)) return e3;
    }
    for (let a3 = 0; ; a3++) {
      let i2;
      try {
        let a4 = await y("leave" !== n2.type);
        i2 = await fetch(`${u}/rooms/${encodeURIComponent(e2)}/act`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerKey: t2, action: n2, guestToken: a4 }), signal: r2, keepalive: "leave" === n2.type });
      } catch {
        return { ok: false, error: "no signal", status: 0 };
      }
      let o2 = await i2.json().catch(() => ({}));
      if (0 === a3 && g(i2.status, o2)) {
        d = null;
        continue;
      }
      return { ok: i2.ok && false !== o2.ok, error: o2.error, submit: o2.submit, status: i2.status };
    }
  }
  class k extends Error {
    status;
    constructor(e2, t2) {
      super(e2), this.status = t2;
    }
  }
  async function A(e2, t2 = "") {
    let r2 = await (0, n.accountIdToken)();
    if (!r2) throw new k("Sign in with your Puffer Party admin account.", 403);
    let a2 = e2?.op === "join" && "" !== u ? await y() : void 0, i2 = await fetch(`/api/party/admin${t2}`, { method: e2 ? "POST" : "GET", cache: "no-store", credentials: "same-origin", headers: { Authorization: `Bearer ${r2}`, "Content-Type": "application/json" }, ...e2 ? { body: JSON.stringify({ ...e2, ...a2 ? { guestToken: a2 } : {} }) } : {}, signal: AbortSignal.timeout(25e3) }), o2 = await i2.json();
    if (!i2.ok) throw new k(o2.error ?? "Admin action failed. Try again.", i2.status);
    return o2;
  }
  e.s(["PartyAdminError", 0, k, "partyAdminRequest", 0, A, "usePartyAdmin", 0, function() {
    let { user: e2 } = (0, n.useAccount)(), r2 = e2?.uid, [a2, i2] = (0, t.useState)();
    return (0, t.useEffect)(() => {
      if (!r2) return;
      let e3 = false;
      return A().then((t2) => {
        e3 || i2(t2.admin ? r2 : void 0);
      }).catch(() => {
        e3 || i2(void 0);
      }), () => {
        e3 = true;
      };
    }, [r2]), !!r2 && a2 === r2;
  }], 14528);
  var T = e.i(86968), R = e.i(37812);
  let P = "krillion-party-name", x = "krillion-party-character", I = "krillion-party-seen", M = "krillion-party-size", L = "krillion-party-seat:", N = "krillion-party-seat-backup:", D = /* @__PURE__ */ new Set(), j = () => D.forEach((e2) => e2());
  function C(e2) {
    D.add(e2);
    let t2 = (t3) => {
      (t3.key === P || t3.key === x || t3.key === M || null === t3.key) && e2();
    };
    return window.addEventListener("storage", t2), () => {
      D.delete(e2), window.removeEventListener("storage", t2);
    };
  }
  function O() {
    try {
      return globalThis.localStorage?.getItem(P) ?? "";
    } catch {
      return "";
    }
  }
  function G() {
    try {
      let e2 = globalThis.localStorage?.getItem(M);
      return (0, a.isQuickPlaySize)(e2) ? e2 : a.DEFAULT_QUICK_PLAY_SIZE;
    } catch {
      return a.DEFAULT_QUICK_PLAY_SIZE;
    }
  }
  function $() {
    try {
      return (0, a.cleanSeenCategories)(JSON.parse(globalThis.localStorage?.getItem(I) ?? "[]"));
    } catch {
      return [];
    }
  }
  function U(e2) {
    try {
      let t2 = globalThis.sessionStorage?.getItem(L + e2);
      if (t2) return t2;
    } catch {
      return null;
    }
    return (function(e3) {
      let t2 = null;
      try {
        t2 = globalThis.localStorage?.getItem(N + e3) ?? null;
      } catch {
        return null;
      }
      let n2 = q(t2);
      if (!n2) return null;
      let r2 = Number(JSON.parse(t2).heldAt) || 0, i2 = Date.now() - r2;
      if (i2 < 1e4 || i2 > a.ROOM_IDLE_TIMEOUT_MS) return null;
      let o2 = { playerId: n2.playerId, playerKey: n2.playerKey, name: n2.name, character: n2.character }, s2 = JSON.stringify(o2);
      try {
        globalThis.sessionStorage?.setItem(L + e3, s2);
      } catch {
      }
      return K(e3, o2), s2;
    })(e2);
  }
  function K(e2, t2) {
    try {
      globalThis.localStorage?.setItem(N + e2, JSON.stringify({ ...t2, heldAt: Date.now() }));
    } catch {
    }
  }
  function q(e2) {
    if (!e2) return null;
    try {
      let t2 = JSON.parse(e2);
      if ("string" == typeof t2.playerId && "string" == typeof t2.playerKey && "string" == typeof t2.name && "string" == typeof t2.character) return t2;
    } catch {
    }
    return null;
  }
  class H extends Error {
    status;
    code;
    room;
    constructor(e2, t2, n2 = {}) {
      super(e2), this.status = t2, this.code = n2.code, this.room = n2.room;
    }
  }
  let F = "verification";
  async function z(e2, t2, n2) {
    let r2;
    try {
      r2 = await fetch(e2, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t2), cache: "no-store", signal: n2 });
    } catch {
      return { status: 0, data: null };
    }
    let a2 = null;
    try {
      a2 = await r2.json();
    } catch {
    }
    return { status: r2.status, data: a2 };
  }
  function B(e2, t2) {
    return e2 && "object" == typeof e2 && "error" in e2 && "string" == typeof e2.error ? e2.error : t2 ? `error ${t2}` : "no signal";
  }
  async function V(e2, t2) {
    let { status: n2, data: r2 } = await z(e2, t2);
    if (n2 < 200 || n2 >= 300) throw new H(B(r2, n2), n2);
    return r2;
  }
  async function J(e2, t2, n2 = true) {
    for (let r2 = 0; ; r2++) {
      let a2;
      try {
        a2 = await y(n2);
      } catch (e3) {
        if (e3 instanceof o) throw new H(e3.message, 403, { code: F });
        throw new H("no signal", 0);
      }
      let { status: i2, data: s2 } = await z(e2, { ...t2, guestToken: a2 });
      if (0 === r2 && g(i2, s2)) {
        d = null;
        continue;
      }
      if (i2 < 200 || i2 >= 300) throw new H(B(s2, i2), i2, (function(e3) {
        let { code: t3, room: n3 } = e3 && "object" == typeof e3 ? e3 : {};
        return { ..."string" == typeof t3 ? { code: t3 } : {}, ..."string" == typeof n3 ? { room: n3 } : {} };
      })(s2));
      return s2;
    }
  }
  function Y(e2) {
    return "" !== u ? J(`${u}/rooms`, { ...e2, seen: $() }) : V("/api/party/rooms", e2);
  }
  async function Q(e2, t2) {
    try {
      var n2, r2;
      return await (n2 = e2, r2 = t2, "" !== u ? J(`${u}/rooms/${encodeURIComponent(n2)}/join`, { ...r2, seen: $() }) : V(`/api/party/${encodeURIComponent(n2)}/join`, r2));
    } catch (n3) {
      if (!(n3 instanceof Error) || "This room is full." !== n3.message) throw n3;
      try {
        await A();
      } catch {
        throw n3;
      }
      try {
        return await A({ ...t2, code: e2, op: "join" });
      } catch (e3) {
        if (e3 instanceof k) throw new H(e3.message, e3.status);
        throw new H("no signal", 0);
      }
    }
  }
  async function W(e2) {
    if ("" !== u) return J(`${u}/quick-play`, { ...e2, seen: $() });
    if (e2.from) return { stay: true };
    let t2 = await ee().catch(() => null);
    for (let n2 of (t2?.rooms ?? []).filter((e3) => "lobby" === e3.phase && e3.players < e3.maxPlayers).sort((e3, t3) => t3.players - e3.players).slice(0, 3)) try {
      return { ...await Q(n2.code, e2), code: n2.code, quickPlay: "joined" };
    } catch {
    }
    return { ...await Y({ name: e2.name, character: e2.character, isPrivate: false }), quickPlay: "created" };
  }
  async function X() {
    return "" === u ? null : J(`${u}/rating`, {}, false);
  }
  async function Z(e2, t2, n2, r2) {
    if ("" !== u) return E(e2, t2, n2, r2);
    let { status: a2, data: i2 } = await z(`/api/party/${encodeURIComponent(e2)}/act`, { playerKey: t2, action: n2 }, r2), o2 = i2 && "object" == typeof i2 ? i2 : {}, s2 = a2 >= 200 && a2 < 300 && false !== o2.ok;
    return { ...o2, ok: s2, error: s2 ? o2.error : B(i2, a2), status: a2 };
  }
  async function ee(e2 = null, t2) {
    let n2 = e2 ? `?${new URLSearchParams({ cursor: e2 })}` : "", r2 = await fetch(`${"" !== u ? `${u}/rooms` : "/api/party/rooms"}${n2}`, { cache: "no-store", signal: t2 });
    if (!r2.ok) throw new H(`error ${r2.status}`, r2.status);
    let a2 = await r2.json();
    return { rooms: Array.isArray(a2.rooms) ? a2.rooms : [], nextCursor: a2.nextCursor ?? null };
  }
  async function et(e2, t2) {
    let n2 = /* @__PURE__ */ new Map(), r2 = null;
    for (let a2 = 0; a2 < e2; a2++) {
      let e3 = await ee(r2, t2);
      for (let t3 of e3.rooms) n2.set(t3.code, t3);
      if (!(r2 = e3.nextCursor)) break;
    }
    return { rooms: [...n2.values()], nextCursor: r2 };
  }
  e.s(["PartyError", 0, H, "SEAT_HOLD_REFRESH_MS", 0, 4e3, "VERIFICATION_NEEDED", 0, F, "act", 0, Z, "clearSeat", 0, function(e2) {
    try {
      globalThis.sessionStorage?.removeItem(L + e2), globalThis.localStorage?.removeItem(N + e2);
    } catch {
    }
    j();
  }, "createRoom", 0, Y, "createRoomFeed", 0, function(e2 = null) {
    let t2 = e2, n2 = /* @__PURE__ */ new Set();
    return { get: () => t2, subscribe: (e3, r2) => (n2.add(e3), r2 && t2 && e3(t2), () => {
      n2.delete(e3);
    }), push(e3) {
      if (!t2 || t2.code !== e3.code || !(e3.version <= t2.version)) for (let r2 of (t2 = e3, [...n2])) r2(e3);
    } };
  }, "holdSeat", 0, function(e2, t2) {
    K(e2, t2);
  }, "isPassingJoinFailure", 0, function(e2) {
    return !(e2 instanceof H) || e2.code !== a.SEATED_ELSEWHERE && (0 === e2.status || 401 === e2.status || 429 === e2.status || e2.status >= 500 || e2.code === F);
  }, "joinRoom", 0, Q, "listRoomPages", 0, et, "loadSeat", 0, function(e2) {
    return q(U(e2));
  }, "myRating", 0, X, "normalizeCode", 0, function(e2) {
    let t2 = e2.trim().toUpperCase();
    if (t2.length !== a.ROOM_CODE_LENGTH) return null;
    for (let e3 of t2) if (!a.ROOM_CODE_ALPHABET.includes(e3)) return null;
    return t2;
  }, "partyActivityUrl", 0, function() {
    return "" !== u ? `${u}/activity` : "/api/party/activity";
  }, "quickPlay", 0, W, "rememberCategory", 0, function(e2) {
    let t2 = (0, a.categoryKey)(e2), n2 = $().filter((e3) => e3 !== t2);
    n2.push(t2);
    try {
      globalThis.localStorage?.setItem(I, JSON.stringify(n2.slice(-a.SEEN_CATEGORIES_MAX)));
    } catch {
    }
  }, "removalMessage", 0, function(e2, t2) {
    return t2 ? v.get(`${e2}:${t2}`) ?? null : null;
  }, "savePartyCharacter", 0, function(e2) {
    try {
      globalThis.localStorage?.setItem(x, e2);
    } catch {
    }
    j();
  }, "savePartyName", 0, function(e2) {
    try {
      globalThis.localStorage?.setItem(P, e2);
    } catch {
    }
    j();
  }, "saveQuickPlaySize", 0, function(e2) {
    try {
      globalThis.localStorage?.setItem(M, e2);
    } catch {
    }
    j();
  }, "saveSeat", 0, function(e2, t2) {
    try {
      globalThis.sessionStorage?.setItem(L + e2, JSON.stringify(t2));
    } catch {
    }
    K(e2, t2), j();
  }, "seatedElsewhere", 0, function(e2) {
    return e2 instanceof H && e2.code === a.SEATED_ELSEWHERE && e2.room ? e2.room : null;
  }, "useFeedRoom", 0, function(e2) {
    return (0, t.useSyncExternalStore)((t2) => e2.subscribe(() => t2()), e2.get, () => null);
  }, "usePartyCharacter", 0, function() {
    return (0, t.useSyncExternalStore)(C, () => (function(e2) {
      let t2 = null;
      try {
        t2 = globalThis.localStorage?.getItem(x) ?? null;
      } catch {
        return null;
      }
      if (!(0, T.isMascotCharacterId)(t2)) return null;
      let n2 = T.MASCOT_CHARACTERS.find((e3) => e3.id === t2);
      return n2 && n2.unlockStreak <= e2 ? t2 : null;
    })((0, R.loadStats)().maxStreak), () => null);
  }, "usePartyName", 0, function() {
    return (0, t.useSyncExternalStore)(C, O, () => "");
  }, "useQuickPlaySize", 0, function() {
    return (0, t.useSyncExternalStore)(C, G, () => a.DEFAULT_QUICK_PLAY_SIZE);
  }, "useRoomStream", 0, function(e2, n2, i2) {
    let o2 = e2 && n2 ? `${e2}:${n2}` : "", [s2, l2] = (0, t.useState)({ id: "", status: "connecting" });
    return (0, t.useEffect)(() => {
      if (!e2 || !n2) return;
      let t2 = (e3) => l2((t3) => t3.id === o2 && t3.status === e3 ? t3 : { id: o2, status: e3 });
      if ("" !== u) {
        let r2 = new S(e2, n2, i2, t2);
        return b.set(`${e2}:${n2}`, r2), () => {
          r2.close(), b.get(`${e2}:${n2}`) === r2 && b.delete(`${e2}:${n2}`);
        };
      }
      let s3 = null, c2 = null, d2 = false, m2 = (0, r.createPartyReconnectBackoff)(), h2 = null, p2 = () => {
        if (d2 || h2 || s3?.readyState !== EventSource.OPEN) return;
        let t3 = h2 = new AbortController(), r2 = setTimeout(() => t3.abort(), 1e4);
        Z(e2, n2, { type: "ping" }, t3.signal).then((e3) => {
          !d2 && e3.room && i2.push(e3.room);
        }).catch(() => {
        }).finally(() => {
          clearTimeout(r2), h2 === t3 && (h2 = null);
        });
      }, f2 = () => {
        "visible" === document.visibilityState && p2();
      }, y2 = setInterval(p2, a.PRESENCE_PING_MS);
      window.addEventListener("online", p2), document.addEventListener("visibilitychange", f2);
      let _2 = () => {
        d2 || ((s3 = new EventSource(`/api/party/${encodeURIComponent(e2)}/stream?key=${encodeURIComponent(n2)}`)).addEventListener("room", (e3) => {
          t2("live");
          try {
            let t3 = JSON.parse(e3.data);
            m2.receivedRoom(), i2.push(t3);
          } catch {
          }
        }), s3.addEventListener("removed", (r2) => {
          d2 = true, s3?.close();
          try {
            let t3 = JSON.parse(r2.data).message;
            "string" == typeof t3 && t3 && v.set(`${e2}:${n2}`, t3);
          } catch {
          }
          t2("removed");
        }), s3.addEventListener("gone", (e3) => {
          d2 = true, s3?.close();
          let n3 = false;
          try {
            n3 = true === JSON.parse(e3.data).paused;
          } catch {
          }
          t2(n3 ? "paused" : "gone");
        }), s3.onerror = () => {
          d2 || (s3?.close(), c2 = setTimeout(_2, m2.disconnected()), t2("reconnecting"));
        });
      };
      return _2(), () => {
        d2 = true, c2 && clearTimeout(c2), clearInterval(y2), window.removeEventListener("online", p2), document.removeEventListener("visibilitychange", f2), h2?.abort(), s3?.close();
      };
    }, [e2, n2, i2, o2]), s2.id === o2 ? s2.status : "connecting";
  }, "useStoredSeat", 0, function(e2) {
    let n2 = (0, t.useSyncExternalStore)(C, () => U(e2), () => "\0");
    return (0, t.useMemo)(() => "\0" === n2 ? void 0 : q(n2), [n2]);
  }, "warmPartyIdentity", 0, function() {
    "" !== u && y(false).catch(() => {
    });
  }], 44252);
}, 46513, (e) => {
  e.v({ actions: "AnnouncementGate-module__DpgsKa__actions", body: "AnnouncementGate-module__DpgsKa__body", close: "AnnouncementGate-module__DpgsKa__close", cta: "AnnouncementGate-module__DpgsKa__cta", dialog: "AnnouncementGate-module__DpgsKa__dialog", dismiss: "AnnouncementGate-module__DpgsKa__dismiss", eyebrow: "AnnouncementGate-module__DpgsKa__eyebrow", "eyebrow-blink": "AnnouncementGate-module__DpgsKa__eyebrow-blink", panel: "AnnouncementGate-module__DpgsKa__panel", pollError: "AnnouncementGate-module__DpgsKa__pollError", pollStatus: "AnnouncementGate-module__DpgsKa__pollStatus", preview: "AnnouncementGate-module__DpgsKa__preview", previewImage: "AnnouncementGate-module__DpgsKa__previewImage", title: "AnnouncementGate-module__DpgsKa__title" });
}, 3795, (e) => {
  "use strict";
  e.s(["PARTY_DRAIN_MESSAGE", 0, "New games are paused while we work on improvements.", "PARTY_PAUSED_MESSAGE", 0, "Puffer Party is offline while we work on improvements.", "isPartyPaused", 0, function() {
    return false;
  }]);
}, 69341, (e) => {
  e.v({ arrow: "MerchLink-module__1I0bdG__arrow", copy: "MerchLink-module__1I0bdG__copy", detail: "MerchLink-module__1I0bdG__detail", icon: "MerchLink-module__1I0bdG__icon", label: "MerchLink-module__1I0bdG__label", link: "MerchLink-module__1I0bdG__link" });
}, 78877, 45394, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(39233), r = e.i(32368);
  e.s(["default", 0, function({ placement: e2, className: a2 = "" }) {
    return (0, t.jsxs)("a", { className: `${r.default.link} ${a2}`, href: "https://chainle.io/", target: "_blank", rel: "noopener", onClick: () => (0, n.track)("chainle_clicked", { placement: e2 }), children: [(0, t.jsx)("svg", { className: r.default.icon, viewBox: "0 0 20 20", fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": "true", children: (0, t.jsx)("path", { d: "M1 4h10v2H1z M1 10h10v2H1z M1 6h2v4H1z M9 6h2v2H9z M9 8h10v2H9z M9 14h10v2H9z M9 12h2v2H9z M17 10h2v4h-2z" }) }), (0, t.jsxs)("span", { className: r.default.copy, children: [(0, t.jsx)("span", { className: r.default.label, children: "Try Chainle" }), (0, t.jsx)("span", { className: r.default.detail, children: "Fun word association game made by my little brother" })] }), (0, t.jsx)("span", { className: r.default.arrow, "aria-hidden": "true", children: "\u2197" }), (0, t.jsx)("span", { className: "sr-only", children: " (opens in a new tab)" })] });
  }], 78877);
  var a = e.i(69341);
  e.s(["default", 0, function({ placement: e2, className: r2 = "" }) {
    return (0, t.jsxs)("a", { className: `${a.default.link} ${r2}`, href: `https://shop.krillion.io/?utm_source=krillion&utm_medium=game&utm_campaign=merch_launch&utm_content=${e2}`, target: "_blank", rel: "noopener", onClick: () => (0, n.track)("merch_clicked", { placement: e2 }), children: [(0, t.jsx)("svg", { className: a.default.icon, viewBox: "0 0 20 20", fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": "true", children: (0, t.jsx)("path", { d: "M6 2h2v2h4V2h2v2h2v2h2v4h-4v8H6v-8H2V6h2V4h2z" }) }), (0, t.jsxs)("span", { className: a.default.copy, children: [(0, t.jsx)("span", { className: a.default.label, children: "menu" === e2 ? "Merch" : "Shop Krillion" }), (0, t.jsx)("span", { className: a.default.detail, children: "Tees, sweats & caps" })] }), (0, t.jsx)("span", { className: a.default.arrow, "aria-hidden": "true", children: "\u2197" }), (0, t.jsx)("span", { className: "sr-only", children: " (opens in a new tab)" })] });
  }], 45394);
}, 23112, (e) => {
  e.v({ cta: "OriginleInvite-module__n9gjUG__cta", facts: "OriginleInvite-module__n9gjUG__facts", menuArrow: "OriginleInvite-module__n9gjUG__menuArrow", menuCopy: "OriginleInvite-module__n9gjUG__menuCopy", menuDetail: "OriginleInvite-module__n9gjUG__menuDetail", menuIcon: "OriginleInvite-module__n9gjUG__menuIcon", menuLabel: "OriginleInvite-module__n9gjUG__menuLabel", menuLink: "OriginleInvite-module__n9gjUG__menuLink", pay: "OriginleInvite-module__n9gjUG__pay" });
}, 50684, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(71645), r = e.i(39233), a = e.i(23112);
  e.s(["default", 0, function({ placement: e2 = "daily_results" }) {
    let t2 = (0, n.useRef)(null);
    (0, n.useEffect)(() => {
      1;
    }, [e2]), 1;
    return null;
  }], 50684);
}, 21541, (e) => {
  e.v({ activity: "GameDiscovery-module__sRLeRq__activity", heading: "GameDiscovery-module__sRLeRq__heading", home: "GameDiscovery-module__sRLeRq__home", idle: "GameDiscovery-module__sRLeRq__idle", link: "GameDiscovery-module__sRLeRq__link", live: "GameDiscovery-module__sRLeRq__live", multiplayer: "GameDiscovery-module__sRLeRq__multiplayer", newMode: "GameDiscovery-module__sRLeRq__newMode", play: "GameDiscovery-module__sRLeRq__play", premise: "GameDiscovery-module__sRLeRq__premise", promo: "GameDiscovery-module__sRLeRq__promo", promoBody: "GameDiscovery-module__sRLeRq__promoBody", promoCopy: "GameDiscovery-module__sRLeRq__promoCopy", promoFooter: "GameDiscovery-module__sRLeRq__promoFooter", promoMeta: "GameDiscovery-module__sRLeRq__promoMeta", promoTitle: "GameDiscovery-module__sRLeRq__promoTitle", puffer: "GameDiscovery-module__sRLeRq__puffer", title: "GameDiscovery-module__sRLeRq__title" });
}, 62557, (e) => {
  "use strict";
  var t = e.i(43476), n = e.i(22016), r = e.i(71645), a = e.i(36484), i = e.i(39233), o = e.i(21541), s = e.i(3795), l = e.i(44252);
  let c = (0, r.createContext)(void 0);
  function u() {
    return (0, t.jsx)("span", { className: o.default.puffer, "aria-hidden": "true", children: (0, t.jsx)(a.default, { src: "/gen/party/puffer-0.png", width: 52, height: 52, alt: "" }) });
  }
  function d({ placement: e2 }) {
    let a2 = "home" === e2, s2 = (0, r.useId)();
    (0, r.useContext)(c);
    let m, [h, p] = (0, r.useState)(null), f = m ?? h;
    (0, r.useEffect)(() => {
      let e3, t2 = true, n2 = async () => {
        if (document.hidden || e3) return;
        let n3 = e3 = new AbortController(), r3 = window.setTimeout(() => n3.abort(), 1e4);
        try {
          let e4 = await fetch((0, l.partyActivityUrl)(), { signal: n3.signal });
          if (!e4.ok) throw Error("Player count unavailable");
          let r4 = await e4.json();
          if (!Number.isSafeInteger(r4.players) || r4.players < 0) throw Error("Invalid player count");
          t2 && p(r4.players);
        } catch {
          t2 && p(null);
        } finally {
          window.clearTimeout(r3), e3 = void 0;
        }
      };
      n2();
      let r2 = window.setInterval(() => void n2(), 3e4);
      return document.addEventListener("visibilitychange", n2), () => {
        t2 = false, e3?.abort(), window.clearInterval(r2), document.removeEventListener("visibilitychange", n2);
      };
    }, [m]);
    let y = null !== f && (0, t.jsxs)("span", { className: o.default.activity, children: [(0, t.jsx)("span", { className: f > 0 ? o.default.live : o.default.idle, "aria-hidden": "true" }), f.toLocaleString("en-US"), " playing"] });
    return a2 ? (0, t.jsxs)(n.default, { href: "/party", prefetch: false, className: `${o.default.link} ${o.default.home}`, onClick: () => (0, i.track)("party_discovery_click", { placement: e2 }), children: [(0, t.jsx)("span", { className: o.default.newMode, children: "Beta \xB7 limited time" }), (0, t.jsxs)("span", { className: o.default.heading, children: [(0, t.jsx)(u, {}), (0, t.jsx)("span", { className: o.default.title, children: "Puffer Party" })] }), y] }) : (0, t.jsxs)("section", { className: `hub-panel ${o.default.promo}`, "aria-labelledby": s2, children: [(0, t.jsxs)("div", { className: o.default.promoMeta, children: [(0, t.jsx)("span", { className: o.default.newMode, children: "Beta \xB7 limited time" }), y] }), (0, t.jsxs)("div", { className: o.default.promoBody, children: [(0, t.jsxs)("div", { className: o.default.promoCopy, children: [(0, t.jsx)("h2", { id: s2, className: o.default.promoTitle, children: "Puffer Party" }), (0, t.jsx)("p", { className: o.default.premise, children: "Basically hot potato but for krillion, try it, it's fun" })] }), (0, t.jsx)(u, {})] }), (0, t.jsxs)("div", { className: o.default.promoFooter, children: [(0, t.jsx)("span", { className: o.default.multiplayer, children: "2\u201316 players \xB7 live multiplayer" }), (0, t.jsx)(n.default, { href: "/party", prefetch: false, className: `btn-descend ${o.default.play}`, onClick: () => (0, i.track)("party_discovery_click", { placement: e2 }), children: "Play Puffer Party" })] })] });
  }
  e.s(["GameDiscoveryPreviewPlayers", 0, c, "PufferIcon", 0, u, "default", 0, function({ placement: e2 }) {
    return (0, s.isPartyPaused)() ? null : (0, t.jsx)(d, { placement: e2 });
  }]);
}, 74365, (e) => {
  "use strict";
  var t = e.i(98284);
  let n = (function(e2 = () => fetch("/api/announcements/current"), n2 = Date.now, r = () => performance.now()) {
    let a = null, i = null, o = null;
    return function() {
      let s = r();
      return a && a.receivedAt <= s && s < a.expiresAt && 1e3 > Math.abs(n2() - a.wallAt - (s - a.receivedAt)) ? Promise.resolve(a.announcement) : i || (i = Promise.resolve().then(e2).then(async (e3) => {
        if (!e3.ok) throw Error(`Announcement request failed: ${e3.status}`);
        let i2 = await e3.json(), l = i2.announcement ?? null, c = r(), u = c - s;
        if (u < 0) return null;
        let d = Date.parse(e3.headers.get("Date") ?? ""), m = n2();
        if (Number.isFinite(d)) {
          let t2 = Number(e3.headers.get("Age") ?? "0");
          m = d + (Number.isFinite(t2) ? 1e3 * Math.max(0, t2) : 0) + u + 1e3, o && d <= o.responseDate && c >= o.receivedAt && (m = Math.max(m, o.serverAt + c - o.receivedAt)), o = { receivedAt: c, serverAt: m, responseDate: d };
        }
        let h = Date.parse(i2.expiresAt ?? ""), p = Math.min(6e4 - u, Date.parse((0, t.nextResetISO)(new Date(m))) - m, Number.isFinite(h) ? h - m : 1 / 0, l ? Date.parse(l.endsAt) - m : 1 / 0);
        return p > 0 && (!l || Date.parse(l.startsAt) <= m) ? (a = { announcement: l, receivedAt: c, wallAt: n2(), expiresAt: c + p }, l) : null;
      }).finally(() => {
        i = null;
      }));
    };
  })();
  e.s(["loadCurrentAnnouncement", 0, n]);
}]);
