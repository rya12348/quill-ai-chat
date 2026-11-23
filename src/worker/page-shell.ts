/**
 * The base design system every page the agent writes ships with.
 *
 * Why this is code and not a prompt: a page's looks used to depend entirely on
 * the model emitting a 5–7 KB stylesheet inside a reply whose file budget is
 * ~2,400 characters. On a free lane that reply is regularly cut off, and the
 * page shipped at design 0–45 with no type scale, no breakpoint and default
 * buttons — not because the model cannot design, but because the stylesheet
 * never arrived. Prompting harder cannot fix a transport limit.
 *
 * So the foundation is deterministic: tokens, type scale, shell width, sticky
 * header, nav spacing, buttons, inputs, cards, two breakpoints, focus rings and
 * reduced motion are all here. It is injected at the top of <head> with
 * zero-specificity `:where()` selectors, so any rule the page writes — a class,
 * an element, its own `:root` palette — wins without a fight. The model is left
 * with the part that is actually about the request: structure and content.
 */
export const PAGE_SHELL_ATTR = 'data-ink-shell'

const SHELL_BLOCK = new RegExp(
  `<style\\b[^>]*\\b${PAGE_SHELL_ATTR}\\b[^>]*>[\\s\\S]*?<\\/style>\\s*`,
  'gi',
)

