(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 939, (e) => {
  "use strict";
  var t = e.i(43476), i = e.i(22016);
  e.s(["default", 0, function({ prompt: e2 = "found a bug? lost an unlock?" }) {
    return (0, t.jsxs)("p", { className: "font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60", children: [e2, " ", (0, t.jsx)("a", { href: "mailto:support@krillion.io", className: "underline text-drift hover:text-lumen-cyan", children: "contact us" }), " \xB7 ", (0, t.jsx)("a", { href: "mailto:business@krillion.io", className: "underline hover:text-lumen-cyan", children: "business inquiries" }), " \xB7 ", (0, t.jsx)("a", { href: "https://www.instagram.com/youareoneinakrillion/", target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-lumen-cyan", children: "instagram" }), " \xB7 ", (0, t.jsx)(i.default, { href: "/privacy", prefetch: false, className: "underline hover:text-lumen-cyan", children: "privacy" })] });
  }]);
}, 5886, (e) => {
  "use strict";
  var t = e.i(43476), i = e.i(71645), n = e.i(18566), a = e.i(37812), l = e.i(939), s = e.i(55067), o = e.i(33385), c = e.i(33827), r = e.i(39233), u = e.i(70246), d = e.i(45743);
  function h() {
    let h2 = (0, n.useRouter)(), m = (0, n.useSearchParams)().get("pack"), k = m ? s.CLIENT_PACKS.find((e2) => e2.id === m) ?? null : null, [p, f] = (0, i.useState)(null), [x, y] = (0, i.useState)(null), [g, w] = (0, i.useState)(""), b = async (e2) => {
      if (!e2.ok) return void y(404 === e2.status ? "No purchase found on that Google account or its email. If you checked out with a different email, paste your unlock link below." : 429 === e2.status ? "This purchase hit its daily device limit. Try again tomorrow." : "Something went sideways. Try again in a minute.");
      let t2 = await e2.json(), i2 = t2.packs ?? {};
      if (!t2.token && 0 === Object.keys(i2).length) return void y("Something went sideways. Try again in a minute.");
      for (let [e3, n3] of (t2.token && (0, a.saveUnlockToken)(t2.token), Object.entries(i2))) (0, a.savePackUnlockToken)(e3, n3);
      if ((0, a.saveGoogleLinked)(), k) return ("classic" === k.id ? !t2.token : !i2[k.id]) ? void y(t2.limitedPacks?.includes(k.id) ? "This purchase hit its daily device limit. Try again tomorrow." : `No ${k.name} purchase found on that Google account or its email. If you checked out with a different email, paste your unlock link below.`) : ((0, r.track)("unlock_restored", { pack: k.id }), void h2.replace(k.href));
      (0, r.track)("unlock_restored", {});
      let n2 = Object.keys(i2);
      h2.replace(t2.token ? "/unlimited/classic" : 1 === n2.length ? (0, s.clientPack)(n2[0]).href : "/packs");
    }, j = async () => {
      if (!p) {
        f("google"), y(null);
        try {
          let t2 = await (0, d.firebaseAuth)(), { GoogleAuthProvider: i2, signInWithPopup: n2 } = await e.A(3975), a2 = await (0, d.withTimeout)(n2(t2, new i2())), l2 = await a2.user.getIdToken();
          await (0, o.bindLocalPurchases)(l2), (0, c.progressOwner)() && await (0, o.bindLocalPurchases)(l2, null), await b(await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: l2 }) }));
        } catch {
          y("Google sign-in didn't complete. Try again, or paste your unlock link below.");
        } finally {
          f(null);
        }
      }
    }, v = async (e2) => {
      if (e2.preventDefault(), p) return;
      let t2 = g.trim().match(/cs_[a-zA-Z0-9_]+/);
      if (!t2) return void y("That doesn\u2019t look like an unlock link (it contains a code starting with cs_).");
      let i2 = g.match(/[?&]pack=([a-z0-9-]+)/), n2 = i2 ? s.CLIENT_PACKS.find((e3) => e3.id === i2[1]) ?? null : null, l2 = ["classic", ...s.CLIENT_PACKS.filter((e3) => "classic" !== e3.id).map((e3) => e3.id)], o2 = n2 ? [n2.id] : k ? [k.id, ...l2.filter((e3) => e3 !== k.id)] : l2;
      f("link"), y(null);
      try {
        let e3 = false;
        for (let i3 of o2) {
          let n3 = "classic" === i3 ? "/api/unlock" : `/api/packs/${i3}/unlock`, l3 = await fetch(`${n3}?session_id=${encodeURIComponent(t2[0])}`);
          if (429 === l3.status && (e3 = true), !l3.ok) continue;
          let o3 = await l3.json();
          if (o3.token) {
            "classic" === i3 ? (0, a.saveUnlockToken)(o3.token) : (0, a.savePackUnlockToken)(i3, o3.token), (0, r.track)("unlock_restored", { pack: i3 }), h2.replace("classic" === i3 ? "/unlimited/classic" : (0, s.clientPack)(i3).href);
            return;
          }
        }
        y(e3 ? "This purchase hit its daily device limit. Devices already unlocked keep working \u2014 try again tomorrow." : "Couldn't redeem that link. Check it's the full unlock URL (it contains a code starting with cs_).");
      } catch {
        y("Something went sideways. Try again in a minute.");
      } finally {
        f(null);
      }
    };
    return (0, t.jsxs)("main", { className: "min-h-screen flex flex-col items-center justify-center gap-6 px-6", children: [(0, t.jsx)("p", { className: "font-display text-lumen-pink text-2xl tracking-[0.08em]", children: "KRILLION" }), k && (0, t.jsxs)("p", { className: "font-mono-ui text-[13px] tracking-[0.16em] uppercase text-lumen-cyan", children: ["restore ", k.name] }), (0, t.jsxs)("p", { className: "text-drift max-w-[38ch] text-center", children: ["Unlocked", k ? ` ${k.name}` : "", " on another device? Sign in with the Google account you linked at purchase."] }), (0, t.jsx)("button", { onClick: j, disabled: null !== p, className: "btn-descend w-full max-w-[320px]", children: "google" === p ? "sounding\u2026" : "Sign in with Google" }), (0, t.jsx)("p", { className: "font-mono-ui text-[11px] tracking-[0.2em] uppercase text-drift/50 mt-2", children: "or use your unlock link" }), (0, t.jsxs)("form", { onSubmit: v, className: "flex flex-col gap-3 w-full max-w-[320px]", children: [(0, t.jsx)("input", { type: "text", value: g, onChange: (e2) => w(e2.target.value), placeholder: k && "classic" !== k.id ? `https://krillion.io/unlock?pack=${k.id}&session_id=cs_...` : "https://krillion.io/unlock?session_id=cs_...", className: "bg-transparent border border-[var(--hairline)] px-4 py-3 text-foam font-mono-ui text-[13px] outline-none focus:border-lumen-cyan" }), (0, t.jsx)("button", { type: "submit", disabled: !g.trim() || null !== p, className: "btn-quiet", children: "link" === p ? "sounding\u2026" : "Re-arm with link" })] }), x && (0, t.jsx)("p", { className: "text-drift text-[14px] max-w-[36ch] text-center", children: x }), k && !k.payUrl ? (0, t.jsxs)("a", { href: k.href, className: "font-mono-ui text-[12px] text-drift/60 underline", children: ["back to ", k.name.toLowerCase()] }) : (0, t.jsxs)("a", { href: k?.payUrl ?? u.UNLOCK_URL, className: "font-mono-ui text-[12px] text-drift/60 underline", children: ["or buy ", k ? k.name.toLowerCase() : "the unlock", " \xB7", " ", k?.priceLabel ?? "$5"] }), (0, t.jsx)(l.default, { prompt: "still stuck?" })] });
  }
  e.s(["default", 0, function() {
    return (0, t.jsx)(i.Suspense, { fallback: null, children: (0, t.jsx)(h, {}) });
  }]);
}]);
