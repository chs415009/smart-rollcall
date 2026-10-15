# Smart Rollcall — progress notes

## P0 — scaffold (done 2026-10-14)
- Working: Next 15.5 + TS + Tailwind 4, `npm run dev` 200, Supabase seeded (1 event, 40 attendees)
- Decision: seed/keygen are plain `.mjs` run via `node --env-file` — no tsx/dotenv dep needed
- Decision: seed uses fixed event id `25225fe2-…` and is idempotent (delete + re-insert, cascades)
- Decision: RLS enabled with no policies; all DB access via service-role key in server routes
- Divergence: spec says "anon key"; new Supabase UI calls it publishable key — either works
- Next: P1 passes (`lib/pass.ts`, `/passes`, `/passes/[id]`)

## P1 — passes (done 2026-10-14)
- Working: `/passes` (40 cards), `/passes/[id]` QR; real pass verifies with committed pubkey; `npm run check:pass` OK
- Decision: `lib/pass.ts` holds no secrets (key passed in); signing wrapper `lib/issue-pass.ts` is server-only
- Decision: `iat` = attendee `created_at` → pass is deterministic, same QR on every load
- Decision: QR error correction L (version 10, 269-char pass) — larger modules scan better off a screen
- Watch (P2): noble async verify needs WebCrypto = secure context; works on localhost/HTTPS, NOT on http://LAN-IP

## P2 — scanner + check-in (done 2026-10-14)
- Working: `/api/checkin` returns all 4 results via curl; every scan (incl. rejects) lands in `scan_log`
- Divergence: debounce is a *sliding* 3s window (refreshed while the same code stays in view) — literal
  "3s after scan" would re-fire as DUPLICATE when the 4s result screen resets with phone still held
- Decision: camera stays running under the result overlay (no restart between scans); tap overlay to dismiss
- Decision: extra non-result UI state "verified offline — not recorded" if server unreachable; `npm run reset` clears checkins+log
- Camera: VALID + DUPLICATE confirmed by author on desktop webcam. Next: P3 deploy + phone

## P3 — deploy + real phone (done 2026-10-14)
- Working: Vercel production deploy; author scanned VALID + DUPLICATE on a real phone off the laptop screen
- Decision: skipped Vercel's Supabase integration — it would create a new empty DB / overwrite env vars
- Gotcha: `NEXT_PUBLIC_*` are inlined at build time → changing them on Vercel needs a redeploy
- Gotcha: use the production `*.vercel.app` URL; preview URLs sit behind Vercel deployment protection
- Next: P4 dashboard (2s polling)

## P4 — dashboard (built 2026-10-14; phone→laptop check pending)
- Working locally: `/api/dashboard` 0/40 → 1/40 + rejected 1 after valid/dup/forged scans; `/dashboard` polls 2s
- Decision: chained setTimeout (not setInterval) so a slow response never stacks requests; last data kept on error + "Reconnecting" badge
- Decision: "rejected" = scan_log INVALID_SIGNATURE + NOT_ON_LIST; DUPLICATE is not counted as rejected
- Decision: list sorted most-recent check-in first, then expected alphabetically
- Prod URL: https://smart-rollcall.vercel.app
- P4 phone→laptop dashboard update within 2s confirmed by author on prod

## P5 — forgery demo + polish (done 2026-10-14)
- Working: API sequence VALID → DUPLICATE → INVALID_SIGNATURE → NOT_ON_LIST; dashboard 1/40, rejected 2
- Decision: `/demo/forge` also shows a *genuinely signed* pass for a non-existent attendee — only way to film NOT_ON_LIST
- Decision: forged name is editable via a GET form (no client JS); scanner never displays it (payload untrusted)
- Polish: landing page = 3 big links + small forge link; result text scales up on larger screens
- Full 4-step demo sequence run on phone against prod by author, no reloads — all passed

## P6 — freeze (2026-10-14)
- Code frozen at e6c90cd; only README + NOTES changed after. Fix-only from here.
- README: what/why, 5-line architecture, run steps, AI-assistance note (author to confirm wording)
- Before recording: `npm run reset`, open prod `/dashboard` (expect 0/40), phone on `/scan`