export const PAGE_SHELL_CSS = `
:root{
  --ink-bg:#f6f4f0;
  --ink-surface:#ffffff;
  --ink-surface-2:#eeeae3;
  --ink-text:#1c1a17;
  --ink-muted:#6c665d;
  --ink-line:#e2ddd4;
  --ink-accent:#1e5d4c;
  --ink-accent-text:#ffffff;
  --ink-radius:16px;
  --ink-radius-sm:10px;
  --ink-shadow:0 1px 2px rgba(24,20,16,.05),0 18px 40px -24px rgba(24,20,16,.35);
  --ink-space:clamp(1rem,2.4vw,1.5rem);
  --ink-shell:1180px;
  --ink-font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --ink-display:ui-serif,Georgia,"Iowan Old Style","Times New Roman",serif;
  color-scheme:light;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:5rem}
:where(body){
  margin:0;
  background:var(--ink-bg);
  color:var(--ink-text);
  font-family:var(--ink-font);
  font-size:clamp(1rem,.4vw + .92rem,1.075rem);
  line-height:1.65;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
:where(h1,h2,h3,h4,h5,h6){
  font-family:var(--ink-display);
  font-weight:600;
  line-height:1.1;
  letter-spacing:-.02em;
  text-wrap:balance;
  margin:0 0 .55em;
}
:where(h1){font-size:clamp(2.1rem,5vw,3.4rem);letter-spacing:-.03em;line-height:1.02}
:where(h2){font-size:clamp(1.45rem,2.6vw,2.1rem)}
:where(h3){font-size:clamp(1.1rem,1.4vw,1.32rem);letter-spacing:-.01em}
:where(p,li){max-width:68ch}
:where(p){margin:0 0 1em}
:where(p:last-child){margin-bottom:0}
:where(a){color:var(--ink-accent);text-decoration-thickness:.08em;text-underline-offset:.18em}
:where(a:hover){text-decoration-thickness:.12em}
:where(strong,b){font-weight:650}
:where(small){font-size:.85em;color:var(--ink-muted)}
:where(ul,ol){padding-left:1.2rem;margin:0 0 1em}
:where(li+li){margin-top:.35em}
:where(header){
  position:sticky;
  top:0;
  z-index:20;
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
  gap:.75rem 1.5rem;
  padding:.85rem clamp(1rem,4vw,2rem);
  border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);
  backdrop-filter:saturate(140%) blur(12px);
}
:where(header a){color:inherit;text-decoration:none}
nav{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.4rem}
:where(nav a){color:inherit;text-decoration:none;font-size:.94rem;font-weight:500;opacity:.78}
:where(nav a:hover){opacity:1}
:where(nav a):focus-visible{opacity:1}
:where(main){
  width:100%;
  max-width:var(--ink-shell);
  margin-inline:auto;
  padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,2rem);
}
:where(section){padding-block:clamp(1.75rem,4vw,3rem)}
:where(section+section){border-top:1px solid var(--ink-line)}
:where(footer){
  max-width:var(--ink-shell);
  margin-inline:auto;
  padding:2rem clamp(1rem,4vw,2rem);
  border-top:1px solid var(--ink-line);
  color:var(--ink-muted);
  font-size:.9rem;
}
:where(article,aside){
  background:color-mix(in srgb,currentColor 5%,transparent);
  border:1px solid color-mix(in srgb,currentColor 14%,transparent);
  border-radius:var(--ink-radius);
  padding:clamp(1rem,2vw,1.5rem);
  box-shadow:var(--ink-shadow);
}
:where(button,.button,[role="button"]){
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:.5rem;
  background:var(--ink-accent);
  color:var(--ink-accent-text);
  border:1px solid transparent;
  border-radius:999px;
  padding:.7rem 1.15rem;
  font:inherit;
  font-weight:600;
  line-height:1.2;
  text-decoration:none;
  cursor:pointer;
  transition:transform .16s ease,background-color .2s ease,box-shadow .2s ease;
}
:where(button:hover,.button:hover,[role="button"]:hover){transform:translateY(-1px);box-shadow:var(--ink-shadow)}
:where(button:active,.button:active,[role="button"]:active){transform:none}
:where(button:disabled,[aria-disabled="true"]){opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
:where(input,select,textarea){
  width:100%;
  background:color-mix(in srgb,currentColor 4%,transparent);
  color:inherit;
  border:1px solid color-mix(in srgb,currentColor 20%,transparent);
  border-radius:var(--ink-radius-sm);
  padding:.7rem .85rem;
  font:inherit;
  transition:border-color .15s ease,box-shadow .15s ease;
}
:where(input,select,textarea):hover{border-color:color-mix(in srgb,var(--ink-muted) 45%,var(--ink-line))}
:where(input,select,textarea):focus-visible{
  outline:2px solid var(--ink-accent);
  outline-offset:2px;
  border-color:var(--ink-accent);
}
:where(label){
  display:block;
  margin-bottom:.4rem;
  font-size:.82rem;
  font-weight:600;
  letter-spacing:.04em;
  text-transform:uppercase;
  color:var(--ink-muted);
}
::placeholder{color:color-mix(in srgb,currentColor 55%,transparent)}
:where(a,button,summary,[tabindex]):focus-visible{outline:2px solid var(--ink-accent);outline-offset:3px}
::selection{background:var(--ink-accent);color:var(--ink-accent-text)}
:where(img,svg,video,canvas){max-width:100%;height:auto;display:block}
:where(img){object-fit:cover;border-radius:var(--ink-radius)}
:where(figure){margin:0}
.media{aspect-ratio:16/9;overflow:hidden;border-radius:var(--ink-radius);background:color-mix(in srgb,currentColor 8%,transparent)}
.media img{width:100%;height:100%;object-fit:cover}
:where(table){width:100%;border-collapse:collapse;font-size:.95rem}
:where(th,td){text-align:left;padding:.75rem .9rem;border-bottom:1px solid var(--ink-line);vertical-align:top}
:where(th){font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted);font-weight:700}
:where(tbody tr:hover){background:color-mix(in srgb,currentColor 4%,transparent)}
:where(blockquote){
  margin:1.5rem 0;
  padding:1rem 1.25rem;
  border-left:3px solid var(--ink-accent);
  border-radius:0 var(--ink-radius-sm) var(--ink-radius-sm) 0;
  background:color-mix(in srgb,currentColor 4%,transparent);
  font-family:var(--ink-display);
  font-size:1.1rem;
}
:where(hr){border:0;border-top:1px solid var(--ink-line);margin:2rem 0}
:where(code,kbd,samp){
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.92em;
  background:var(--ink-surface-2);
  border-radius:6px;
  padding:.15em .4em;
}
:where(pre){background:var(--ink-text);color:var(--ink-bg);padding:1rem;border-radius:var(--ink-radius-sm);overflow:auto}
:where(pre code){background:none;color:inherit;padding:0}
:where(details){border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:var(--ink-radius-sm);padding:.85rem 1rem;background:color-mix(in srgb,currentColor 4%,transparent)}
:where(summary){cursor:pointer;font-weight:600}
:where(address){font-style:normal}
:where(dt){font-weight:600}
:where(dd){margin:0 0 .6rem}
.wrap{width:100%;max-width:var(--ink-shell);margin-inline:auto;padding-inline:clamp(1rem,4vw,2rem)}
.stack{display:grid;gap:var(--ink-space)}
.grid{display:grid;gap:var(--ink-space);grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))}
.cards{list-style:none;display:grid;gap:var(--ink-space);grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));padding:0;margin:0}
.card{
  background:color-mix(in srgb,currentColor 5%,transparent);
  border:1px solid color-mix(in srgb,currentColor 14%,transparent);
  border-radius:var(--ink-radius);
  padding:clamp(1rem,2vw,1.5rem);
  box-shadow:var(--ink-shadow);
}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1rem}
.eyebrow{
  margin:0 0 .5rem;
  font-size:.78rem;
  font-weight:700;
  letter-spacing:.14em;
  text-transform:uppercase;
  color:var(--ink-accent);
}
.muted{color:var(--ink-muted)}
.badge{
  display:inline-flex;
  align-items:center;
  gap:.35rem;
  padding:.25rem .6rem;
  border:1px solid color-mix(in srgb,currentColor 16%,transparent);
  border-radius:999px;
  background:color-mix(in srgb,currentColor 7%,transparent);
  font-size:.78rem;
  font-weight:600;
  letter-spacing:.02em;
}
.stat{display:grid;gap:.2rem;padding:1rem;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:var(--ink-radius-sm);background:color-mix(in srgb,currentColor 5%,transparent)}
.stat strong{font-family:var(--ink-display);font-size:clamp(1.6rem,3vw,2.2rem);line-height:1}
.field{display:grid;gap:.35rem;margin-bottom:1rem}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem}
.status{margin:.75rem 0 0;font-size:.9rem;color:var(--ink-accent)}
@media (max-width:900px){
  :where(header){gap:.5rem 1rem}
  :where(main){padding-block:1.5rem}
  .grid{grid-template-columns:1fr}
  .cards{grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))}
  :where(h1){font-size:clamp(1.9rem,7vw,2.6rem)}
}
@media (max-width:640px){
  html{scroll-padding-top:4rem}
  :where(header){
    flex-direction:column;
    align-items:flex-start;
    gap:.6rem;
    padding:.8rem 1rem;
  }
  nav{width:100%;justify-content:flex-start;gap:.4rem .9rem}
  :where(nav a){font-size:.9rem}
  :where(section){padding-block:1.5rem}
  :where(h1){font-size:clamp(1.75rem,9vw,2.2rem)}
  .grid,.cards{grid-template-columns:1fr}
  :where(article,aside){padding:1rem}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{
    animation-duration:.001ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.001ms !important;
  }
}
@media print{
  :where(header){position:static;background:none}
  :where(body){background:#fff;color:#000}
  :where(section+section){break-inside:avoid}
}
`.trim()

