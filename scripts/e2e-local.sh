#!/usr/bin/env bash
# Hard end-to-end pass against a local dev worker (own D1, live free lanes).
#
#   npm run dev            # in another terminal
#   bash scripts/e2e-local.sh
#
# It uses the Bug Bash session and skips any step whose build was rate-limited.
set -u
U=${E2E_URL:-http://127.0.0.1:5180}
J=/tmp/e2e-cookies.txt
PASS=0; FAIL=0; FAILED=""
ok()   { PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); FAILED="$FAILED
  - $1"; printf 'FAIL  %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: expected $3, got $2"; fi }
has()   { if printf '%s' "$2" | grep -q "$3"; then ok "$1"; else bad "$1: /$3/ not in output"; fi }
hasnt() { if printf '%s' "$2" | grep -q "$3"; then bad "$1: /$3/ present"; else ok "$1"; fi }

rm -f "$J"
printf '\n== auth and validation ==\n'
code=$(curl -sS -c "$J" -o /dev/null -w '%{http_code}' -X POST "$U/api/auth/guest" -H "origin: $U" -H 'content-type: application/x-www-form-urlencoded' --data 'returnTo=%2F')
check "guest sign-in" "$code" "303"
grep -qE 'stet_guest|ink_' "$J" && ok "session cookie stored" || bad "session cookie not stored"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$U/api/buffy/code" -H 'origin: https://evil.example' -H 'content-type: application/json' --data '{"prompt":"x"}')
check "foreign origin rejected" "$code" "403"
code=$(curl -sS -b "$J" -o /dev/null -w '%{http_code}' -X POST "$U/api/buffy/code" -H "origin: $U" -H 'content-type: application/json' --data '{"prompt":"   ","model":"dent"}')
check "empty prompt rejected" "$code" "400"

printf '\n== workspace read ==\n'
W=$(curl -sS -b "$J" -m 20 "$U/api/buffy/code/workspace")
has "workspace shape" "$W" '"history"'

printf '\n== build 1: a page that keeps its CSS in styles.css ==\n'
curl -sS -b "$J" -m 300 -N -X POST "$U/api/buffy/code" -H "origin: $U" -H 'content-type: application/json' \
  --data '{"prompt":"Make a small page with an h1 that says Step One, one button labelled Go, and put the CSS in a separate styles.css file.","model":"dent"}' > /tmp/b1.sse 2>&1
has "build event" "$(cat /tmp/b1.sse)" '^event: build'
S=$(grep -o '"score":[0-9]*' /tmp/b1.sse | tail -1 | grep -o '[0-9]*')
if [ -n "${S:-}" ] && [ "$S" -ge 70 ]; then ok "page score $S"; else bad "page score ${S:-none}"; fi
W=$(curl -sS -b "$J" -m 20 "$U/api/buffy/code/workspace")
has "heading saved" "$W" 'Step One'
has "styles.css exists" "$W" '"path":"styles.css"'
has "page links the stylesheet" "$W" 'href=\\"./?styles.css'

printf '\n== build 2: edit the page (h1 changes, title should follow) ==\n'
curl -sS -b "$J" -m 300 -N -X POST "$U/api/buffy/code" -H "origin: $U" -H 'content-type: application/json' \
  --data '{"prompt":"Change the heading to Step Two and make the button background green.","model":"dent"}' > /tmp/b2.sse 2>&1
W=$(curl -sS -b "$J" -m 20 "$U/api/buffy/code/workspace")
has "heading changed" "$W" 'Step Two'
H1=$(printf '%s' "$W" | python -c "import sys,json,re; d=json.load(sys.stdin); h=[f for f in d['files'] if f['path'].endswith('.html')][0]['content']; m=re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S); print(re.sub(r'<[^>]+>','',m.group(1)).strip() if m else '')")
check "h1 text is the new heading" "$H1" "Step Two"
has "history recorded" "$W" '"history"'

printf '\n== build 3: rename a file (the phrasing that used to rebuild) ==\n'
curl -sS -b "$J" -m 300 -N -X POST "$U/api/buffy/code" -H "origin: $U" -H 'content-type: application/json' \
  --data '{"prompt":"Move the CSS into a file called theme.css instead of styles.css, and make sure the page still links it.","model":"dent"}' > /tmp/b3.sse 2>&1
hasnt "no new project started" "$(cat /tmp/b3.sse)" 'Starting a new project'
has "the saved project was read" "$(cat /tmp/b3.sse)" 'Reading the current project'
W=$(curl -sS -b "$J" -m 20 "$U/api/buffy/code/workspace")
has "theme.css exists" "$W" '"path":"theme.css"'
hasnt "styles.css is gone" "$W" '"path":"styles.css"'
has "link points at theme.css" "$W" 'href=\\"theme.css'
has "heading survived the rename" "$W" 'Step Two'
hasnt "no consistency warnings" "$(cat /tmp/b3.sse)" 'consistency problem'

printf '\n== undo ==\n'
code=$(curl -sS -b "$J" -o /tmp/rev.json -w '%{http_code}' -m 30 -X POST "$U/api/buffy/code/revert" -H "origin: $U" -H 'content-type: application/json' --data '{}')
check "revert accepted" "$code" "200"
W=$(curl -sS -b "$J" -m 20 "$U/api/buffy/code/workspace")
has "styles.css restored" "$W" '"path":"styles.css"'
has "heading still Step Two" "$W" 'Step Two'
code=$(curl -sS -b "$J" -o /dev/null -w '%{http_code}' -m 30 -X POST "$U/api/buffy/code/revert" -H "origin: $U" -H 'content-type: application/json' --data '{}')
check "second revert is clean (200 or 404)" "$([ "$code" = "200" ] || [ "$code" = "404" ] && echo ok)" "ok"

printf '\n== summary ==\n'
printf 'passed %s, failed %s%s\n' "$PASS" "$FAIL" "$FAILED"
