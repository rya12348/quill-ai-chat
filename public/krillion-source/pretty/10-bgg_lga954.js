(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 92347, (e) => {
  "use strict";
  var a = e.i(43476), s = e.i(36484);
  let n = { plankton: "var(--tier-plankton)", tooclever: "var(--tier-tooclever)", schooler: "var(--tier-schooler)", rare: "var(--tier-rare)", deepcut: "var(--tier-deepcut)", krillion: "var(--tier-krillion)", miss: "var(--tier-miss)" };
  e.s(["default", 0, function({ tier: e2, size: i = 24, glow: r = false, className: t }) {
    let l = n[e2], o = { imageRendering: "pixelated", filter: r ? `drop-shadow(0 0 ${Math.max(4, i / 4)}px ${l})` : void 0 };
    return "miss" === e2 ? (0, a.jsx)("svg", { width: i, height: i, viewBox: "0 0 24 24", fill: "none", stroke: l, strokeWidth: 1.8, strokeLinecap: "round", className: t, style: r ? { filter: o.filter } : void 0, "aria-hidden": true, children: (0, a.jsx)("circle", { cx: "12", cy: "12", r: "7.5", strokeDasharray: "2.8 4" }) }) : (0, a.jsx)(s.default, { src: `/tiers/${e2}.png`, alt: "", width: i, height: i, className: t, style: o, "aria-hidden": true, draggable: false });
  }]);
}, 55877, (e) => {
  e.v({ actions: "AccountPage-module__SGy9WG__actions", brand: "AccountPage-module__SGy9WG__brand", buddies: "AccountPage-module__SGy9WG__buddies", email: "AccountPage-module__SGy9WG__email", error: "AccountPage-module__SGy9WG__error", eyebrow: "AccountPage-module__SGy9WG__eyebrow", footer: "AccountPage-module__SGy9WG__footer", friendsLink: "AccountPage-module__SGy9WG__friendsLink", header: "AccountPage-module__SGy9WG__header", historyRow: "AccountPage-module__SGy9WG__historyRow", identity: "AccountPage-module__SGy9WG__identity", identityTop: "AccountPage-module__SGy9WG__identityTop", importBox: "AccountPage-module__SGy9WG__importBox", note: "AccountPage-module__SGy9WG__note", page: "AccountPage-module__SGy9WG__page", stats: "AccountPage-module__SGy9WG__stats", sync: "AccountPage-module__SGy9WG__sync" });
}, 78953, (e) => {
  "use strict";
  var a = e.i(43476), s = e.i(71645), n = e.i(67334), i = e.i(55877);
  e.s(["default", 0, function({ busy: e2, act: r, force: t = false, onDone: l }) {
    let o = (0, n.useAccount)();
    return ((0, s.useEffect)(() => {
      (0, n.refreshImportCount)();
    }, []), o.user && 0 !== o.importCount && (!o.importDismissed || t)) ? (0, a.jsxs)("section", { className: i.default.importBox, "aria-labelledby": "import-title", children: [(0, a.jsx)("p", { className: i.default.eyebrow, children: "HISTORY FOUND ON THIS DEVICE" }), (0, a.jsx)("h2", { id: "import-title", children: "Bring your earlier dives along?" }), (0, a.jsxs)("p", { children: ["Add ", o.importCount, " completed ", 1 === o.importCount ? "game" : "games", " to ", o.user.email || "your account", ". Overlapping games count once, keeping the highest score."] }), (0, a.jsx)("p", { children: "If you keep them separate, this device shows only what\u2019s saved on your account. On a new account that means starting from zero: streaks, scores, and completed games." }), (0, a.jsx)("p", { className: i.default.note, children: "Only add this history if it\u2019s yours. Your guest copy stays on this device, and you can add it later from My Krillion." }), (0, a.jsxs)("div", { className: i.default.actions, children: [(0, a.jsx)("button", { className: "btn-descend", disabled: e2, onClick: () => void r(async () => {
      await (0, n.importGuestHistory)(), l?.();
    }), children: "Add my history" }), (0, a.jsx)("button", { className: "btn-quiet", disabled: e2, onClick: () => void r(async () => {
      (0, n.skipGuestImport)(), l?.();
    }), children: "Keep separate" })] })] }) : null;
  }]);
}, 31074, (e) => {
  e.v({ answerToggle: "FriendsPage-module___GO5Ea__answerToggle", answers: "FriendsPage-module___GO5Ea__answers", board: "FriendsPage-module___GO5Ea__board", catchHeading: "FriendsPage-module___GO5Ea__catchHeading", locked: "FriendsPage-module___GO5Ea__locked", manage: "FriendsPage-module___GO5Ea__manage", name: "FriendsPage-module___GO5Ea__name", page: "FriendsPage-module___GO5Ea__page", people: "FriendsPage-module___GO5Ea__people", rank: "FriendsPage-module___GO5Ea__rank", roundAnswer: "FriendsPage-module___GO5Ea__roundAnswer", roundCopy: "FriendsPage-module___GO5Ea__roundCopy", roundNumber: "FriendsPage-module___GO5Ea__roundNumber", roundPrompt: "FriendsPage-module___GO5Ea__roundPrompt", roundScore: "FriendsPage-module___GO5Ea__roundScore", score: "FriendsPage-module___GO5Ea__score", sectionTop: "FriendsPage-module___GO5Ea__sectionTop", srOnly: "FriendsPage-module___GO5Ea__srOnly", success: "FriendsPage-module___GO5Ea__success", toggleCopy: "FriendsPage-module___GO5Ea__toggleCopy", toggleDescription: "FriendsPage-module___GO5Ea__toggleDescription", toggleLabel: "FriendsPage-module___GO5Ea__toggleLabel" });
}, 97591, (e) => {
  "use strict";
  var a = e.i(43476), s = e.i(22016), n = e.i(71645), i = e.i(67334), r = e.i(45743), t = e.i(33827);
  async function l(e2, a2) {
    let s2 = await (0, r.firebaseAuth)(), n2 = s2.currentUser, i2 = () => n2?.uid === e2 && s2.currentUser?.uid === e2 && (0, t.progressOwner)() === e2;
    if (!n2 || !i2()) throw Error("Sign in again to use Friends.");
    let l2 = await n2.getIdToken();
    if (!i2()) throw Error("Account changed.");
    let o2 = await fetch("/api/friends", { method: a2 ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${l2}`, ...a2 ? { "Content-Type": "application/json" } : {} }, ...a2 ? { body: JSON.stringify(a2) } : {}, signal: AbortSignal.timeout(2e4) }), d2 = await o2.json();
    if (!i2()) throw Error("Account changed.");
    if (!o2.ok) throw Error(d2.error || "Friends is unavailable. Please retry.");
    return d2;
  }
  let o = "krillion:pending-friend-invite";
  var d = e.i(98284);
  let c = (e2) => "string" == typeof e2 && /^[a-f0-9]{64}$/.test(e2), u = (e2, a2) => `Add me (@${e2}) as a friend on Krillion: ${a2}`;
  var h = e.i(86062), m = e.i(78953), p = e.i(92347), f = e.i(21166), g = e.i(55877), y = e.i(31074);
  e.s(["default", 0, function() {
    let e2 = (0, i.useAccount)(), r2 = e2.user?.uid, [t2, _] = (0, n.useState)(null), [x, b] = (0, n.useState)(null), [j, v] = (0, n.useState)(null), [w, N] = (0, n.useState)(null), [k, S] = (0, n.useState)(""), [G, A] = (0, n.useState)(null), [P, E] = (0, n.useState)(""), [O, F] = (0, n.useState)(false), [C, T] = (0, n.useState)(""), [Y, I] = (0, n.useState)(""), [L, R] = (0, n.useState)(false), W = (0, n.useRef)(0);
    (0, n.useEffect)(() => {
      (0, i.initializeAccount)();
      let e3 = () => {
        let e4 = new URLSearchParams(window.location.hash.slice(1)).get("invite");
        try {
          null !== e4 ? (sessionStorage.setItem(o, c(e4) ? e4 : "invalid"), window.history.replaceState(null, "", window.location.pathname + window.location.search)) : e4 = sessionStorage.getItem(o);
        } catch {
        }
        b(c(e4) ? e4 : null), v(null), N(e4 && !c(e4) ? "This invite link is invalid. Ask your friend for a new one." : null);
      }, a2 = requestAnimationFrame(() => {
        e3(), T(window.location.origin), I((0, d.etDateString)()), R(!!navigator.share);
      });
      return window.addEventListener("hashchange", e3), () => {
        cancelAnimationFrame(a2), window.removeEventListener("hashchange", e3);
      };
    }, []);
    let $ = (0, n.useCallback)(async () => {
      if (!r2) return;
      let e3 = ++W.current, a2 = await l(r2);
      e3 === W.current && (_(a2), I((0, d.etDateString)()), A(null));
    }, [r2]);
    async function D(e3) {
      F(true), A(null), E("");
      try {
        await e3();
      } catch (e4) {
        A(e4 instanceof Error ? e4.message : "Please try again.");
      } finally {
        F(false);
      }
    }
    async function q(e3) {
      r2 && (W.current++, await l(r2, e3), await $());
    }
    async function B(e3) {
      if (!r2) return;
      let a2 = await l(r2, { action: "share-answers", enabled: e3 });
      W.current++, _((e4) => e4?.profile ? { ...e4, profile: { ...e4.profile, shareAnswers: a2.shareAnswers } } : e4), E(a2.shareAnswers ? "Your answers are now shared with friends." : "Your answers are now private. Friends can still see your score.");
    }
    function z() {
      try {
        sessionStorage.removeItem(o);
      } catch {
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search), b(null), v(null), N(null);
    }
    (0, n.useEffect)(() => {
      if (!r2) return;
      let e3 = true, a2 = async () => {
        let a3 = ++W.current;
        I((0, d.etDateString)());
        try {
          let s3 = await l(r2);
          e3 && a3 === W.current && (_(s3), A(null));
        } catch (s3) {
          e3 && a3 === W.current && A(s3 instanceof Error ? s3.message : "Couldn\u2019t load Friends.");
        }
      };
      a2();
      let s2 = () => {
        "visible" === document.visibilityState && a2();
      }, n2 = setInterval(s2, 3e4);
      return window.addEventListener("online", s2), document.addEventListener("visibilitychange", s2), () => {
        e3 = false, clearInterval(n2), window.removeEventListener("online", s2), document.removeEventListener("visibilitychange", s2);
      };
    }, [r2, e2.lastSync]), (0, n.useEffect)(() => {
      if (!r2 || !x) return;
      let e3 = true;
      return l(r2, { action: "inspect", invite: x }).then((a2) => {
        e3 && (v(a2.username), N(null));
      }).catch((a2) => {
        e3 && (v(null), N(a2.message));
      }), () => {
        e3 = false;
      };
    }, [r2, x]);
    let U = C && t2?.profile ? `${C}/friends#invite=${t2.profile.invite}` : "", H = t2?.unlocked && t2.date === Y, K = t2?.leaderboard.filter((e3) => !e3.self) ?? [];
    return (0, a.jsxs)("main", { className: `${g.default.page} ${y.default.page}`, children: [(0, a.jsx)(s.default, { className: g.default.brand, href: "/", children: "KRILLION" }), (0, a.jsxs)("header", { className: g.default.header, children: [(0, a.jsx)("p", { className: g.default.eyebrow, children: "BETTER WITH COMPANY" }), (0, a.jsx)("h1", { children: "Friends" })] }), (G || P) && (0, a.jsx)("p", { className: G ? g.default.error : y.default.success, role: G ? "alert" : "status", children: G || P }), e2.ready ? r2 ? (0, a.jsxs)(a.Fragment, { children: [(0, a.jsx)(m.default, { busy: O, act: D }), ("syncing" === e2.status || "error" === e2.status) && (0, a.jsx)("section", { "aria-label": "History sync", children: "syncing" === e2.status ? (0, a.jsx)("p", { role: "status", children: "Syncing your completed dives\u2026" }) : (0, a.jsxs)(a.Fragment, { children: [(0, a.jsx)("p", { className: g.default.error, role: "alert", children: e2.error || "Your completed dives are waiting to sync. Your progress is kept on this device." }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D(async () => {
      await (0, i.syncAccount)(), await $();
    }), children: "Retry sync" })] }) }), (x || w) && (0, a.jsxs)("section", { className: g.default.importBox, "aria-label": "Friend invite", children: [(0, a.jsx)("h2", { children: j ? `Join @${j}` : "Friend invite" }), (0, a.jsx)("p", { children: w || (j ? "Add each other to your friends leaderboards. You\u2019ll both see daily scores after finishing that day\u2019s dive. Answers are visible when the player\u2019s sharing setting is on." : "Checking your invitation\u2026") }), (0, a.jsxs)("div", { className: g.default.actions, children: [j && !w && t2?.profile && (0, a.jsx)("button", { className: "btn-descend", disabled: O, onClick: () => void D(async () => {
      await q({ action: "accept", invite: x }), z(), E(`You and @${j} are now friends.`);
    }), children: "Add friend" }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: z, children: "Dismiss" })] })] }), t2 ? t2.profile ? (0, a.jsxs)(a.Fragment, { children: [(0, a.jsxs)("section", { className: g.default.identity, "aria-label": "Invite friends", children: [(0, a.jsxs)("h2", { children: ["@", t2.profile.username] }), (0, a.jsx)("p", { children: "Send your link to someone you want on your leaderboard. Anyone with it can add you as a friend." }), (0, a.jsx)("label", { htmlFor: "invite-link", children: "Your invite link" }), (0, a.jsx)("input", { id: "invite-link", value: U, readOnly: true, onFocus: (e3) => e3.target.select() }), (0, a.jsxs)("div", { className: g.default.actions, children: [(0, a.jsx)("button", { className: "btn-descend", disabled: !U || O, onClick: () => void D(async () => {
      try {
        await navigator.clipboard.writeText(u(t2.profile.username, U)), E("Invite message copied. Paste it to a friend.");
      } catch {
        throw Error("Select and copy the invite link above.");
      }
    }), children: "Copy invite link" }), L && (0, a.jsx)("button", { className: "btn-quiet", disabled: !U || O, "aria-label": "Share invite via apps", onClick: () => void D(async () => {
      try {
        await navigator.share({ text: u(t2.profile.username, U) });
      } catch (e3) {
        if (!(e3 instanceof DOMException && "AbortError" === e3.name)) throw Error("Sharing isn\u2019t available here. Copy the link instead.");
      }
    }), children: "Share\u2026" })] })] }), (0, a.jsxs)("section", { "aria-labelledby": "leaderboard-title", children: [(0, a.jsxs)("div", { className: y.default.sectionTop, children: [(0, a.jsx)("h2", { className: "fathom", id: "leaderboard-title", children: (0, a.jsx)("span", { children: "Today\u2019s friends leaderboard" }) }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D(async () => {
      await (0, i.syncAccount)(), await $();
    }), children: "Refresh" })] }), (0, a.jsxs)("p", { className: g.default.note, children: [t2.date, " \xB7 Resets at midnight ET \xB7 Ties share a place"] }), (0, a.jsxs)("label", { className: y.default.answerToggle, children: [(0, a.jsxs)("span", { className: y.default.toggleCopy, children: [(0, a.jsx)("span", { className: y.default.toggleLabel, children: "Share my answers with friends" }), (0, a.jsx)("span", { className: y.default.toggleDescription, id: "answer-sharing-help", children: O ? "Please wait\u2026" : "Off keeps your answers private. Your score stays visible. Saved to your account for daily games." })] }), (0, a.jsxs)("span", { className: f.default.toggle, children: [(0, a.jsx)("input", { type: "checkbox", role: "switch", "aria-label": "Share my answers with friends", "aria-describedby": "answer-sharing-help", disabled: O, checked: t2.profile.shareAnswers, onChange: (e3) => void D(() => B(e3.target.checked)) }), (0, a.jsx)("span", { className: f.default.track, "aria-hidden": "true", children: (0, a.jsx)("span", { className: f.default.thumb, children: t2.profile.shareAnswers ? "ON" : "OFF" }) })] })] }), !H && (0, a.jsxs)("div", { className: y.default.locked, children: [(0, a.jsx)("h3", { children: "Finish your daily to see scores and shared answers." }), (0, a.jsx)("p", { children: "Your friends\u2019 scores and any answers they choose to share unlock once today\u2019s result has synced." }), (0, a.jsx)(s.default, { className: "btn-descend", href: "/", children: "Play today\u2019s daily" })] }), H && (0, a.jsx)("ol", { className: y.default.board, "aria-label": "Daily rankings", children: t2.leaderboard.map((e3) => (0, a.jsxs)("li", { "data-self": e3.self, children: [(0, a.jsx)("span", { className: y.default.rank, children: null === e3.rank ? "\u2014" : `#${e3.rank}` }), (0, a.jsxs)("span", { className: y.default.name, children: ["@", e3.username, e3.self && (0, a.jsx)("small", { children: "you" })] }), (0, a.jsx)("span", { className: y.default.score, children: null === e3.score ? (0, a.jsx)("small", { children: "Yet to dive" }) : e3.score }), null !== e3.score && (0, a.jsxs)("div", { className: y.default.answers, children: [(0, a.jsx)("p", { className: `fathom ${y.default.catchHeading}`, children: (0, a.jsx)("span", { children: "the catch" }) }), e3.answers?.length ? (0, a.jsx)("ol", { "aria-label": `Answers from @${e3.username}`, children: e3.answers.map((e4, s2) => (0, a.jsxs)("li", { children: [(0, a.jsxs)("span", { className: y.default.roundNumber, children: [(0, a.jsx)("span", { className: y.default.srOnly, children: "Round " }), s2 + 1] }), (0, a.jsx)(p.default, { tier: e4.tier ?? "miss", size: 19 }), (0, a.jsxs)("div", { className: y.default.roundCopy, children: [(0, a.jsx)("p", { className: y.default.roundPrompt, children: e4.prompt }), (0, a.jsx)("p", { className: y.default.roundAnswer, children: e4.answer ?? "No answer" })] }), (0, a.jsxs)("span", { className: y.default.roundScore, style: { color: e4.tier ? h.TIERS[e4.tier].color : "var(--tier-miss-lit)" }, children: [e4.score, (0, a.jsx)("span", { className: y.default.srOnly, children: " points" })] })] }, s2)) }) : (0, a.jsx)("p", { className: g.default.note, children: e3.self ? "Answers aren\u2019t available for this result." : "Answers are private or unavailable." })] })] }, e3.username)) }), 0 === K.length && (0, a.jsx)("p", { className: g.default.note, children: "Your crew starts with one friend. Send your invite link to get together here." })] }), (0, a.jsxs)("section", { "aria-labelledby": "friends-title", children: [(0, a.jsx)("h2", { className: "fathom", id: "friends-title", children: (0, a.jsxs)("span", { children: ["Your friends \xB7 ", K.length] }) }), (0, a.jsx)("ul", { className: y.default.people, children: K.map((e3) => (0, a.jsxs)("li", { children: [(0, a.jsxs)("span", { children: ["@", e3.username] }), (0, a.jsxs)("details", { children: [(0, a.jsxs)("summary", { children: ["Manage", (0, a.jsxs)("span", { className: y.default.srOnly, children: [" @", e3.username] })] }), (0, a.jsx)("p", { children: "Removing ends the friendship. Blocking also prevents new invites between you." }), (0, a.jsxs)("div", { className: g.default.actions, children: [(0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D(() => q({ action: "remove", username: e3.username })), children: "Remove" }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D(() => q({ action: "block", username: e3.username })), children: "Block" })] })] })] }, e3.username)) })] }), (0, a.jsx)("section", { children: (0, a.jsxs)("details", { className: y.default.manage, children: [(0, a.jsx)("summary", { children: "Manage your profile & invites" }), (0, a.jsxs)("form", { onSubmit: (e3) => {
      e3.preventDefault(), D(async () => {
        await q({ action: "profile", username: k }), S(""), E("Username saved.");
      });
    }, children: [(0, a.jsx)("label", { htmlFor: "change-username", children: "New username" }), (0, a.jsx)("input", { id: "change-username", value: k, onChange: (e3) => S(e3.target.value), minLength: 3, maxLength: 20, pattern: "[A-Za-z][A-Za-z0-9_]{2,19}", required: true, autoCapitalize: "none", spellCheck: false }), (0, a.jsx)("p", { className: g.default.note, children: "Once every 30 days. Your friendships and invite link stay with you." }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, children: "Save username" })] }), (0, a.jsx)("p", { children: "Replace your invite link to stop people using the old one. Existing friends stay connected." }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D(async () => {
      await q({ action: "rotate" }), E("Invite link replaced. Your old link no longer works.");
    }), children: "Replace invite link" }), t2.blocked.length > 0 && (0, a.jsxs)(a.Fragment, { children: [(0, a.jsx)("h3", { children: "Blocked players" }), (0, a.jsx)("ul", { className: y.default.people, children: t2.blocked.map((e3) => (0, a.jsxs)("li", { children: [(0, a.jsxs)("span", { children: ["@", e3] }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D(() => q({ action: "unblock", username: e3 })), children: "Unblock" })] }, e3)) }), (0, a.jsx)("p", { children: "Unblocking doesn\u2019t restore a friendship. Use an invite to connect again." })] })] }) })] }) : (0, a.jsxs)("section", { className: g.default.identity, children: [(0, a.jsx)("h2", { children: "Choose your username." }), (0, a.jsx)("p", { children: "This is how friends will know you. Your Google name and email stay private." }), (0, a.jsx)("p", { children: "Answer sharing starts on. Friends can see your daily answers after finishing their own game. You can turn sharing off at any time." }), (0, a.jsxs)("form", { onSubmit: (e3) => {
      e3.preventDefault(), D(async () => {
        await q({ action: "profile", username: k }), S("");
      });
    }, children: [(0, a.jsx)("label", { htmlFor: "friend-username", children: "Username" }), (0, a.jsx)("input", { id: "friend-username", value: k, onChange: (e3) => S(e3.target.value), maxLength: 20, minLength: 3, pattern: "[A-Za-z][A-Za-z0-9_]{2,19}", required: true, autoCapitalize: "none", autoCorrect: "off", spellCheck: false, "aria-describedby": "username-help" }), (0, a.jsx)("p", { id: "username-help", className: g.default.note, children: "3\u201320 letters, numbers, or underscores. Start with a letter. You can change it every 30 days." }), (0, a.jsx)("button", { className: "btn-descend", disabled: O, children: "Join Friends" })] })] }) : (0, a.jsxs)("section", { children: [(0, a.jsx)("p", { role: "status", children: G ? "Your friends list couldn\u2019t be loaded." : "Loading your friends\u2026" }), (0, a.jsx)("button", { className: "btn-quiet", disabled: O, onClick: () => void D($), children: "Retry" })] })] }) : (0, a.jsxs)("section", { className: g.default.identity, children: [(0, a.jsx)("h2", { children: x ? "You\u2019ve been invited." : "Bring your friends along." }), (0, a.jsx)("p", { children: "Sign in with Google to add friends and compare daily scores and answers. Your leaderboard is just you and your friends." }), (0, a.jsx)("button", { className: "btn-descend", disabled: O, onClick: () => void D(i.signInAccount), children: O ? "Connecting\u2026" : "Continue with Google" }), (0, a.jsx)("p", { className: g.default.note, children: "We\u2019ll ask before adding this device\u2019s earlier history. If you skip that step, you\u2019ll see only what\u2019s saved on your account, and a new account starts from zero." })] }) : (0, a.jsx)("p", { role: "status", children: "Opening Friends\u2026" }), (0, a.jsxs)("footer", { className: g.default.footer, children: [(0, a.jsx)(s.default, { href: "/account", children: "My Krillion" }), (0, a.jsx)(s.default, { href: "/privacy", children: "Privacy" })] })] });
  }], 97591);
}]);
