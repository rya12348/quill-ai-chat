(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 91427, 4598, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(36484), n = e.i(31408), l = e.i(35406), s = e.i(71645), r = e.i(15326), i = e.i(61736), o = e.i(44252), d = e.i(32358);
  function c() {
    let e2 = 0, t2 = 0, a2 = 0, n2 = 0, l2 = [], s2 = null, r2 = "", i2 = () => {
      e2 = t2 = a2 = n2 = 0, l2 = [], s2 = null, r2 = "";
    };
    return { reset: i2, note(o2, d2) {
      try {
        if (!d2) return i2();
        if (!o2.isTrusted) {
          n2 = Math.min(1e4, n2 + 1), s2 = null;
          return;
        }
        let c2 = "string" == typeof o2.data ? o2.data : null;
        if ("insertText" === o2.inputType && null !== c2 && 1 == [...c2].length) {
          if (e2 = Math.min(1e4, e2 + 1), null !== s2 && c2 !== r2) {
            let e3 = o2.timeStamp - s2;
            e3 >= 0 && e3 < 2e3 && l2.length < 60 && l2.push(e3);
          }
          s2 = o2.timeStamp, r2 = c2;
          return;
        }
        "insertFromPaste" === o2.inputType || "insertFromDrop" === o2.inputType || "insertFromPasteAsQuotation" === o2.inputType ? t2 = Math.min(1e4, t2 + 1) : a2 = Math.min(1e4, a2 + 1), s2 = null;
      } catch {
      }
    }, report() {
      var s3;
      let r3, i3 = l2.length, o2 = i3 ? l2.reduce((e3, t3) => e3 + t3, 0) / i3 : null, d2 = null;
      return i3 >= 2 && o2 && (s3 = l2, r3 = (e3, t3) => Math.abs(e3 / t3 - Math.round(e3 / t3)) * t3 < 0.05, !s3.every((e3) => r3(e3, 10) || r3(e3, 50 / 3))) && (d2 = Math.round(Math.sqrt(l2.reduce((e3, t3) => e3 + (t3 - o2) ** 2, 0) / (i3 - 1)) / o2 * 100) / 100), { keys: e2, pastes: t2, other: a2, synthetic: n2, gaps: i3, mean: null === o2 ? null : Math.round(o2), cv: d2 };
    } };
  }
  var p = e.i(66732);
  let u = "krillion-party-muted", h = "krillion-party-muted-change", m = "[]";
  function y() {
    try {
      return localStorage.getItem(u) ?? m;
    } catch {
      return m;
    }
  }
  function g(e2) {
    return window.addEventListener("storage", e2), window.addEventListener(h, e2), () => {
      window.removeEventListener("storage", e2), window.removeEventListener(h, e2);
    };
  }
  function f(e2) {
    try {
      let t2 = JSON.parse(e2);
      return Array.isArray(t2) ? t2.filter((e3) => "string" == typeof e3).slice(-500) : [];
    } catch {
      return [];
    }
  }
  var v = e.i(14528);
  let b = ["harassment", "spam", "cheating", "hate-or-slurs", "threat", "personal-info", "sexual-harassment", "sexual-violence", "child-safety", "violent-hate", "self-harm-encouragement", "solicitation", "other"];
  function x({ code: e2, canTakeHost: a2, target: n2 }) {
    let [l2, r2] = (0, s.useState)("mute"), [i2, d2] = (0, s.useState)("harassment"), [c2, p2] = (0, s.useState)(24), [u2, h2] = (0, s.useState)(""), [m2, y2] = (0, s.useState)(false), g2 = (0, s.useRef)(false), f2 = (0, s.useRef)(null), [j2, w2] = (0, s.useState)(""), [k2, N2] = (0, s.useState)(null), [I2, S2] = (0, s.useState)("");
    async function E2(e3) {
      if (!g2.current) {
        g2.current = true, y2(true), w2("");
        try {
          await e3();
        } catch (e4) {
          w2(e4 instanceof Error ? e4.message : "Admin action failed. Try again.");
        } finally {
          g2.current = false, y2(false);
        }
      }
    }
    async function T2(t2) {
      let a3 = (0, o.loadSeat)(e2);
      if (!a3) throw Error("Rejoin the room to use admin controls.");
      w2(false === (await (0, v.partyAdminRequest)({ code: e2, playerKey: a3.playerKey, ...t2 })).synced ? "Saved. Realtime enforcement is waiting for the next sync." : "Done.");
    }
    async function A2() {
      N2((await (0, v.partyAdminRequest)(void 0, "?sanctions=1")).sanctions);
    }
    return (0, t.jsxs)("div", { className: "pf-admin", children: [(0, t.jsxs)("div", { className: "pf-chat-action-buttons", children: [a2 && (0, t.jsx)("button", { type: "button", disabled: m2, onClick: () => void E2(() => T2({ op: "take-host" })), children: "Take host" }), (0, t.jsx)("button", { type: "button", disabled: m2, onClick: () => k2 ? N2(null) : void E2(A2), children: k2 ? "Close sanctions" : "Manage sanctions" })] }), n2 && (0, t.jsxs)("details", { className: "pf-chat-actions", children: [(0, t.jsxs)("summary", { children: ["Moderate ", n2.name, " across Puffer Party"] }), (0, t.jsxs)("label", { children: ["Action", (0, t.jsxs)("select", { value: l2, onChange: (e3) => r2(e3.target.value), children: [(0, t.jsx)("option", { value: "mute", children: "Mute chat" }), (0, t.jsx)("option", { value: "suspend", children: "Suspend playing" }), (0, t.jsx)("option", { value: "ban", children: "Permanent ban" })] })] }), "ban" !== l2 && (0, t.jsxs)("label", { children: ["Duration", (0, t.jsxs)("select", { value: c2, onChange: (e3) => p2(Number(e3.target.value)), children: [(0, t.jsx)("option", { value: 1, children: "1 hour" }), (0, t.jsx)("option", { value: 24, children: "24 hours" }), (0, t.jsx)("option", { value: 168, children: "7 days" }), (0, t.jsx)("option", { value: 720, children: "30 days" })] })] }), (0, t.jsxs)("label", { children: ["Reason", (0, t.jsx)("select", { value: i2, onChange: (e3) => d2(e3.target.value), children: b.map((e3) => (0, t.jsx)("option", { value: e3, children: e3.replaceAll("-", " ") }, e3)) })] }), (0, t.jsxs)("label", { children: ["Note", (0, t.jsx)("textarea", { maxLength: 2e3, value: u2, onChange: (e3) => h2(e3.target.value) })] }), (0, t.jsx)("p", { children: "This applies across all Puffer Party rooms to this player's browser identity." }), (0, t.jsxs)("button", { type: "button", disabled: m2, onClick: () => void E2(async () => {
      let e3 = { op: "sanction", playerId: n2.id, kind: l2, reason: i2, note: u2, durationMs: "ban" === l2 ? null : 36e5 * c2 }, t2 = JSON.stringify(e3);
      f2.current?.signature !== t2 && (f2.current = { signature: t2, id: crypto.randomUUID() }), await T2({ ...e3, requestId: f2.current.id }), f2.current = null, k2 && await A2();
    }), children: ["ban" === l2 ? "Permanently ban" : "mute" === l2 ? "Mute" : "Suspend", " ", n2.name, "ban" !== l2 ? ` for ${c2} hours` : ""] })] }, n2.id), k2 && (0, t.jsxs)("section", { className: "pf-chat-actions", "aria-label": "Active Puffer Party sanctions", children: [(0, t.jsxs)("label", { children: ["Reason for lifting", (0, t.jsx)("textarea", { value: I2, maxLength: 2e3, onChange: (e3) => S2(e3.target.value) })] }), !k2.length && (0, t.jsx)("p", { children: "No active sanctions." }), k2.map((e3) => (0, t.jsxs)("div", { children: [(0, t.jsxs)("p", { children: [e3.name, " \xB7 ", e3.kind, " \xB7 ", e3.reason.replaceAll("-", " "), " \xB7 ", e3.expiresAt ? `until ${new Date(e3.expiresAt).toLocaleString()}` : "permanent"] }), (0, t.jsxs)("button", { type: "button", disabled: m2 || !I2.trim(), onClick: () => void E2(async () => {
      await T2({ op: "revoke", id: e3.id, reason: I2 }), await A2();
    }), children: ["Lift ", e3.kind, " for ", e3.name] })] }, e3.id))] }), j2 && (0, t.jsx)("p", { className: "pf-chat-notice", role: "status", children: j2 })] });
  }
  let j = [["harassment", "Bullying or harassment"], ["sexual-content", "Sexual or inappropriate content"], ["hate", "Hate or slurs"], ["personal-info", "Personal information or unsafe contact"], ["spam", "Spam"], ["cheating", "Cheating"], ["other", "Something else"]];
  function w({ className: e2, chat: a2, players: n2, meId: l2, hostId: o2, enabled: d2, muted: c2, onMute: p2, onAction: u2, autoFocus: h2, onClose: m2, admin: y2 }) {
    let g2 = (0, s.useRef)(null), f2 = (0, s.useRef)(null), v2 = (0, s.useRef)(null), [b2, k2] = (0, s.useState)(""), [N2, I2] = (0, s.useState)(null), [S2, E2] = (0, s.useState)(false), [T2, A2] = (0, s.useState)(null), [R2, C2] = (0, s.useState)(false), [M2, P2] = (0, s.useState)("harassment"), [L2, O2] = (0, s.useState)(false), F2 = (0, s.useRef)(false), [D2, _2] = (0, s.useState)(""), $2 = n2.find((e3) => e3.id === l2), B2 = o2 === l2, U2 = n2.find((e3) => e3.id === N2?.id), Y = d2 ? $2?.chatMuted ? "The host has muted you in this room." : "" : "The host has turned chat off.", G = a2.at(-1)?.id ?? 0;
    (0, s.useEffect)(() => {
      N2 && v2.current?.focus({ preventScroll: true });
    }, [N2]), (0, s.useEffect)(() => {
      g2.current && (g2.current.scrollTop = g2.current.scrollHeight);
    }, [G]), (0, s.useEffect)(() => {
      h2 && f2.current?.focus({ preventScroll: true });
    }, [h2]);
    let H = (e3) => {
      I2(e3), A2(null), C2(false), _2("");
    }, q = async (e3) => {
      if (F2.current) return false;
      F2.current = true, O2(true), _2("");
      try {
        let t2 = await u2(e3);
        if (!t2.ok) return _2(t2.error ?? "That didn't go through. Please try again."), false;
        return true;
      } catch {
        return _2("Couldn't connect. Please try again."), false;
      } finally {
        F2.current = false, O2(false);
      }
    }, K = async () => {
      let e3 = b2.trim();
      e3 && !Y && await q({ type: "chat", text: e3 }) && k2((e4) => e4 === b2 ? "" : e4);
    }, V = async (e3) => {
      N2 && await q({ type: "moderate", playerId: N2.id, action: e3 }) && H(null);
    };
    return (0, t.jsxs)("div", { className: (e2 ? e2 + " " : "") + "pf-chat", "data-controls": N2 ? "" : void 0, "data-admin": y2 ? "" : void 0, children: [(0, t.jsxs)("h3", { children: ["CHAT ", m2 && (0, t.jsx)("button", { type: "button", className: "pf-chat-x", "aria-label": "close chat", onClick: m2, children: "\xD7" })] }), (0, t.jsxs)("div", { className: "pf-chat-tools", children: [(0, t.jsxs)("button", { type: "button", "aria-expanded": S2, onClick: () => {
      E2(!S2), H(null);
    }, children: ["Players ", S2 ? "\u25B4" : "\u25BE"] }), B2 && (0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => void q({ type: "chat-enabled", enabled: !d2 }), children: d2 ? "Turn chat off" : "Turn chat on" })] }), S2 && (0, t.jsxs)("div", { className: "pf-chat-players", "aria-label": "Chat player controls", children: [n2.filter((e3) => e3.id !== l2 && !e3.removed).map((e3) => (0, t.jsxs)("button", { type: "button", onClick: () => H({ id: e3.id, name: e3.name }), children: [e3.name, (0, t.jsx)("small", { children: c2.has(e3.id) ? "muted for you" : e3.chatMuted ? "muted by host" : e3.id === o2 ? "host" : "" })] }, e3.id)), n2.length < 2 && (0, t.jsx)("p", { children: "No other players yet." })] }), (0, t.jsxs)("div", { className: "pf-chat-list", ref: g2, role: "log", "aria-live": "polite", children: [0 === a2.length && (0, t.jsx)("p", { className: "sys", children: "Say hi to the ring. Keep it friendly; no links or personal details." }), a2.filter((e3) => !e3.playerId || !c2.has(e3.playerId)).map((e3) => null === e3.playerId ? (0, t.jsx)("p", { className: "sys", children: e3.text }, e3.id) : (0, t.jsxs)("p", { className: e3.playerId === l2 ? "mine" : void 0, children: [(0, t.jsx)("b", { style: { color: (0, i.characterColor)(n2.find((t2) => t2.id === e3.playerId)?.character ?? "krill") }, children: e3.name }), " ", e3.text, e3.playerId !== l2 && (0, t.jsx)("button", { className: "pf-chat-more", type: "button", "aria-label": `Options for ${e3.name}'s message`, onClick: () => H({ id: e3.playerId, name: e3.name, messageId: e3.id }), children: "\xB7\xB7\xB7" })] }, e3.id))] }), N2 && (0, t.jsxs)("section", { ref: v2, tabIndex: -1, className: "pf-chat-actions", "aria-label": `Controls for ${N2.name}`, children: [(0, t.jsxs)("div", { className: "pf-chat-action-title", children: [(0, t.jsx)("b", { children: N2.name }), (0, t.jsx)("button", { type: "button", "aria-label": "Close player controls", onClick: () => H(null), children: "\xD7" })] }), R2 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsxs)("label", { children: ["Report reason", (0, t.jsx)("select", { value: M2, onChange: (e3) => P2(e3.target.value), children: j.map(([e3, a3]) => (0, t.jsx)("option", { value: e3, children: a3 }, e3)) })] }), (0, t.jsx)("p", { children: "The message and recent room context will be saved for review. " }), (0, t.jsx)("button", { type: "button", disabled: L2, onClick: async () => {
      await q({ type: "report", playerId: N2.id, messageId: N2.messageId, reason: M2 }) && (H(null), _2("Report saved. Thank you. You can also mute this player for yourself."));
    }, children: "Send report" }), (0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => C2(false), children: "Cancel" })] }) : T2 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("p", { children: "ban" === T2 ? "Ban this player from the room? They will be removed and this browser cannot rejoin." : "Remove this player? They can join again with a new seat." }), (0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => void V(T2), children: "ban" === T2 ? "Ban player" : "Remove player" }), (0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => A2(null), children: "Cancel" })] }) : (0, t.jsxs)("div", { className: "pf-chat-action-buttons", children: [(0, t.jsx)("button", { type: "button", onClick: () => p2(N2.id), children: c2.has(N2.id) ? "Unmute for me" : "Mute for me" }), (0, t.jsx)("button", { type: "button", onClick: () => C2(true), children: "Report" }), B2 && U2 && !U2.removed && (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => void V(U2.chatMuted ? "unmute" : "mute"), children: U2.chatMuted ? "Unmute in room" : "Mute in room" }), (0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => A2("remove"), children: "Remove" }), (0, t.jsx)("button", { type: "button", disabled: L2, onClick: () => A2("ban"), children: "Ban from room" })] })] })] }), y2 && (0, t.jsx)(x, { code: y2.code, canTakeHost: !y2.rated && !B2, target: N2 }), D2 && (0, t.jsx)("p", { className: "pf-chat-notice", role: "status", children: D2 }), Y && (0, t.jsx)("p", { className: "pf-chat-notice", children: Y }), (0, t.jsxs)("form", { className: "pf-chat-in", onSubmit: (e3) => {
      e3.preventDefault(), K();
    }, children: [(0, t.jsx)("input", { ref: f2, type: "text", value: b2, maxLength: r.MAX_CHAT_LENGTH, disabled: !!Y, placeholder: "say something\u2026", "aria-label": "Chat message", autoComplete: "off", enterKeyHint: "send", onChange: (e3) => k2(e3.target.value), onKeyDown: (e3) => {
      "Escape" === e3.key && (N2 ? H(null) : m2?.());
    } }), (0, t.jsx)("button", { type: "submit", disabled: L2 || !!Y || !b2.trim(), children: "SEND" })] })] });
  }
  let k = (e2) => (0, p.getDescentAudio)().subscribeMute(e2), N = () => (0, p.getDescentAudio)().isMuted();
  function I() {
    let e2 = (0, s.useSyncExternalStore)(k, N, () => false);
    return (0, t.jsx)("button", { type: "button", className: "ds-mute" + (e2 ? " off" : ""), "aria-label": e2 ? "turn sound on" : "turn sound off", "aria-pressed": e2, onClick: () => (0, p.getDescentAudio)().toggleMuted(), children: (0, t.jsxs)("svg", { viewBox: "0 0 20 16", shapeRendering: "crispEdges", fill: "currentColor", "aria-hidden": "true", children: [(0, t.jsx)("path", { d: "M2 6h3l4-4v12l-4-4H2z" }), e2 ? (0, t.jsx)("path", { d: "M11 5h2v2h2V5h2v2h-2v2h2v2h-2V9h-2v2h-2V9h2V7h-2z" }) : (0, t.jsx)("path", { d: "M11 6h2v4h-2zM15 3h2v10h-2z" })] }) });
  }
  var S = e.i(34339), E = e.i(3823);
  function T({ inPlay: e2, rated: a2, guardBack: n2, onLeave: l2 }) {
    let r2 = (0, s.useRef)(null), i2 = (0, s.useId)(), o2 = (0, s.useId)(), d2 = (0, s.useRef)(e2), c2 = () => {
      let e3 = r2.current;
      e3 && !e3.open && (e3.showModal(), (0, E.notifyModalChange)());
    }, p2 = () => r2.current?.close();
    return (0, s.useEffect)(() => {
      d2.current = e2, e2 || r2.current?.close();
    }, [e2]), (0, s.useEffect)(() => {
      if (n2) {
        var e3, t2;
        let a3, n3, l3;
        return e3 = window, t2 = () => d2.current, a3 = e3.location.href, n3 = () => e3.history.pushState({ ...e3.history.state, krillionPartyGuard: e3.location.href }, "", e3.location.href), e3.history.state?.krillionPartyGuard !== e3.location.href && n3(), l3 = () => {
          e3.location.href === a3 && (t2() ? (n3(), c2()) : e3.history.back());
        }, e3.addEventListener("popstate", l3), () => e3.removeEventListener("popstate", l3);
      }
    }, [n2]), (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", className: "pf-leave", onClick: () => e2 ? c2() : l2(), "aria-label": "Leave room", title: "Leave room", children: (0, t.jsx)("svg", { viewBox: "0 0 20 20", fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": "true", children: (0, t.jsx)("path", { d: "M2 2h8v2H4v12h6v2H2z M8 9h8V7h-2V5h2v2h2v2h2v2h-2v2h-2v2h-2v-2h2v-2H8z" }) }) }), (0, t.jsx)("dialog", { ref: r2, className: "pf-confirm", "aria-labelledby": i2, "aria-describedby": o2, onClose: E.notifyModalChange, onClick: (e3) => {
      e3.target === e3.currentTarget && p2();
    }, children: (0, t.jsxs)("div", { className: "pf-panel", children: [(0, t.jsx)("h3", { id: i2, children: "LEAVE THE GAME?" }), (0, t.jsxs)("p", { id: o2, children: ["You're still floating. Leaving gives up your seat in this game, and you can't come back into it.", a2 && (0, t.jsx)(t.Fragment, { children: " This is a rated game\u2014leaving can cost you Elo." })] }), (0, t.jsxs)("div", { className: "pf-confirm-buttons", children: [(0, t.jsx)("button", { type: "button", className: "ds-next-btn", autoFocus: true, onClick: p2, children: "KEEP PLAYING" }), (0, t.jsx)("button", { type: "button", className: "pf-confirm-leave", onClick: () => {
      p2(), l2();
    }, children: "LEAVE" })] })] }) })] });
  }
  var A = e.i(3795);
  let R = { code: "", version: 0, phase: "lobby", settings: { ...r.DEFAULT_SETTINGS }, hostId: "", players: [], holderId: null, holderSince: null, category: null, countdownEndsAt: null, winnerId: null, gameNumber: 0, events: [], chat: [], now: 0 };
  e.s(["default", 0, function({ feed: e2, meId: b2, onAct: x2, onLeave: j2, onFindGame: k2, preview: N2, stream: E2 }) {
    let C2, M2 = (0, o.useFeedRoom)(e2), { muted: P2, toggle: L2 } = (C2 = (0, s.useSyncExternalStore)(g, y, () => "[]"), { muted: (0, s.useMemo)(() => new Set(f(C2)), [C2]), toggle: (0, s.useCallback)((e10) => {
      let t2 = new Set(f(y()));
      t2.has(e10) ? t2.delete(e10) : t2.add(e10), m = JSON.stringify([...t2].slice(-500));
      try {
        localStorage.setItem(u, m);
      } catch {
      }
      window.dispatchEvent(new Event(h));
    }, []) }), O2 = (0, s.useRef)(P2), F2 = (0, s.useRef)(null);
    (0, s.useEffect)(() => {
      O2.current = P2, F2.current?.();
    }, [P2]);
    let D2 = M2 ?? R, _2 = N2 || M2?.phase !== "round" ? null : M2.category?.text ?? null;
    (0, s.useEffect)(() => {
      _2 && (0, o.rememberCategory)(_2);
    }, [_2]);
    let $2 = (0, s.useRef)(null), B2 = (0, s.useRef)(null), U2 = (0, s.useRef)(null), Y = (0, s.useRef)(null), G = (0, s.useRef)(x2), H = !!N2?.hold, [q, K] = (0, s.useState)(null), [V, W] = (0, s.useState)(null), [z, J] = (0, s.useState)(null), [X, Q] = (0, s.useState)(null), [Z, ee] = (0, s.useState)(false), [et, ea] = (0, s.useState)(N2?.level ?? 0), [en, el] = (0, s.useState)(N2?.input ?? ""), [es, er] = (0, s.useState)(null), [ei, eo] = (0, s.useState)(false), ed = (0, s.useRef)(0), ec = (0, s.useRef)(N2?.input ?? ""), ep = (0, s.useRef)(null), eu = (0, s.useRef)(null), [eh] = (0, s.useState)(c), em = (0, s.useCallback)(() => {
      let e10 = ep.current;
      e10 && e10.revision === ed.current && (ed.current++, ec.current = "", el(""), eu.current?.clear(), eh.reset());
    }, [eh]), [ey, eg] = (0, s.useState)({}), [ef, ev] = (0, s.useState)(0), [eb, ex] = (0, s.useState)(false), [ej, ew] = (0, s.useState)(0), [ek, eN] = (0, s.useState)(false), [eI, eS] = (0, s.useState)(0), [eE, eT] = (0, s.useState)(false);
    (0, s.useEffect)(() => {
      G.current = x2;
    }, [x2]), (0, s.useEffect)(() => {
      var a2;
      let n2, l2, s2, o2, c2, u2 = $2.current;
      if (!u2) return;
      let h2 = (0, p.getDescentAudio)();
      h2.acquire(u2);
      let m2 = (a2 = (e10) => h2.event(e10), n2 = null, l2 = null, s2 = null, o2 = null, c2 = () => {
        null !== s2 && clearTimeout(s2), null !== o2 && clearTimeout(o2), s2 = o2 = null;
      }, { sync(e10, t2) {
        let r2 = null === n2;
        (n2?.gameNumber !== e10.gameNumber || "lobby" === e10.phase) && c2(), n2 = e10;
        let i2 = "round" === e10.phase && e10.holderId === b2 && e10.players.some((e11) => e11.id === b2 && e11.alive) ? `${e10.gameNumber}:${e10.holderSince}` : null, d2 = !r2 && null !== i2 && i2 !== l2;
        for (let r3 of (i2 !== l2 && (null !== s2 && clearTimeout(s2), s2 = null), l2 = i2, t2.filter((t3) => e10.now - t3.at <= 1500))) switch (r3.kind) {
          case "countdown":
            "countdown" === e10.phase && a2("begin");
            break;
          case "pass":
            r3.to === b2 && d2 || a2("submit_soft");
            break;
          case "reject":
            r3.playerId === b2 && a2("reject");
            break;
          case "spare":
            a2("spare");
            break;
          case "pop":
            a2("miss");
            break;
          case "win":
            r3.playerId && "over" === e10.phase && (null !== o2 && clearTimeout(o2), o2 = setTimeout(() => {
              o2 = null, n2?.phase === "over" && n2.gameNumber === e10.gameNumber && a2("surface");
            }, 1200));
        }
        if (d2 && null !== e10.holderSince && e10.now - e10.holderSince <= 1500) {
          let t3 = Math.max(0, e10.holderSince - e10.now);
          t3 > 0 ? s2 = setTimeout(() => {
            s2 = null, l2 === i2 && a2("submit_soft");
          }, t3) : a2("submit_soft");
        }
      }, destroy() {
        c2(), n2 = null, l2 = null;
      } }), y2 = (0, i.createPufferEngine)(u2, { cardBottom: () => B2.current ? B2.current.offsetTop + B2.current.offsetHeight : null, floorTop: () => {
        let e10 = u2.closest(".pf-root") ?? u2, t2 = e10.querySelector(".pf-round-end") ?? e10.querySelector(".pf-lobby-inner");
        return t2 ? t2.getBoundingClientRect().top - e10.getBoundingClientRect().top : null;
      }, hang: H, onLevel: (e10) => ea(e10) });
      Y.current = y2;
      let g2 = null, f2 = 0, v2 = {}, x3 = false, j3 = null, w2 = 0, k3 = null, I2 = 0, S2 = /* @__PURE__ */ new Set(), E3 = (e10, t2, a3 = false) => {
        if (H && !a3) return;
        let n3 = setTimeout(() => {
          S2.delete(n3), t2();
        }, e10);
        S2.add(n3);
      }, T2 = (e10) => {
        if (!e10 || "round" !== e10.phase || !e10.category) return null;
        let { index: t2, text: a3 } = e10.category, n3 = w2 && t2 !== w2 ? "new" : null;
        return w2 = t2, "new" === n3 && h2.event("category"), n3 && E3(3200, () => W((e11) => e11 && e11.index === t2 && e11.tag === n3 ? { ...e11, tag: null } : e11)), { index: t2, text: a3, cleared: false, leaving: false, tag: n3 };
      }, A2 = () => {
        x3 = false, ee(false), W(T2(e2.get()));
      }, R2 = (e10, t2) => ({ mode: "lobby" === e10.phase ? "lobby" : "round", phase: e10.phase, players: e10.players.filter((t3) => "lobby" === e10.phase ? false !== t3.ready && t3.connected : t3.alive || null !== t3.place).map((t3) => ({ id: t3.id, name: t3.name, character: t3.character, seat: t3.seat, lives: t3.lives, meter: t3.meter, alive: t3.alive, place: t3.place, connected: t3.connected, typing: O2.current.has(t3.id) ? null : t3.typing, hideFreeText: O2.current.has(t3.id) || !!t3.chatMuted || false === e10.chatEnabled, segs: v2[t3.id] ?? [], rating: void 0 === t3.rating ? null : (0, d.formatRating)(t3.rating), ratingDelta: t3.ratingDelta ?? null })), meId: b2, openSeats: "lobby" === e10.phase ? Math.max(0, e10.settings.maxPlayers - e10.players.filter((e11) => !e11.observer).length) : 0, holderId: "round" === e10.phase ? e10.holderId : null, holderSince: null === e10.holderSince ? null : e10.holderSince - t2, maxLives: e10.settings.lives, meterTarget: e10.settings.meterTarget, levelOverride: N2?.level ?? null }), C3 = (e10, a3) => {
        switch (e10.kind) {
          case "pass":
            y2.pass(e10.from, e10.answer, e10.tier), v2[e10.from] = (0, i.feedMeter)(v2[e10.from] ?? [], e10.tier), e10.from === b2 && (em(), J(null));
            break;
          case "reject":
            if (O2.current.has(e10.playerId) || y2.reject(e10.playerId, e10.text), e10.playerId === b2) {
              let t2 = ++I2;
              J({ text: e10.text, why: e10.why, key: t2 }), em(), E3(2200, () => J((e11) => e11 && e11.key === t2 ? null : e11));
            }
            break;
          case "spare":
            y2.spare(e10.playerId);
            break;
          case "pop": {
            let n3 = e10.livesLeft <= 0;
            if (y2.pop(e10.playerId, e10.livesLeft, n3), ("round" !== a3.phase || a3.category?.index !== w2) && (x3 = true, W(null), E3(n3 ? 900 : r.POP_FREEZE_MS, A2, true)), J(null), n3) {
              let n4, l3 = ++I2;
              Q({ node: (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { children: (n4 = e10.playerId, a3.players.find((e11) => e11.id === n4)?.name ?? "someone") }), " is out"] }), key: l3 }), E3(2400, () => Q((e11) => e11 && e11.key === l3 ? null : e11));
            }
            break;
          }
          case "category":
            "start" !== e10.why && y2.clearAnswers(), "cleared" === e10.why ? (x3 = true, ee(true), W((e11) => e11 ? { ...e11, cleared: true } : e11), E3(r.CATEGORY_SWAP_MS - 420, () => W((e11) => e11 ? { ...e11, leaving: true } : e11)), E3(r.CATEGORY_SWAP_MS, A2)) : "start" === e10.why && (x3 = false);
            break;
          case "win": {
            e10.playerId && y2.win(e10.playerId);
            let t2 = ++I2;
            E3(1200, () => K({ kind: "win", id: e10.playerId, key: t2 }), true);
            break;
          }
          case "lobby":
            x3 = false, w2 = 0, K(null), Q(null), ee(false);
        }
      };
      F2.current = () => {
        let t2 = e2.get();
        t2 && y2.sync(R2(t2, t2.now - Date.now()));
      };
      let M3 = e2.subscribe((e10) => {
        let t2 = e10.now - Date.now();
        ev(t2);
        let a3 = e10.events.length ? e10.events[e10.events.length - 1].seq : 0, n3 = [];
        if (e10.gameNumber !== f2 && (f2 = e10.gameNumber, v2 = {}, w2 = 0), null === g2) {
          for (let t3 of (function(e11) {
            for (let t4 = e11.length - 1; t4 >= 0; t4--) {
              let a4 = e11[t4].kind;
              if ("start" === a4) return e11.slice(t4);
              if ("lobby" === a4) return e11.slice(t4 + 1);
            }
            return e11;
          })(e10.events)) "pass" === t3.kind && (v2[t3.from] = (0, i.feedMeter)(v2[t3.from] ?? [], t3.tier));
          g2 = a3;
        } else {
          let t3 = g2;
          n3 = e10.events.filter((e11) => e11.seq > t3), g2 = Math.max(g2, a3);
        }
        for (let t3 of ("lobby" === e10.phase && (v2 = {}), m2.sync(e10, n3), n3)) "join" !== t3.kind && C3(t3, e10);
        for (let t3 of e10.players) v2[t3.id] = (0, i.reconcileMeter)(v2[t3.id] ?? [], t3.meter, e10.settings.meterTarget);
        for (let a4 of (eg({ ...v2 }), y2.sync(R2(e10, t2)), n3)) "join" === a4.kind && y2.join(a4.playerId);
        if (!x3) {
          let t3 = "round" === e10.phase && e10.category?.index === w2, a4 = T2(e10);
          W((e11) => t3 && e11 ? e11 : a4);
        }
        "over" !== e10.phase || n3.some((e11) => "win" === e11.kind) || "__over" === j3 || (e10.winnerId && y2.win(e10.winnerId, true), K((t3) => t3 ?? { kind: "win", id: e10.winnerId, key: ++I2 })), N2?.autoplay || "round" !== e10.phase || e10.holderId !== b2 || j3 === b2 || requestAnimationFrame(() => U2.current?.focus({ preventScroll: true })), j3 = "over" === e10.phase ? "__over" : e10.holderId, (e10.holderId !== b2 || "round" !== e10.phase) && eu.current?.clear();
        let l3 = "round" === e10.phase && null !== e10.holderSince ? e10.holderSince - t2 - Date.now() : 0;
        k3 && clearTimeout(k3), k3 = null, l3 > 0 ? (eT(true), k3 = setTimeout(() => {
          k3 = null, eT(false);
        }, l3 + 30)) : eT(false);
      }, true);
      return () => {
        for (let e10 of (M3(), k3 && clearTimeout(k3), S2)) clearTimeout(e10);
        m2.destroy(), h2.release(), y2.destroy(), Y.current = null, F2.current = null;
      };
    }, [e2, b2, H, N2?.level, N2?.autoplay, em]);
    let eA = V ? `${V.index}|${V.text}` : "";
    (0, s.useEffect)(() => {
      Y.current?.relayout();
      let e10 = B2.current;
      if (!e10) return;
      let t2 = new ResizeObserver(() => Y.current?.relayout());
      return t2.observe(e10), () => t2.disconnect();
    }, [eA]);
    let eR = "countdown" === D2.phase ? D2.countdownEndsAt : null;
    (0, s.useEffect)(() => {
      if (null === eR) return;
      let e10 = () => eS(Math.max(0, Math.ceil((eR - ef - Date.now()) / 1e3))), t2 = setTimeout(e10, 0), a2 = setInterval(e10, 200);
      return () => {
        clearTimeout(t2), clearInterval(a2), eS(0);
      };
    }, [eR, ef]);
    let eC = "lobby" === D2.phase ? D2.gatherEndsAt ?? null : null, [eM, eP] = (0, s.useState)(0);
    (0, s.useEffect)(() => {
      if (null === eC) return;
      let e10 = () => eP(Math.max(0, Math.ceil((eC - ef - Date.now()) / 1e3))), t2 = setTimeout(e10, 0), a2 = setInterval(e10, 250);
      return () => {
        clearTimeout(t2), clearInterval(a2);
      };
    }, [eC, ef]);
    let eL = D2.players.find((e10) => e10.id === b2) ?? null, eO = "round" === D2.phase && D2.holderId === b2 && !!eL?.alive && !eE, eF = !!N2?.autoplay && null !== es, eD = N2?.autoplay ? es ?? eL?.typing ?? "" : en;
    (0, s.useEffect)(() => {
      let e10 = /* @__PURE__ */ (function(e11, t2 = 220) {
        let a2 = null, n2 = null, l2 = false, s2 = false, r2 = 0, i2 = () => {
          s2 || l2 || n2 || null === a2 || (n2 = setTimeout(() => {
            n2 = null;
            let t3 = a2;
            a2 = null, r2 = Date.now(), l2 = true, e11(t3).catch(() => {
            }).finally(() => {
              l2 = false, i2();
            });
          }, Math.max(0, t2 - (Date.now() - r2))));
        };
        return { update(e12) {
          a2 = e12.slice(0, 40), i2();
        }, clear() {
          a2 = null, n2 && clearTimeout(n2), n2 = null;
        }, stop() {
          s2 = true, this.clear();
        } };
      })((e11) => G.current({ type: "typing", text: e11 }));
      return eu.current = e10, () => {
        e10.stop(), eu.current = null;
      };
    }, []);
    let e_ = (0, s.useCallback)(() => {
      let t2 = en.trim();
      eO && !ep.current && t2 && (ep.current = { revision: ed.current }, eu.current?.clear(), eo(true), G.current({ type: "submit", text: t2, input: eh.report() }).then((t3) => {
        t3.room && e2.push(t3.room), (t3.submit?.accepted || t3.submit?.why === "miss" || t3.submit?.why === "repeat") && em();
      }).catch(() => {
      }).finally(() => {
        ep.current = null, eo(false);
        let t3 = e2.get();
        t3?.phase === "round" && t3.holderId === b2 && ec.current && eu.current?.update(ec.current);
      }));
    }, [en, eO, e2, b2, em, eh]);
    (0, s.useEffect)(() => {
      if (!eO || N2?.autoplay) return;
      let e10 = (e11) => {
        let t2 = e11.target;
        t2 && (t2.closest("input, textarea, select, button, .pf-chat") || t2.isContentEditable) || e11.metaKey || e11.ctrlKey || e11.altKey || 1 !== e11.key.length || U2.current?.focus({ preventScroll: true });
      };
      return window.addEventListener("keydown", e10), () => window.removeEventListener("keydown", e10);
    }, [eO, N2?.autoplay]);
    let e$ = "lobby" === D2.phase, eB = D2.hostId === b2, eU = [...D2.players].sort((e10, t2) => e10.seat - t2.seat), eY = eU.filter((e10) => false !== e10.ready && e10.connected), eG = eL?.ready !== false, eH = eU.filter((e10) => e10.alive).length, eq = eU.filter((e10) => e10.alive || null !== e10.place).length, eK = D2.holderId ? eU.find((e10) => e10.id === D2.holderId) ?? null : null, eV = D2.winnerId ? eU.find((e10) => e10.id === D2.winnerId) ?? null : null, eW = e$ ? "preview" : "over" === D2.phase ? "feedback" : "answering", ez = eO && et >= 5, eJ = "over" === D2.phase ? q : null, eX = eU.find((e10) => e10.id === D2.hostId) ?? null, eQ = D2.queue ? r.QUICK_PLAY_TABLES[D2.queue] : null, eZ = !!eQ && !!D2.rated, e0 = eL?.rating === void 0 ? null : (0, d.formatRating)(eL.rating), e1 = null;
    if (eQ) {
      let e10 = eQ.min - eY.length;
      e1 = null !== eC ? (0, t.jsxs)(t.Fragment, { children: ["\u25B8 starting in ", (0, t.jsxs)("b", { children: [eM, "s"] }), " \xB7 more can still join"] }) : e10 <= 0 ? (0, t.jsx)(t.Fragment, { children: "\u25B8 the puffer is waking up" }) : 2 === eQ.max ? (0, t.jsxs)(t.Fragment, { children: ["\u25B8 finding an opponent", eZ ? " near your rating" : "", "\u2026"] }) : (0, t.jsxs)(t.Fragment, { children: ["\u25B8 waiting for ", (0, t.jsx)("b", { children: e10 }), " more ", 1 === e10 ? "player" : "players", "\u2026"] });
    }
    let e22 = eJ ? "end" : e$ ? "lobby" : "";
    (0, s.useEffect)(() => {
      Y.current?.relayout();
      let e10 = $2.current?.closest(".pf-root"), t2 = "end" === e22 ? e10?.querySelector(".pf-round-end") : "lobby" === e22 ? e10?.querySelector(".pf-lobby-inner") : null;
      if (!t2) return;
      let a2 = new ResizeObserver(() => Y.current?.relayout());
      return a2.observe(t2), () => a2.disconnect();
    }, [e22]);
    let e3 = eU.filter((e10) => !e10.observer).length, e4 = Math.max(0, D2.settings.maxPlayers - e3), e5 = D2.chat.length ? D2.chat[D2.chat.length - 1].id : 0, e6 = eb ? 0 : D2.chat.filter((e10) => e10.id > ej && e10.playerId && e10.playerId !== b2 && !P2.has(e10.playerId)).length, e7 = (t2) => {
      x2(t2).then((t3) => {
        t3.room && e2.push(t3.room);
      });
    }, e8 = (e10) => e7({ type: "settings", settings: e10 }), e9 = !(0, A.isPartyPaused)() && (0, t.jsxs)("label", { className: "pf-auto-join", title: "Automatically join the next game", children: [(0, t.jsx)("input", { type: "checkbox", "aria-label": "Auto-join next game", checked: !!eL?.autoJoin, onChange: (e10) => e7({ type: "auto-join", enabled: e10.target.checked }) }), (0, t.jsx)("span", { children: "AUTO-JOIN" })] }), te = null;
    if ("over" === D2.phase && eJ) te = eV ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { children: eV.name }), " ", eV.id === b2 ? "win" : "wins", " the puffer"] }) : (0, t.jsx)(t.Fragment, { children: "the ring emptied" });
    else if (X) te = X.node;
    else if ("countdown" === D2.phase) te = (0, t.jsx)(t.Fragment, { children: "the puffer is waking up" });
    else if ("over" === D2.phase) te = eV ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { children: eV.name }), " ", eV.id === b2 ? "win" : "wins", " the puffer"] }) : (0, t.jsx)(t.Fragment, { children: "the ring emptied" });
    else if (eF) te = (0, t.jsx)(t.Fragment, { children: "keyboard test \xB7 answers play automatically" });
    else if (Z) te = (0, t.jsx)(t.Fragment, { children: "category cleared" });
    else if ("round" === D2.phase && eK && !eE) {
      let e10 = eK.id === b2 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { children: "your puffer" }), " \xB7 type an answer"] }) : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { children: eK.name }), " is up"] });
      te = V?.tag === "new" ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("b", { children: "new category" }), " \xB7 ", e10] }) : e10;
    }
    let tt = eO ? "your puffer \u2014 type!" : eL && !eL.alive && "round" === D2.phase ? null === eL.place ? eL.ready ? "you're in next game \xB7 watching\u2026" : "spectating this game\u2026" : "you're out \xB7 watching\u2026" : X || eE ? "pop! hold on\u2026" : "round" === D2.phase && eK ? `${eK.name.toLowerCase()} is up\u2026` : "wait for the puffer\u2026", ta = ey[b2] ?? [], tn = ta.reduce((e10, t2) => [...e10, (e10[e10.length - 1] ?? 0) + t2.amt / D2.settings.meterTarget * 100], []), tl = ta.map((e10, t2) => `${(0, i.meterSegHex)(e10)} ${t2 ? tn[t2 - 1] : 0}% ${tn[t2]}%`), ts = tn[tn.length - 1] ?? 0;
    tl.push(`#12233d ${ts}% 100%`);
    let tr = [{ key: "lives", label: "LIVES", value: D2.settings.lives, min: 1, max: D2.settings.maxLives, fmt: String, patch: (e10) => ({ lives: e10 }) }, { key: "turn", label: "MIN. TURN", value: Math.round(D2.settings.minTurnMs / 1e3), min: 3, max: 15, fmt: (e10) => e10 + "s", patch: (e10) => ({ minTurnMs: 1e3 * e10 }) }, { key: "seats", label: "SEATS", value: D2.settings.maxPlayers, min: Math.max(r.MIN_PLAYERS_TO_START, e3), max: r.MAX_PLAYERS, fmt: String, patch: (e10) => ({ maxPlayers: e10 }) }, { key: "maxLives", label: "HEART CAP", value: D2.settings.maxLives, min: 1, max: r.MAX_LIVES, fmt: String, patch: (e10) => ({ maxLives: e10 }) }, { key: "meterTarget", label: "POINTS / HEART", value: D2.settings.meterTarget, min: r.METER_TARGET_STEP, max: r.MAX_METER_TARGET, step: r.METER_TARGET_STEP, fmt: String, patch: (e10) => ({ meterTarget: e10 }) }].map((e10) => (0, t.jsxs)("div", { className: "pf-set", children: [(0, t.jsx)("div", { className: "label", children: e10.label }), (0, t.jsxs)("div", { className: "val", children: [eB && (0, t.jsx)("button", { type: "button", "aria-label": `fewer ${e10.label.toLowerCase()}`, disabled: e10.value <= e10.min, onClick: () => e8(e10.patch(Math.max(e10.min, e10.value - (e10.step ?? 1)))), children: "\u25C0" }), (0, t.jsx)("span", { children: e10.fmt(e10.value) }), eB && (0, t.jsx)("button", { type: "button", "aria-label": `more ${e10.label.toLowerCase()}`, disabled: e10.value >= e10.max, onClick: () => e8(e10.patch(Math.min(e10.max, e10.value + (e10.step ?? 1)))), children: "\u25B6" })] })] }, e10.key)), ti = D2.settings.isPrivate ? "PRIVATE" : "PUBLIC", to = D2.settings.isPrivate ? "Make room public" : "Make room private", td = (e10) => (0, t.jsx)("button", { type: "button", className: "pf-privacy", disabled: !eB, onClick: () => e8({ isPrivate: !D2.settings.isPrivate }), "aria-label": eB ? to : void 0, title: eB ? to : "Only the host can change room visibility", children: D2.settings.isPrivate ? e10 ? "PRIVATE" : "PRIVATE \xB7 CODE ONLY" : e10 ? "PUBLIC" : "PUBLIC \xB7 LISTED" }), tc = () => {
      let e10 = `${window.location.origin}/party/${D2.code}`;
      navigator.clipboard?.writeText(e10).then(() => eN(true), () => eN(true));
    }, tp = async (t2) => {
      let a2 = await x2(t2);
      return a2.room && e2.push(a2.room), a2;
    }, tu = { admin: (0, v.usePartyAdmin)() ? { code: D2.code, rated: !!D2.rated } : void 0, chat: D2.chat, players: D2.players, meId: b2, hostId: D2.hostId, enabled: false !== D2.chatEnabled, muted: P2, onMute: L2, onAction: tp };
    return (0, t.jsx)(l.default, { phase: eW, railMode: "left", allowAdPreview: true, keyboardBehavior: "resize", children: (0, t.jsxs)("div", { className: "ds-root pf-root", "data-phase": eW, "data-mode": e$ ? "lobby" : "round", "data-world": "puffer", "data-loading": M2 ? void 0 : "", children: [(0, t.jsxs)("div", { className: "ds-stage", children: [(0, t.jsx)("div", { ref: $2, className: "pf-world" }), (0, t.jsxs)("div", { className: "ds-hud", children: [eQ ? (0, t.jsxs)("div", { className: "ds-pod ds-px pf-room-privacy", "aria-label": `${eZ ? "Rated" : "Unrated"} ${eQ.label} table ${D2.code}`, children: [(0, t.jsxs)("div", { className: "label", children: [eZ ? "RATED" : "UNRATED", " ", eQ.label] }), (0, t.jsx)("div", { className: "ds-depth-num", children: D2.code })] }) : (0, t.jsxs)("button", { type: "button", className: "ds-pod ds-px pf-room-privacy", disabled: !eB, onClick: () => e8({ isPrivate: !D2.settings.isPrivate }), "aria-label": `Room ${D2.code}: ${ti.toLowerCase()}${eB ? `. ${to}` : ""}`, title: eB ? to : "Only the host can change room visibility", children: [(0, t.jsxs)("div", { className: "label", children: [ti, eB && (0, t.jsx)("span", { "aria-hidden": "true", children: " \u2194" })] }), (0, t.jsx)("div", { className: "ds-depth-num", children: D2.code })] }), (0, t.jsx)("div", { className: "ds-hud-mid", children: (0, t.jsx)("div", { className: "ds-prompt-count pf-hud-label", children: e$ ? D2.gameNumber > 1 ? `GAME ${D2.gameNumber} \xB7 LOBBY` : "LOBBY" : "countdown" === D2.phase ? "GET READY" : "over" === D2.phase ? "GAME OVER" : `CATEGORY ${D2.category?.index ?? 1}` }) }), (0, t.jsxs)("div", { className: "ds-pod ds-px ds-score-pod", children: [(0, t.jsx)("div", { className: "label", children: e$ ? "READY" : "FLOATING" }), (0, t.jsx)("div", { className: "ds-score-num", children: e$ ? `${eY.length}/${D2.settings.maxPlayers}` : `${eH}/${eq}` })] })] }), V?.tag === "new" && !V.cleared && (0, t.jsxs)("div", { className: "ds-card ds-px pf-newcat", "aria-hidden": "true", children: [(0, t.jsx)("div", { className: "rnd", children: (0, t.jsxs)("span", { children: ["CATEGORY ", V.index] }) }), (0, t.jsx)("div", { className: "prompt", children: "New category" }), (0, t.jsx)("div", { className: "hint", children: "\u25BC here it comes \u25BC" })] }, `new-${V.index}`), V && (0, t.jsxs)("div", { ref: B2, className: "ds-card ds-px" + (V.cleared ? " cleared" : "") + (V.leaving ? " gone" : "") + (V.tag ? ` pf-card-${V.tag}` : "") + (V.text.length > 34 ? " long" : ""), children: [(0, t.jsxs)("div", { className: "rnd", children: [(0, t.jsxs)("span", { children: ["CATEGORY ", V.index] }), (0, t.jsx)("span", { className: V.tag && !V.cleared ? `pf-card-tag ${V.tag}` : void 0, children: V.cleared ? "CLEARED" : "new" === V.tag ? "NEW" : "" })] }), (0, t.jsx)("div", { className: "prompt", children: V.text }), (0, t.jsx)("div", { className: "hint", children: "\u25BC any answer passes the puffer \u25BC" })] }, V.index), "countdown" === D2.phase && eI > 0 && (0, t.jsxs)("div", { className: "pf-count", children: [(0, t.jsx)("div", { className: "n", children: eI }), (0, t.jsx)("div", { className: "s", children: "pass the puffer \xB7 don't let it pop on you" })] }, eI), eJ && (0, t.jsxs)("div", { className: "pf-winner ds-landed", role: "status", children: [eV && (0, t.jsx)(a.default, { className: "icon", src: (0, i.characterSprite)(eV.character, true), alt: "" }), (0, t.jsx)("div", { className: "tname", children: eV?.id === b2 ? "YOU WIN" : eV?.name ?? "ROUND OVER" }), (0, t.jsx)("div", { className: "tsub", children: eV?.id === b2 ? "last one floating" : eV ? "wins the round" : "the ring is empty" })] }, eJ.key), (0, t.jsxs)("aside", { className: "pf-side r", children: [e$ && !eZ && (0, t.jsxs)("div", { className: "pf-panel pf-lobby-side pf-lobby-code", children: [(0, t.jsx)("h3", { children: "ROOM CODE" }), (0, t.jsx)("div", { className: "pf-code", children: D2.code }), (0, t.jsx)("button", { type: "button", className: "pf-code-sub", onClick: tc, children: ek ? "link copied" : `krillion.io/party/${D2.code}` })] }), (0, t.jsx)(w, { className: "pf-panel chat", ...tu })] }), (0, t.jsx)("div", { className: "ds-crt" }), (0, t.jsx)(I, {}), (0, t.jsx)(T, { inPlay: ("round" === D2.phase || "countdown" === D2.phase) && !!eL?.alive, rated: eZ && "round" === D2.phase, guardBack: !N2 && !!M2, onLeave: j2 }), (0, t.jsxs)("button", { type: "button", className: "pf-chat-btn" + (eb ? " on" : ""), "aria-label": eb ? "close chat" : e6 ? `open chat, ${e6} new` : "open chat", "aria-expanded": eb, onClick: () => {
      ew(e5), ex((e10) => !e10);
    }, children: [(0, t.jsx)("svg", { viewBox: "0 0 20 18", shapeRendering: "crispEdges", fill: "currentColor", "aria-hidden": "true", children: (0, t.jsx)("path", { d: "M3 1h14v2h2v8h-2v2H9l-4 4v-4H3v-2H1V3h2z" }) }), e6 > 0 && (0, t.jsx)("span", { className: "pf-badge", children: e6 > 9 ? "9+" : e6 })] })] }), e$ && (0, t.jsxs)("div", { className: "pf-lobby", children: [(0, t.jsxs)("div", { className: "pf-lobby-title", children: [(0, t.jsx)("div", { className: "ds-title", children: "KRILLION".split("").map((e10, a2) => (0, t.jsx)("span", { style: { animationDelay: `${0.18 * a2}s` }, children: e10 }, a2)) }), (0, t.jsx)("div", { className: "ds-tagline", children: "PUFFER PARTY" }), (0, t.jsx)("div", { className: "pf-lobby-sub", children: "pass the puffer \xB7 don't let it pop on you" })] }), (0, t.jsx)("div", { className: "pf-lobby-foot", children: (0, t.jsxs)("div", { className: "pf-lobby-inner", children: [eQ ? (0, t.jsxs)("div", { className: "pf-settings pf-rated-info", children: [(0, t.jsxs)("div", { className: "pf-set", children: [(0, t.jsx)("div", { className: "label", children: eZ ? "RATED TABLE" : "QUICK PLAY" }), (0, t.jsx)("div", { className: "val", children: (0, t.jsx)("span", { children: eQ.label }) })] }), eZ ? (0, t.jsxs)("div", { className: "pf-set", children: [(0, t.jsx)("div", { className: "label", children: "YOUR RATING" }), (0, t.jsx)("div", { className: "val", children: (0, t.jsx)("span", { children: e0 ?? "\u2014" }) })] }) : (0, t.jsxs)("div", { className: "pf-set", title: "This game doesn't change anyone's rating", children: [(0, t.jsx)("div", { className: "label", children: "RATING" }), (0, t.jsx)("div", { className: "val", children: (0, t.jsx)("span", { children: "OFF" }) })] }), (0, t.jsxs)("div", { className: "pf-set", children: [(0, t.jsx)("div", { className: "label", children: "LIVES" }), (0, t.jsx)("div", { className: "val", children: (0, t.jsx)("span", { children: D2.settings.lives }) })] })] }) : (0, t.jsxs)("div", { className: "pf-settings", children: [tr.slice(0, 3), (0, t.jsxs)("details", { className: "pf-rules", children: [(0, t.jsxs)("summary", { className: "pf-set", children: [(0, t.jsx)("span", { className: "label", children: "RULES" }), (0, t.jsx)("span", { className: "val", children: "EDIT" })] }), (0, t.jsxs)("div", { className: "pf-panel pf-rules-panel", children: [(0, t.jsx)("h3", { children: "HEART RULES" }), tr.slice(3), (0, t.jsxs)("div", { className: "pf-set pf-set-row", children: [(0, t.jsx)("div", { className: "label", children: "ROOM" }), (0, t.jsx)("div", { className: "val", children: td(true) })] })] })] })] }), eG || eL?.observer && eB ? eQ ? (0, t.jsx)("div", { className: "pf-wait", role: "status", children: e1 }) : eB ? (0, t.jsx)("button", { type: "button", className: "ds-begin-btn pf-start", disabled: eY.length < r.MIN_PLAYERS_TO_START, onClick: () => e7({ type: "start" }), children: "\u25BC WAKE THE PUFFER \u25BC" }) : (0, t.jsxs)("div", { className: "pf-wait", children: ["\u25B8 waiting for ", (0, t.jsx)("b", { children: eX?.name ?? "the host" }), " to wake the puffer"] }) : (0, t.jsx)("button", { type: "button", className: "ds-begin-btn pf-start", onClick: () => e7({ type: "again" }), children: "JOIN NEXT GAME" }), (0, t.jsxs)("div", { className: "ds-intro-meta", children: [(0, t.jsxs)("span", { className: "pf-seats-line", children: [eY.length, " READY", eU.length > eY.length ? ` \xB7 ${eU.length - eY.length} WATCHING` : e4 ? ` \xB7 ${e4} OPEN` : " \xB7 FULL"] }), (0, t.jsxs)("span", { className: "pf-meta-btns", children: [e9, (0, t.jsx)(S.default, { launcherClassName: "pf-invite" }), !eQ && (0, t.jsxs)("details", { className: "pf-desktop-rules", children: [(0, t.jsx)("summary", { className: "pf-invite", children: "ROOM SETTINGS" }), (0, t.jsxs)("div", { className: "pf-panel pf-rules-panel", children: [(0, t.jsx)("h3", { children: "ROOM SETTINGS" }), tr, (0, t.jsxs)("div", { className: "pf-set pf-set-row", children: [(0, t.jsx)("div", { className: "label", children: "ROOM" }), (0, t.jsx)("div", { className: "val", children: td(true) })] })] })] }), !eZ && (0, t.jsx)("a", { href: `/party/${D2.code}`, className: "pf-invite", onClick: (e10) => {
      e10.preventDefault(), tc();
    }, children: ek ? "LINK COPIED" : "INVITE" })] })] })] }) })] }), (0, t.jsx)("div", { className: "pf-status" + (z ? " gone" : ""), children: te && (0, t.jsxs)(t.Fragment, { children: ["\u25B8 ", te] }) }), z && (0, t.jsx)("div", { className: "ds-reject ds-reject-shake", children: "repeat" === z.why ? (0, t.jsxs)(t.Fragment, { children: ["\u201C", z.text, "\u201D: already said"] }) : (0, t.jsxs)(t.Fragment, { children: ["\u201C", z.text, "\u201D: no echo. keep going"] }) }, z.key), (0, t.jsx)("div", { className: "ds-dock" + (ez ? " hot" : ""), children: (0, t.jsxs)("div", { className: "ds-dock-inner", children: [(0, t.jsxs)("div", { className: "ds-sonar-wrap", children: [(0, t.jsx)("div", { className: "pf-scope-ring", style: { "--pf-ring": tl.join(", ") } }), (0, t.jsx)("div", { className: "ds-sonar-scope", children: (0, t.jsx)("div", { className: "ds-sweep" }) }), (0, t.jsxs)("div", { className: "ds-time-digits", children: [(0, t.jsx)("span", { dangerouslySetInnerHTML: { __html: i.HEART_SVG } }), eL?.lives ?? 0] })] }), (0, t.jsxs)("div", { className: "ds-input-col" + (z ? " ds-reject-shake" : ""), children: [(0, t.jsx)("input", { ref: U2, className: "ds-input", type: "text", autoComplete: "off", autoCapitalize: "off", autoCorrect: "off", spellCheck: false, enterKeyHint: "send", maxLength: 60, placeholder: N2?.autoplay ? "tap to test keyboard\u2026" : tt, "aria-label": eF ? "Keyboard test" : "Your answer", disabled: !N2?.autoplay && ("round" !== D2.phase || !eL?.alive), value: eD, onFocus: () => {
      N2?.autoplay && er((e10) => e10 ?? "");
    }, onChange: (e10) => {
      N2?.autoplay ? er(e10.target.value) : (eh.note(e10.nativeEvent, e10.target.value), ed.current++, ec.current = e10.target.value, el(e10.target.value), eO && !ep.current && eu.current?.update(e10.target.value));
    }, onKeyDown: (e10) => {
      "Enter" !== e10.key || e10.nativeEvent.isComposing || (e10.preventDefault(), N2?.autoplay ? er("") : e_());
    } }), (0, t.jsx)("div", { className: "ds-fuse", children: (0, t.jsx)("div", { className: "ds-fuse-fill", style: { transform: `scaleX(${("round" === D2.phase ? et / 5 : 0).toFixed(2)})` } }) })] }), (0, t.jsx)("button", { type: "button", className: "ds-dive-btn", "aria-label": N2?.autoplay ? void 0 : "Send answer", disabled: N2?.autoplay ? !es?.trim() : !eO || ei || !en.trim(), onPointerDown: (e10) => e10.preventDefault(), onClick: N2?.autoplay ? () => er("") : e_, children: N2?.autoplay ? eF ? "CLEAR" : "AUTO" : ei ? "\u2026" : "SEND" })] }) }), eJ && (0, t.jsxs)("div", { className: "ds-next-wrap pf-round-end", children: [D2.gameId && eL && null !== eL.place && (0, t.jsx)("div", { className: "pf-feedback", children: (0, t.jsx)(n.default, { game: D2.gameId, prompt: "how was that round?", scaleLabels: ["1 \xB7 meh", "5 \xB7 great"], notesPlaceholder: "anything we should improve?", preview: !!N2 }, D2.gameId) }), eL?.rating !== void 0 && void 0 !== eL.ratingDelta && (0, t.jsxs)("div", { className: "pf-rating-change", role: "status", children: ["RATING ", (0, t.jsx)("b", { children: (0, d.formatRating)(eL.rating) }), " ", (0, t.jsx)("i", { className: eL.ratingDelta > 0 ? "up" : eL.ratingDelta < 0 ? "down" : void 0, children: eL.ratingDelta > 0 ? `+${eL.ratingDelta}` : eL.ratingDelta < 0 ? eL.ratingDelta : "\xB10" })] }), (0, t.jsx)("div", { className: "pf-end-buttons" + (eQ ? " two" : ""), children: (0, A.isPartyPaused)() ? (0, t.jsx)("p", { role: "status", children: A.PARTY_DRAIN_MESSAGE }) : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", className: "ds-next-btn", onClick: () => e7({ type: "again" }), children: eQ?.max === 2 ? "REMATCH" : "PLAY AGAIN" }), eQ && k2 && (0, t.jsx)("button", { type: "button", className: "ds-next-btn pf-find-game", onClick: k2, children: 2 === eQ.max ? "NEW OPPONENT" : "NEW TABLE" })] }) }), e9] }), eb && (0, t.jsx)("div", { className: "pf-chat-sheet", children: (0, t.jsx)(w, { className: "pf-panel chat", ...tu, autoFocus: true, onClose: () => {
      ew(e5), ex(false);
    } }) }), !M2 && (0, t.jsx)("div", { className: "pf-loading", children: "reconnecting" === E2 ? "reconnecting\u2026" : "swimming in\u2026" }), M2 && "reconnecting" === E2 && (0, t.jsx)("div", { className: "pf-loading small", children: "reconnecting\u2026" })] }) });
  }], 91427);
  let C = ["lobby", "lobby-full", "round", "round-full", "waiting", "typing", "reject", "hot", "pop", "out", "win", "over", "rated-lobby", "rated-gather", "rated-round", "rated-over", "quick-lobby"], M = "p-you", P = [{ id: M, name: "YOU", character: "krill" }, { id: "p-inkjet", name: "INKJET", character: "rare" }, { id: "p-lantern", name: "LANTERNJAW", character: "deepcut" }, { id: "p-mwahaha", name: "MWAHAHA", character: "evil-krill" }, { id: "p-glub", name: "GLUBTRON", character: "schooler" }, { id: "p-finn", name: "FINN", character: "schooler" }, { id: "p-pearl", name: "PEARL", character: "rare" }, { id: "p-kelp", name: "KELP", character: "krill" }, { id: "p-bubbles", name: "BUBBLES", character: "schooler" }, { id: "p-abyss", name: "ABYSS", character: "deepcut" }, { id: "p-salty", name: "SALTY", character: "evil-krill" }, { id: "p-coral", name: "CORAL", character: "rare" }, { id: "p-ripple", name: "RIPPLE", character: "schooler" }, { id: "p-squid", name: "SQUID", character: "rare" }, { id: "p-murky", name: "MURKY", character: "deepcut" }, { id: "p-shrimp", name: "SHRIMP", character: "krill" }], L = ["", "Name something sprayed out of a can", "Name a way to prepare eggs", "Name a part of a computer", "Name a building material", "Name a celebrity chef"];
  function O(e2) {
    let t2 = P[e2];
    return { id: t2.id, name: t2.name, character: t2.character, seat: e2, isHost: 0 === e2, connected: true, lives: 2, meter: 0, alive: true, answers: 0, pops: 0, best: null, typing: null, lastAnswer: null, place: null };
  }
  class F {
    now;
    seq;
    events;
    chat;
    players;
    settings;
    version;
    constructor(e2, t2 = 6) {
      this.now = e2, this.seq = 0, this.events = [], this.chat = [], this.settings = { ...r.DEFAULT_SETTINGS }, this.version = 40, this.players = P.slice(0, t2).map((e3, t3) => O(t3));
    }
    ev(e2, t2 = this.now) {
      let a2 = { ...e2, seq: ++this.seq, at: t2 };
      return this.events.push(a2), a2;
    }
    say(e2, t2, a2) {
      let n2 = this.players.find((t3) => t3.id === e2);
      this.chat.push({ id: this.chat.length + 1, at: this.now, playerId: e2, name: a2 ?? n2?.name ?? "", text: t2 });
    }
    p(e2) {
      return this.players.find((t2) => t2.id === e2);
    }
    pass(e2, t2, a2) {
      let n2 = this.p(e2), l2 = this.players.filter((e3) => e3.alive), s2 = l2.findIndex((t3) => t3.id === e2), o2 = l2[(s2 + 1) % l2.length].id;
      return n2.answers++, n2.meter += r.METER_BY_TIER[a2], (!n2.best || i.TIER_RANK[a2] > i.TIER_RANK[n2.best]) && (n2.best = a2), n2.lastAnswer = { text: t2, tier: a2 }, this.ev({ kind: "pass", from: e2, to: o2, answer: t2, tier: a2 }), n2.meter >= this.settings.meterTarget && n2.lives < this.settings.maxLives && (n2.lives++, n2.meter -= this.settings.meterTarget, this.ev({ kind: "spare", playerId: n2.id, lives: n2.lives })), n2.meter = Math.min(this.settings.meterTarget, n2.meter), o2;
    }
    opening() {
      for (let e2 of this.players) this.ev({ kind: "join", playerId: e2.id });
      for (let e2 of (this.say(null, "room KRLP opened", ""), this.players.slice(1))) this.say(null, `${e2.name} joined`, "");
      this.ev({ kind: "countdown", endsAt: this.now }), this.ev({ kind: "start", holderId: "p-inkjet" }), this.ev({ kind: "category", why: "start", index: 1, holderId: "p-inkjet" }), this.say("p-inkjet", "gl everyone"), this.say("p-mwahaha", "mwahaha");
    }
    room(e2) {
      let t2 = { code: "KRLP", version: ++this.version, phase: "round", settings: { ...this.settings }, hostId: M, players: structuredClone(this.players), holderId: null, holderSince: null, category: null, countdownEndsAt: null, winnerId: null, gameNumber: 1, gameId: "party:preview", events: this.events.slice(), chat: this.chat.slice(), now: this.now, ...e2 };
      return t2.players = t2.players.map((e3) => ({ ...e3, autoJoin: false, ready: "lobby" === t2.phase || !e3.alive && null === e3.place })), t2;
    }
  }
  let D = (e2, t2 = 8, a2 = 0) => ({ index: e2, text: L[e2], threshold: t2, accepted: a2 });
  function _(e2, t2) {
    let a2 = new F(e2);
    a2.opening(), a2.pass("p-inkjet", "Bear spray", "rare"), a2.pass("p-lantern", "Fake snow", "deepcut"), a2.pass("p-mwahaha", "Silly String", "schooler"), a2.pass("p-glub", "Hairspray", "plankton"), a2.pass("p-finn", "Spray cheese", "rare"), a2.pass(M, "Whipped cream", "plankton");
    let n2 = a2.p("p-inkjet");
    n2.lives = 1, n2.pops = 1, a2.ev({ kind: "pop", playerId: "p-inkjet", livesLeft: 1 }), a2.ev({ kind: "category", why: "pop", index: 2, holderId: "p-lantern" });
    let l2 = "p-lantern";
    for (let [e3, n3, s2] of [["p-lantern", "Eggs Benedict", "schooler"], ["p-mwahaha", "Poached eggs", "plankton"], ["p-glub", "Scrambled eggs", "plankton"], ["p-finn", "Frittata", "schooler"], [M, "Omelette", "schooler"], ["p-inkjet", "Shakshuka", "deepcut"]].slice(0, t2)) l2 = a2.pass(e3, n3, s2);
    return a2.say("p-finn", "eggs again??"), { t: a2, holder: l2, accepted: t2 };
  }
  function $(e2, t2, a2, n2) {
    return t2.now = e2.now + a2, { after: a2, room: t2.room({ ...e2, ...n2, version: e2.version + 1, events: t2.events.slice(), chat: t2.chat.slice(), players: structuredClone(t2.players), now: t2.now }) };
  }
  let B = [1342, 1418, 1275, 1505, 1199, 1366, 1290, 1460];
  function U(e2, t2) {
    e2.settings.maxPlayers = r.QUICK_PLAY_TABLES[t2].max, e2.players.forEach((e3, t3) => {
      Object.assign(e3, { rating: B[t3 % B.length] });
    });
  }
  e.s(["buildFixture", 0, function(e2, t2 = Date.now()) {
    switch (e2) {
      case "quick-lobby": {
        let e3 = new F(t2, 2);
        for (let t3 of (e3.settings.maxPlayers = r.QUICK_PLAY_TABLES.trio.max, e3.players)) e3.ev({ kind: "join", playerId: t3.id });
        for (let t3 of e3.players) e3.say(null, `${t3.name} joined`, "");
        return { meId: M, base: e3.room({ phase: "lobby", queue: "trio", rated: false, gatherEndsAt: null }), steps: [] };
      }
      case "rated-lobby": {
        let e3 = new F(t2, 1);
        return U(e3, "duel"), e3.ev({ kind: "join", playerId: M }), e3.say(null, "YOU joined", ""), { meId: M, base: e3.room({ phase: "lobby", queue: "duel", rated: true, gatherEndsAt: null }), steps: [] };
      }
      case "rated-gather": {
        let e3 = new F(t2, 5);
        for (let t3 of (U(e3, "party"), e3.players)) e3.ev({ kind: "join", playerId: t3.id });
        for (let t3 of e3.players) e3.say(null, `${t3.name} joined`, "");
        return { meId: M, base: e3.room({ phase: "lobby", queue: "party", rated: true, gatherEndsAt: t2 + 12e3 }), steps: [] };
      }
      case "rated-round": {
        let e3 = new F(t2, 3);
        U(e3, "trio"), e3.opening(), e3.pass("p-inkjet", "Bear spray", "rare"), e3.pass("p-lantern", "Spray paint", "plankton"), e3.p(M).typing = "whipped cre";
        let a2 = e3.room({ queue: "trio", rated: true, holderId: M, holderSince: t2 - 2400, category: D(1, 7, 1) });
        return { meId: M, base: a2, steps: [], input: "whipped cre", level: 2 };
      }
      case "rated-over": {
        let e3 = new F(t2, 2);
        U(e3, "duel"), e3.opening(), e3.pass("p-inkjet", "Bear spray", "rare"), e3.pass(M, "Silly String", "schooler"), Object.assign(e3.p("p-inkjet"), { lives: 0, alive: false, place: 2, pops: 2, rating: 1400, ratingDelta: -18 }), Object.assign(e3.p(M), { place: 1, rating: 1367, ratingDelta: 25 }), e3.ev({ kind: "out", playerId: "p-inkjet", place: 2 }), e3.ev({ kind: "win", playerId: M }), e3.say("p-inkjet", "gg");
        let a2 = e3.room({ phase: "over", queue: "duel", rated: true, hostId: M, holderId: null, holderSince: null, winnerId: M, category: D(1, 7, 2) });
        return { meId: M, base: a2, steps: [] };
      }
      case "lobby-full":
      case "round-full": {
        let a2 = new F(t2, r.MAX_PLAYERS);
        a2.settings.maxPlayers = r.MAX_PLAYERS, a2.opening();
        let n2 = "lobby-full" === e2;
        return { meId: M, base: a2.room({ phase: n2 ? "lobby" : "round", holderId: n2 ? null : "p-inkjet", holderSince: n2 ? null : t2 - 2800, category: n2 ? null : D(2) }), steps: [], level: n2 ? null : 2 };
      }
      case "lobby": {
        let e3 = new F(t2, 5);
        for (let t3 of e3.players) e3.ev({ kind: "join", playerId: t3.id });
        for (let t3 of (e3.say(null, "room KRLP opened", ""), e3.players.slice(1))) e3.say(null, `${t3.name} joined`, "");
        e3.say("p-glub", "hi all"), e3.say("p-lantern", "who's hosting");
        let a2 = { ...r.DEFAULT_SETTINGS }, n2 = e3.room({ phase: "lobby", settings: a2 });
        return e3.players.push(O(5)), e3.ev({ kind: "join", playerId: "p-finn" }), e3.say(null, "FINN joined", ""), { meId: M, base: n2, steps: [$(n2, e3, 1100, { phase: "lobby", settings: a2 })] };
      }
      case "round": {
        let { t: e3, holder: a2, accepted: n2 } = _(t2, 1);
        return e3.p(a2).typing = "sunny side u", { meId: M, base: e3.room({ holderId: a2, holderSince: t2 - 2800, category: D(2, 8, n2) }), steps: [], level: 2 };
      }
      case "waiting": {
        let e3 = new F(t2), a2 = e3.p(M);
        e3.players = e3.players.filter((e4) => e4.id !== M), e3.players.forEach((e4, t3) => {
          e4.seat = t3, e4.isHost = 0 === t3;
        }), e3.opening(), e3.pass("p-inkjet", "Fried eggs", "plankton");
        let n2 = e3.pass("p-lantern", "Poached eggs", "schooler");
        return e3.p(n2).typing = "scrambled e", Object.assign(a2, { seat: e3.players.length, isHost: false, lives: 0, alive: false }), e3.players.push(a2), e3.ev({ kind: "join", playerId: M }), e3.say(null, "YOU joined", ""), { meId: M, base: e3.room({ hostId: "p-inkjet", holderId: n2, holderSince: t2 - 2800, category: D(2, 8, 2) }), steps: [], level: 2 };
      }
      case "typing": {
        let { t: e3, holder: a2, accepted: n2 } = _(t2, 4);
        return e3.p(a2).typing = "deviled eg", { meId: M, base: e3.room({ holderId: a2, holderSince: t2 - 2600, category: D(2, 8, n2) }), steps: [], input: "deviled eg", level: 2 };
      }
      case "reject": {
        let { t: e3, holder: a2, accepted: n2 } = _(t2, 4), l2 = e3.room({ holderId: a2, holderSince: t2 - 4e3, category: D(2, 8, n2) });
        return e3.ev({ kind: "reject", playerId: M, text: "poached", why: "repeat" }), { meId: M, base: l2, steps: [$(l2, e3, 600, {})], input: "poached", level: 3 };
      }
      case "hot": {
        let { t: e3, holder: a2, accepted: n2 } = _(t2, 4);
        return e3.p("p-lantern").lives = 1, e3.p("p-lantern").pops = 1, { meId: M, base: e3.room({ holderId: a2, holderSince: t2 - 8200, category: D(2, 8, n2) }), steps: [], input: "huevos ranch", level: 5 };
      }
      case "pop": {
        let { t: e3, holder: a2, accepted: n2 } = _(t2, 6);
        e3.p(a2).typing = "oeufs en cocot";
        let l2 = e3.room({ holderId: a2, holderSince: t2 - 7600, category: D(2, 8, n2) }), s2 = e3.p(a2);
        return s2.typing = null, s2.lives = 1, s2.pops = 1, e3.ev({ kind: "pop", playerId: a2, livesLeft: 1 }, t2 + 700), e3.ev({ kind: "category", why: "pop", index: 3, holderId: "p-mwahaha" }, t2 + 700), { meId: M, base: l2, steps: [$(l2, e3, 700, { holderId: "p-mwahaha", holderSince: t2 + 700 + r.POP_FREEZE_MS, category: D(3) })], level: 5 };
      }
      case "out": {
        let e3 = new F(t2);
        for (let t3 of (e3.opening(), e3.pass("p-inkjet", "Bear spray", "rare"), e3.pass("p-lantern", "Fake snow", "deepcut"), e3.pass("p-mwahaha", "Silly String", "schooler"), e3.pass("p-glub", "Hairspray", "plankton"), e3.pass("p-finn", "Spray cheese", "rare"), e3.pass(M, "Thermal paste", "rare"), e3.pass("p-inkjet", "Graphics card", "schooler"), e3.pass("p-lantern", "Northbridge", "deepcut"), Object.assign(e3.p("p-finn"), { lives: 0, alive: false, place: 6, pops: 2 }), ["p-mwahaha", "p-inkjet", M])) Object.assign(e3.p(t3), { lives: 1, pops: 1 });
        e3.ev({ kind: "out", playerId: "p-finn", place: 6 }), e3.ev({ kind: "category", why: "pop", index: 3, holderId: "p-mwahaha" }), e3.p("p-mwahaha").typing = "mouse pa";
        let a2 = e3.room({ holderId: "p-mwahaha", holderSince: t2 - 5600, category: D(3, 7, 2) });
        return Object.assign(e3.p("p-mwahaha"), { typing: null, lives: 0, alive: false, place: 5, pops: 2 }), e3.ev({ kind: "pop", playerId: "p-mwahaha", livesLeft: 0 }, t2 + 700), e3.ev({ kind: "out", playerId: "p-mwahaha", place: 5 }, t2 + 700), e3.ev({ kind: "category", why: "pop", index: 4, holderId: "p-glub" }, t2 + 700), { meId: M, base: a2, steps: [$(a2, e3, 700, { holderId: "p-glub", holderSince: t2 + 700 + r.POP_FREEZE_MS, category: D(4) })], level: 4 };
      }
      case "win":
      case "over": {
        let a2 = new F(t2);
        for (let [e3, t3] of (a2.opening(), a2.pass("p-inkjet", "Bear spray", "rare"), a2.pass("p-lantern", "Fake snow", "deepcut"), a2.pass("p-mwahaha", "Silly String", "schooler"), a2.pass("p-glub", "WD-40", "schooler"), a2.pass("p-finn", "Spray cheese", "rare"), a2.pass(M, "Mycelium", "krillion"), a2.pass("p-inkjet", "Cob", "deepcut"), a2.pass(M, "Gordon Ramsay", "plankton"), a2.pass("p-inkjet", "Julia Child", "plankton"), a2.pass(M, "Fannie Farmer", "deepcut"), [["p-finn", 6], ["p-glub", 5], ["p-mwahaha", 4], ["p-lantern", 3]])) Object.assign(a2.p(e3), { lives: 0, alive: false, place: t3, pops: 2 }), a2.ev({ kind: "out", playerId: e3, place: t3 });
        a2.p("p-inkjet").lives = 1, a2.p("p-inkjet").pops = 1, a2.p(M).pops = 1, a2.p("p-inkjet").typing = "julia chi", a2.ev({ kind: "category", why: "pop", index: 5, holderId: "p-inkjet" });
        let n2 = { ...r.DEFAULT_SETTINGS }, l2 = a2.room({ holderId: "p-inkjet", holderSince: t2 - 6e3, category: D(5, 8, 3), settings: n2 });
        Object.assign(a2.p("p-inkjet"), { typing: null, lives: 0, alive: false, place: 2, pops: 2 }), a2.p(M).place = 1;
        let s2 = "win" === e2 ? t2 + 700 : t2;
        if (a2.ev({ kind: "pop", playerId: "p-inkjet", livesLeft: 0 }, s2), a2.ev({ kind: "out", playerId: "p-inkjet", place: 2 }, s2), a2.ev({ kind: "win", playerId: M }, s2), a2.say(null, "YOU is the last one floating", ""), a2.say("p-inkjet", "gg"), "win" === e2) return { meId: M, base: l2, steps: [$(l2, a2, 700, { phase: "over", holderId: null, holderSince: null, winnerId: M })], level: 4 };
        let i2 = a2.room({ phase: "over", holderId: null, holderSince: null, winnerId: M, category: D(5, 8, 3), settings: n2 });
        return { meId: M, base: i2, steps: [] };
      }
    }
  }, "buildFlowFixture", 0, function(e2 = Date.now()) {
    let t2 = new F(e2, 4);
    for (let e3 of t2.players) t2.ev({ kind: "join", playerId: e3.id });
    t2.say(null, "room KRLP opened", ""), t2.say("p-inkjet", "gl everyone"), t2.say("p-mwahaha", "mwahaha");
    let a2 = { ...r.DEFAULT_SETTINGS, maxPlayers: 4 }, n2 = "lobby", l2 = null, s2 = null, i2 = null, o2 = null, d2 = null, c2 = () => t2.room({ phase: n2, holderId: l2, holderSince: s2, countdownEndsAt: i2, category: o2 ? { ...o2 } : null, winnerId: d2, settings: a2 }), p2 = c2(), u2 = [], h2 = (a3, n3) => {
      t2.now = e2 + a3, n3(), u2.push({ after: a3, room: c2() });
    }, m2 = (e3, a3, n3 = 5) => {
      o2 = { index: (o2?.index ?? 0) + 1, text: e3, threshold: n3, accepted: 0 }, t2.ev({ kind: "category", why: a3, index: o2.index, holderId: l2 });
    }, y2 = (e3, a3) => h2(e3, () => {
      t2.p(l2).typing = a3;
    }), g2 = (e3, a3, n3) => h2(e3, () => {
      t2.p(l2).typing = "", t2.ev({ kind: "reject", playerId: l2, text: a3, why: n3 });
    }), f2 = (e3, a3, n3, i3, d3 = 5) => h2(e3, () => {
      let e4 = t2.p(l2);
      e4.typing = null, l2 = t2.pass(e4.id, a3, n3), s2 = t2.now, o2.accepted++, i3 && (m2(i3, "cleared", d3), s2 += r.CATEGORY_SWAP_MS);
    }), v2 = (e3, a3, i3 = 5) => h2(e3, () => {
      let e4 = t2.p(l2);
      e4.typing = null, e4.lives--, e4.pops++, t2.ev({ kind: "pop", playerId: e4.id, livesLeft: e4.lives }), 0 === e4.lives && (e4.place = t2.players.filter((e5) => e5.alive).length, e4.alive = false, t2.ev({ kind: "out", playerId: e4.id, place: e4.place }));
      let o3 = t2.players.filter((e5) => e5.alive);
      if (1 === o3.length) n2 = "over", d2 = o3[0].id, o3[0].place = 1, l2 = null, s2 = null, t2.ev({ kind: "win", playerId: d2 }), t2.say("p-inkjet", "gg!");
      else {
        var c3;
        let n3;
        c3 = e4.id, n3 = t2.players.findIndex((e5) => e5.id === c3), l2 = [...t2.players.slice(n3 + 1), ...t2.players.slice(0, n3 + 1)].find((e5) => e5.alive).id, s2 = t2.now + r.POP_FREEZE_MS, a3 && m2(a3, "pop", i3);
      }
    });
    h2(0, () => {
      n2 = "countdown", i2 = e2 + r.COUNTDOWN_MS, t2.ev({ kind: "countdown", endsAt: i2 });
    }), h2(r.COUNTDOWN_MS, () => {
      n2 = "round", i2 = null, l2 = M, s2 = t2.now, t2.ev({ kind: "start", holderId: l2 }), m2("Name a building material", "start");
    }), y2(4e3, "banana"), g2(5e3, "banana", "miss"), y2(6e3, "Myc"), y2(6400, "Mycelium"), f2(7e3, "Mycelium", "krillion"), y2(8e3, "Cob"), f2(9e3, "Cob", "deepcut"), y2(1e4, "Timber"), f2(11e3, "Timber", "plankton"), y2(12e3, "Brick"), f2(13e3, "Brick", "plankton"), y2(14e3, "Mycelium"), g2(15e3, "Mycelium", "repeat"), y2(16e3, "Ferrock"), f2(17e3, "Ferrock", "krillion", "Name a way to prepare eggs", 13), y2(2e4, "Scrambled eggs"), f2(21e3, "Scrambled eggs", "plankton"), y2(22500, "Poached eggs"), f2(23500, "Poached eggs", "plankton"), y2(25e3, "Omelette"), f2(26e3, "Omelette", "plankton"), y2(27e3, "Son-in-law eggs"), f2(28e3, "Son-in-law eggs", "krillion"), [["Fried eggs", "plankton"], ["Deviled eggs", "plankton"], ["Eggs Benedict", "plankton"], ["Shirred eggs", "krillion"], ["Frittata", "schooler"], ["Hard boiled eggs", "schooler"], ["Soft boiled eggs", "schooler"], ["Coddled eggs", "krillion"]].forEach(([e3, t3], a3) => {
      y2(29e3 + 2e3 * a3, e3), f2(3e4 + 2e3 * a3, e3, t3);
    }), y2(5e4, "Shakshu"), v2(54e3, "Name a part of a computer"), y2(57500, "Keyboard"), f2(58500, "Keyboard", "plankton"), y2(6e4, "Mouse"), f2(61e3, "Mouse", "plankton"), y2(62e3, "Northbridge"), f2(63e3, "Northbridge", "deepcut"), y2(69500, "motherb"), v2(73e3), y2(80500, "umm"), v2(84500, "Name a celebrity chef"), y2(92e3, "gordon..."), v2(96e3, "Name a kind of cheese", 17), y2(98e3, "Roquefort"), f2(99e3, "Roquefort", "rare"), [["Cheddar", "plankton"], ["Mozzarella", "plankton"], ["Casu marzu", "deepcut"], ["Brie", "schooler"], ["Gouda", "schooler"], ["Milbenk\xE4se", "deepcut"], ["Parmesan", "plankton"], ["Feta", "schooler"], ["Pule", "deepcut"], ["Stilton", "schooler"], ["Manchego", "rare"], ["Mimolette", "deepcut"], ["Halloumi", "schooler"], ["Ricotta", "schooler"], ["Vieux Boulogne", "deepcut"]].forEach(([e3, t3], a3) => {
      y2(1e5 + 2e3 * a3, e3), f2(101e3 + 2e3 * a3, e3, t3);
    }), y2(135e3, "camem..."), v2(139e3, "Name a building material"), y2(146500, "concr"), v2(150500);
    let b2 = { gameNumber: 1, startedAt: null, endedAt: null, categories: [], passes: [], pops: 0, outOnPop: {} }, x2 = 0;
    for (let e3 of [p2, ...u2.map((e4) => e4.room)]) !(function(e4, t3, a3) {
      let n3 = () => e4.categories[e4.categories.length - 1] ?? null;
      for (let l4 of t3) switch (l4.kind) {
        case "start":
          e4.startedAt = l4.at;
          break;
        case "category":
          if ("cleared" === l4.why) {
            let e5 = n3();
            e5 && !e5.end && (e5.end = { kind: "cleared" });
          }
          e4.categories.some((e5) => e5.index === l4.index) || e4.categories.push({ index: l4.index, text: a3.category?.index === l4.index ? a3.category.text : "", end: null });
          break;
        case "pass":
          e4.passes.push({ playerId: l4.from, answer: l4.answer, tier: l4.tier, index: n3()?.index ?? a3.category?.index ?? 0 });
          break;
        case "pop": {
          e4.pops++;
          let t4 = n3();
          t4 && !t4.end && (t4.end = { kind: "pop", playerId: l4.playerId });
          break;
        }
        case "out":
          e4.outOnPop[l4.playerId] = e4.pops;
          break;
        case "win":
          e4.endedAt = l4.at;
      }
      let l3 = a3.category;
      if (l3) {
        let t4 = e4.categories.find((e5) => e5.index === l3.index);
        t4 ? t4.text || (t4.text = l3.text) : ("round" === a3.phase || "over" === a3.phase) && e4.categories.push({ index: l3.index, text: l3.text, end: null });
      }
    })(b2, e3.events.filter((e4) => e4.seq > x2), e3), x2 = e3.events.at(-1)?.seq ?? x2;
    return { meId: M, base: p2, steps: u2, history: b2 };
  }, "isPreviewState", 0, function(e2) {
    return !!e2 && C.includes(e2);
  }, "previewParticipation", 0, function(e2, t2, a2) {
    if ("again" !== a2.type && "auto-join" !== a2.type) return null;
    let n2 = structuredClone(e2), l2 = n2.players.find((e3) => e3.id === t2);
    if (!l2) return null;
    if (n2.version++, "auto-join" === a2.type ? (l2.autoJoin = a2.enabled, ("lobby" === n2.phase || "over" === n2.phase) && (l2.ready = a2.enabled)) : (l2.ready = true, "over" === n2.phase && (n2.phase = "lobby", n2.gameNumber++, n2.winnerId = null, n2.category = null, n2.holderId = null, n2.holderSince = null, n2.events.push({ seq: (n2.events.at(-1)?.seq ?? 0) + 1, at: n2.now, kind: "lobby" }))), "lobby" === n2.phase) {
      for (let e3 of n2.players) e3.alive = !!e3.ready, e3.lives = e3.ready ? n2.settings.lives : 0, e3.place = null, e3.meter = e3.answers = e3.pops = 0, e3.best = e3.typing = e3.lastAnswer = null;
      n2.players.find((e3) => e3.id === n2.hostId)?.ready || (n2.hostId = n2.players.find((e3) => e3.ready)?.id ?? n2.hostId);
    }
    return n2;
  }, "previewVisibility", 0, function(e2, t2, a2) {
    return e2.hostId !== t2 ? null : { ...e2, version: e2.version + 1, settings: { ...e2.settings, isPrivate: a2 } };
  }], 4598);
}]);