## P7.0 — guest-changes setup (done 2026-10-15)
- Safety: tag `demo-v1` = e6c90cd (pushed); work on `feature/guest-changes`. Migration is additive → v1 still runs on same DB
- Decision: 9 demo guests replace 9 placeholders (total stays 40); re-seeded once → all pass QRs changed once
- Working: `reset:demo` ×2 and dirty→reset both give identical state (ids, notes, revoked, check-ins); James checked in
- Gotcha: recording from `demo-v1` needs old `npm run reset` first, else James makes it 1/40
- Limitation (pitch slide): scanner can't know revocations offline → revoked pass shows grey "verified offline"

## P7.1 — REVOKED end to end (API verified 2026-10-15; camera check pending)
- Working: API test — original 4 results unchanged; revoked pass → REVOKED (+name), logged; dashboard 38 expected / 2 revoked
- Decision: REVOKED checked before DUPLICATE → a revoked guest who already checked in is still refused
- Decision: "Revoked" stat = number of revoked *guests*; "Rejected" = scans incl. REVOKED. REJECTED_RESULTS lives in lib/types
- Decision: REVOKED icon ⊘ vs ✕ for forged/not-on-list; same red. Revoked rows sorted last, struck through
- Author confirmed REVOKED + original 4 states with desktop camera

## P7.2 — /host manual CRUD (API verified 2026-10-15; UI check pending)
- Working: 401 without/wrong passcode; add / edit note / revoke each write a guest_changes row; new guest's pass → VALID
- Decision: extra route `GET /api/host/guests` (passcode-gated) — /host needs notes + revoked guests, dashboard API has neither
- Decision: applyChanges zod-checks each op at runtime; bad op rejected alone, rest apply (partial success). >30 ops → 400
- Decision: passcode compared with timingSafeEqual; unset HOST_PASSCODE fails closed. Revoke confirm = native `confirm()`
- Decision: revoked guests have no actions (no undo — non-goal); empty note on UPDATE_NOTE clears it
- Author confirmed add / edit note / revoke from the UI

## P7.3 — review cards on fixture (API verified 2026-10-15; UI check pending)
- Working: fixture → 7 cards (James flagged ALREADY_CHECKED_IN); apply 6 → Richard REVOKED, Lena VALID; 6 guest_changes rows w/ label+quote
- Decision: UPDATE_NOTE note = full replacement; prompt says keep useful old content (Tom keeps "Spouse of Sarah Okafor")
- Decision: guest list sent as one JSON object per line; fixture reads ids from it → no network, same validator path
- Decision: fixture responses show an amber "not a live model" banner in the UI — guards against recording on fixture
- Decision: ALREADY_CHECKED_IN card's main checkbox is driven by its "revoke anyway" box (one click in the demo)
- Divergence: demo step 7 says expected count changes — it doesn't (−Richard −James +Lena +Anna = 40). Revoked 0→2 does. Flagged
- Author confirmed review cards, apply, Richard REVOKED / Lena VALID in the UI

## P7.4 — Gemini adapter (done 2026-10-15)
- Working: demo messages 5/5 runs → same 7 ops + targets, Priya → nothing, 0 discarded, 1.6–2.4s; check:suggest OK; genai only in gemini.ts
- Decision: LLM_MODEL=gemini-3.5-flash-lite (author). 3.8-flash was correct when it answered but 503 "high demand" 3/5 runs, 11–15s
- Gotcha: Gemini emits JSON keys in schema order → target_id must precede note, else UPDATE_NOTE's note lands in `question`
- Gotcha: 3.8-flash rejects thinkingLevel MINIMAL (HTTP 400) → adapter uses LOW, works on both models
- Gotcha: AI Studio now issues `AQ.`-prefixed keys; works for generateContent via @google/genai 2.30
- Watch (P7.5): 503 is the main on-camera risk — no auto-retry by spec; if it hits, the UI says "unavailable, nothing changed"

## P7.5 — deploy (in progress 2026-10-15)
- Divergence (author's call): merged to main BEFORE the prod phone test, not after. Normal prod build = prod env vars for sure
- Fallback if prod test fails: Vercel Instant Rollback + `git revert` on main; `demo-v1` tag untouched. `demo-v2` only after both demos pass
