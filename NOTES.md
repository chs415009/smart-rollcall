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
