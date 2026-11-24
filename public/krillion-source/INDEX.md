# Krillion client build — mirror

Fetched from `https://krillion.io/` (plus `/party`, `/archive`, `/packs`,
`/unlimited/classic`) on demand and kept only under `tmp/`, which git ignores.
This is the **client** build: Next.js/Turbopack output, minified, no source maps.
The server code, API handlers, card bank and scoring tables are not in it — those
arrive over the network at runtime or are server-only.

- `index.html`, `_party.html`, `_archive.html`, `_packs.html`,
  `_unlimited_classic.html`: the server-rendered pages, including the RSC flight
  payload with the game's props.
- `_next/static/chunks/*.js`: every chunk reachable from those pages.
- `_next/static/chunks/*.css`: the shipped stylesheets (the source of the
  `.ds-*` rules copied into `src/dive.css` and `src/butter-party.css`).
- `pretty/*.js`: the same chunks re-printed indented by esbuild for reading.
  Identifiers are still mangled; component boundaries are marked by the CSS
  module maps at the top of each chunk (`DailyIntro-module__…` and friends).

## Which chunk holds what

| chunk | raw KiB | pretty KiB | modules | component names |
|---|---|---|---|---|

| `0-9z1pcs0sh9-.js` | 32 KiB | 40 | 14 | CharacterControl, InstagramPromo, PlushiePromo |
| `047e_xhm_y1m6.js` | 13 KiB | 17 | 1 |  |
| `05rzx4yxjp9lo.css` | 22 KiB |  | 0 | GameDiscovery, InstagramPromo, OriginleInvite, PlushiePromo, SiteMenu |
| `06a7ypg-bn1u8.js` | 4 KiB | 5 | 1 |  |
| `06ei2ouz7padc.js` | 221 KiB | 359 | 0 |  |
| `0a27hasimsri3.css` | 41 KiB |  | 0 | AccountPage, AnnouncementGate, ArchiveCalendarModal, ChainleLink, CharacterControl, DailyIntro, Day100Thanks, DoneView, +5 |
| `0cz1d0mv5g_q7.js` | 110 KiB | 162 | 0 |  |
| `0ebdng4vfm6wj.js` | 42 KiB | 57 | 7 | PartyHowToPlay |
| `0einiv7k8899j.css` | 32 KiB |  | 0 |  |
| `0pn_rv1z008z4.js` | 135 KiB | 192 | 0 |  |
| `0r2pf9ih29dld.js` | 28 KiB | 37 | 12 | AnnouncementGate, GameDiscovery, MerchLink, OriginleInvite |
| `1078piir82mqg.js` | 43 KiB | 54 | 0 |  |
| `11g3xuiafo48i.js` | 53 KiB | 71 | 0 |  |
| `19gcuy9rluu7_.js` | 134 KiB | 199 | 3 | ArchiveCalendarModal, GameHistoryModal |
| `1c60lcmp9l51i.js` | 28 KiB | 35 | 5 | DailyIntro, Day100Thanks, DoneView |
| `1nc1cayvsz2op.css` | 44 KiB |  | 0 |  |
| `20tpvsvhve2am.js` | 37 KiB | 47 | 11 | ChainleLink, SettingsControl, SiteMenu |
| `240trhd7lpzk0.css` | 21 KiB |  | 0 |  |
| `2v0l13n4i2-rx.css` | 38 KiB |  | 0 |  |
| `36ssnkm0cjgq6.js` | 6 KiB | 7 | 0 |  |
| `3cqlkkj_bn_mz.js` | 27 KiB | 34 | 5 |  |
| `3ipjrnh99b057.js` | 19 KiB | 24 | 3 |  |
| `3itjc0tls3d-u.js` | 53 KiB | 75 | 3 |  |
| `3j028aa--jhrw.js` | 34 KiB | 44 | 6 |  |
| `3j9no1a_hemcb.css` | 9 KiB |  | 0 |  |
| `3me4f2hpci-y4.js` | 32 KiB | 40 | 14 | CharacterControl, InstagramPromo, PlushiePromo |
| `3pn9kwm6szrpy.js` | 30 KiB | 40 | 0 |  |
| `41j88bzyx2w1d.js` | 32 KiB | 48 | 1 |  |
| `turbopack-15ml26dbdhvdy.js` | 11 KiB | 16 | 0 |  |

## Reading a chunk

Each file starts with a push into `globalThis.TURBOPACK`, then repeated
`<moduleId>, <factory>` entries. The CSS module export maps come first and name
the component, so searching a component name (for example `DailyIntro`) lands on
its chunk; searching `pretty/` for a class name lands on the markup that uses it.

Components seen across the build: 18.
