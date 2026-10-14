# Smart Rollcall — progress notes

## P0 — scaffold (done 2026-10-14)
- Working: Next 15.5 + TS + Tailwind 4, `npm run dev` 200, Supabase seeded (1 event, 40 attendees)
- Decision: seed/keygen are plain `.mjs` run via `node --env-file` — no tsx/dotenv dep needed
- Decision: seed uses fixed event id `25225fe2-…` and is idempotent (delete + re-insert, cascades)
- Decision: RLS enabled with no policies; all DB access via service-role key in server routes
- Divergence: spec says "anon key"; new Supabase UI calls it publishable key — either works
- Next: P1 passes (`lib/pass.ts`, `/passes`, `/passes/[id]`)
