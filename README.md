# Smart Rollcall

Event check-in where every attendee pass is a **cryptographically signed credential**,
not just an ID in a QR code. A forged or tampered pass is rejected by math, not by a
database lookup, and the scanner can verify a pass even if the venue network drops.

**Live demo:** https://smart-rollcall.vercel.app — scanner on a phone, dashboard on a laptop.

| Scan result | Meaning |
|---|---|
| 🟢 `VALID` | Good signature, on the guest list, first scan |
| 🟡 `DUPLICATE` | Good signature, already checked in (shows the original time) |
| 🔴 `INVALID_SIGNATURE` | Signature does not verify: forged or tampered |
| 🔴 `NOT_ON_LIST` | Genuinely signed, but not on this event's guest list |

## Architecture

1. The organizer signs each pass with an **Ed25519 private key** held only on the server.
   A pass is `base64url(payload_json).base64url(signature)`.
2. The scanner (`/scan`) bundles only the **public key** and verifies the signature in the
   browser first, for instant feedback that also works offline.
3. It then POSTs to `/api/checkin`. The server re-verifies, checks the guest list, and records
   the check-in. The server's answer is the one that counts.
4. Duplicates are caught by a **unique constraint** in Postgres (Supabase), not by
   read-then-write, so two scanners can't both admit the same pass.
5. Every scan, including rejections, is logged. `/dashboard` polls every 2 s for counts,
   attendance rate, and rejected scans.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Supabase Postgres ·
`@noble/ed25519` · `html5-qrcode` · `qrcode` · Vercel.

## Pages

- `/scan`: camera scanner (phone, rear camera)
- `/dashboard`: live attendance
- `/passes` → `/passes/[id]`: an attendee's signed pass as a QR code
- `/demo/forge`: **demo tool** that produces a tampered pass (name changed, original
  signature kept) and a genuinely signed pass for someone not on the list

## Run locally

Requires Node 22+ and a Supabase project.

```bash
npm install
cp .env.example .env.local      # fill in the Supabase URL and keys
npm run keygen                  # prints a new issuer keypair → paste both into .env.local
```

Then run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor, and:

```bash
npm run seed        # 1 demo event + 40 fictional attendees
npm run dev         # http://localhost:3000
```

The camera needs HTTPS or `localhost`. To test on a phone, deploy (e.g. Vercel, with the
same env vars) rather than using the laptop's LAN IP over plain HTTP.

| Script | Purpose |
|---|---|
| `npm run reset` | Clear check-ins and scan log; attendees and their QR codes are kept |
| `npm run check:pass` | Sanity checks for the signing/verification helpers |

All attendee data is fictional seed data.

## Design notes

Decisions and trade-offs made during the build are logged phase by phase in
[`NOTES.md`](NOTES.md). The original spec is [`CLAUDE.md`](CLAUDE.md).

## AI assistance

Built with [Claude Code](https://claude.com/claude-code) as a coding assistant. I wrote
the spec ([`CLAUDE.md`](CLAUDE.md)): the signed-pass design, the four result states, the
scope limits, and a build order with a checkpoint after each phase. Claude Code wrote
the code one phase at a time. I reviewed each phase and tested it myself (webcam, then a
real phone against the deployed site) before moving on.