/**
 * Puts the design system at the top of the document's head and returns the page
 * that should be stored, previewed, checked and shipped.
 *
 * - Idempotent: every existing shell block is removed first, so a page that is
 *   rewritten, appended to or patched can never accumulate two copies.
 * - Placed first in <head>, so the page's own stylesheet (later in the document,
 *   or a class selector of higher specificity) always wins.
 * - Before a head exists — the first chunk of a page still being built — it goes
 *   after the doctype, where the parser still applies it, so even a half-page
 *   carries the foundation while the model appends the rest.
 */
/** The page's own writing, with the runtime's design system removed. */
export function stripPageShell(html: string): string {
  return html.replace(SHELL_BLOCK, '')
}

export function applyPageShell(html: string): string {
  if (!html.trim()) return html
  const clean = html.replace(SHELL_BLOCK, '')
  const block = `<style ${PAGE_SHELL_ATTR}>${PAGE_SHELL_CSS}</style>`
  const head = /<head\b[^>]*>/i.exec(clean)
  if (head) {
    const at = head.index + head[0].length
    return `${clean.slice(0, at)}${block}${clean.slice(at)}`
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(clean)
  if (doctype) {
    const at = doctype.index + doctype[0].length
    return `${clean.slice(0, at)}${block}${clean.slice(at)}`
  }
  return `${block}${clean}`
}
