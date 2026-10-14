# CLAUDE.md

## Mission

Build **Smart Rollcall** (repo: `smart-rollcall`) — an event check-in system that
verifies cryptographically signed attendee passes and shows live attendance to the
organizer.

This is a demo prototype for a job application. It will be shown in a 5-minute recorded
pitch video to a potential employer. **The demo must not break on camera.** Reliability
and a clean demo path beat feature count, always.

## Hard constraints

- **Deadline: Thursday Oct 15, 2026, 4:00 PM ET.** Code must be frozen and deployed
  several hours before that to leave time for recording.
- Must be deployed to a **public HTTPS URL** (Vercel). Camera access requires HTTPS.
- Must work on a **real phone browser** (the scanner is used handheld in the demo).
- No real personal data anywhere. Seed with obviously fake names.

## Non-goals — do not build these

Do not add these even if they seem natural. They cost time and add demo risk:

- User accounts, login, auth, roles, permissions
- Multi-event management UI (one seeded event is enough)
- Email / SMS sending
- CSV import/export
- Mobile native app
- Tests beyond a couple of sanity checks on the crypto helpers
- Dark mode toggle, i18n, animations beyond simple state transitions

If you think something outside this spec is needed, **ask before building it.**

## Stack (locked — do not substitute)

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase Postgres (via `@supabase/supabase-js`)
- `@noble/ed25519` for signing/verification
- `html5-qrcode` for camera scanning
- `qrcode` for rendering pass QR images
- Deployed on Vercel

Live dashboard updates use **2-second polling**, not WebSockets or Supabase Realtime.
Polling is boring and will not fail during the demo. Only consider upgrading if
everything else is finished and tested.

---

## The core idea (read this before writing any code)

An attendee pass is **not** just a database ID in a QR code. It is a signed credential.

- The organizer (issuer) holds an **Ed25519 private key**, stored server-side only.
- Each pass is a payload signed with that key.
- The scanner holds only the **public key** and can verify a pass is authentic
  **without contacting the server**. The server then independently re-verifies and
  records the check-in.

This is what makes the product defensible in the pitch: a forged or tampered QR code is
rejected by math, not by a database lookup, and verification still works if the venue's
network drops.

### Pass format

The QR code encodes a single ASCII string:

```
<base64url(payload_json)>.<base64url(signature)>
```

Payload JSON:

```json
{
  "v": 1,
  "eid": "<event uuid>",
  "aid": "<attendee uuid>",
  "n": "Attendee Name",
  "iat": 1760000000
}
```

- `n` is included so the scanner can display the name offline.
- Signature is Ed25519 over the raw UTF-8 bytes of the payload JSON string
  (sign the exact bytes that were base64url-encoded — do not re-serialize).

### Verification outcomes

The check-in endpoint must return exactly one of these, and the scanner UI must render
each one distinctly. **These four states are the demo.** Get them right.

| Result | Meaning | UI |
|---|---|---|
| `VALID` | Good signature, on the list, first scan | Green. Big checkmark, attendee name, "Checked in" |
| `DUPLICATE` | Good signature, already checked in | Amber. Name + original check-in time |
| `INVALID_SIGNATURE` | Signature does not verify — forged or tampered pass | Red. "Invalid pass — signature failed" |
| `NOT_ON_LIST` | Signature verifies but attendee not in this event | Red. "Not on the guest list" |

Verify the signature **client-side first** (instant feedback, proves the offline story),
then POST to the server, which re-verifies and is authoritative for duplicate detection.

---

## Data model

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  ticket_type text default 'General',
  created_at timestamptz not null default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid not null references attendees(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (event_id, attendee_id)
);

create table scan_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  attendee_id uuid,
  result text not null,
  scanned_at timestamptz not null default now()
);
```

`checkins` has a unique constraint so duplicate detection is enforced by the database,
not by a read-then-write race. Catch the unique-violation error and return `DUPLICATE`.

`scan_log` records every scan including failures — it feeds a "rejected passes" counter
on the dashboard, which is a nice detail in the pitch.

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing. Three big links: Scanner, Dashboard, Passes. Keep it minimal. |
| `/scan` | Camera scanner. The main demo surface. Must look good on a phone. |
| `/dashboard` | Live attendance. Checked-in count, expected count, rate, rejected scans, and a list of attendees with status. Polls every 2s. |
| `/passes` | Grid of seeded attendees; click one to see its QR. This is how you produce a scannable pass during the demo. |
| `/passes/[attendeeId]` | One attendee's pass QR, large and high-contrast so it scans off a laptop screen. |
| `/demo/forge` | **Demo tool.** Produces a tampered pass: takes a real pass, changes the name in the payload, keeps the original signature. Used to show rejection. Label the page clearly as a demo tool. |

### API routes

- `POST /api/checkin` — body `{ pass: string }`. Verifies signature server-side, inserts
  check-in, returns `{ result, attendee?, checkedInAt? }`.
- `GET /api/dashboard?eventId=...` — returns counts + attendee list with status.
- `GET /api/pubkey` — returns the event's Ed25519 public key (hex) for client-side verification.

---

## Build order

Work in these phases. **After each phase, stop and confirm it works before moving on.**
Do not build ahead.

### P0 — Scaffold (target 30 min)
- `create-next-app` with TypeScript + Tailwind + App Router
- Supabase project created, schema applied, `.env.local` populated
- Generate an Ed25519 keypair, store private key in env, commit the public key hex to code
- Seed script: 1 event + 40 fake attendees (use clearly fictional names)
- **Checkpoint:** `npm run dev` loads, seed data visible in Supabase

### P1 — Passes (target 45 min)
- Server-side pass generation helper (`lib/pass.ts`): `signPass()`, `verifyPass()`
- `/passes` grid and `/passes/[id]` QR display
- **Checkpoint:** a QR renders and `verifyPass()` round-trips it correctly

### P2 — Scanner + check-in (target 90 min)
- `/scan` with html5-qrcode, rear camera, continuous scanning
- Client-side signature verification, then `POST /api/checkin`
- All four result states rendered distinctly
- Debounce: ignore the same pass string for 3s after a scan so the camera doesn't
  fire repeatedly on one code
- **Checkpoint:** VALID and DUPLICATE both work locally

### P3 — Deploy and test on a real phone (do this NOW, not at the end)
- Push to GitHub, import to Vercel, set env vars, deploy
- Open the Vercel URL on an actual phone and scan a QR off the laptop screen
- **Checkpoint:** camera opens and a scan succeeds on the phone. If this fails, stop
  everything and fix it — the whole demo depends on it.

### P4 — Dashboard (target 45 min)
- `/dashboard` with counts, attendance rate, rejected-scan count, attendee list
- 2-second polling
- **Checkpoint:** scanning on the phone updates the dashboard on the laptop within 2s

### P5 — Forgery demo + polish (target 45 min)
- `/demo/forge` producing a tampered pass
- `INVALID_SIGNATURE` and `NOT_ON_LIST` states verified end to end
- Visual pass: make the scanner result screen large and unambiguous — it will be filmed
- **Checkpoint:** all four states demonstrable in sequence without a page reload

### P6 — Freeze
- No new features. Fix only what is broken.
- Write README with: what it is, how to run, the architecture in 5 lines, and an
  "AI assistance" note.

---

## The demo sequence this must support

Rehearse against this. Every phase above exists to make this run smoothly:

1. Dashboard on laptop shows 0 / 40 checked in
2. Scan a valid pass on phone → green, name appears → dashboard ticks to 1 / 40
3. Scan the *same* pass again → amber, "already checked in at 3:42 PM"
4. Scan a forged pass from `/demo/forge` → red, "signature failed" → dashboard rejected count increments

If any step needs a page refresh, a retry, or an explanation, it is not finished.

---

## UI guidance

The scanner result screen is the single most-filmed surface. It should be:

- Full-bleed color for the result state (green / amber / red), readable from across a room
- Attendee name at large size
- One line of supporting detail, nothing more
- Auto-reset to the camera view after ~4 seconds

Everything else should be clean and plain. No gradients-on-gradients, no decorative
illustration. Think "operations tool a venue staffer uses at 7pm with a queue behind
them."

---

## Conventions

- `lib/` for crypto, Supabase client, and shared types
- Server-only secrets never imported into client components
- All four result codes defined once as a TypeScript union, used everywhere
- Keep components small; no state management library

### Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ISSUER_PRIVATE_KEY_HEX=
NEXT_PUBLIC_ISSUER_PUBLIC_KEY_HEX=
NEXT_PUBLIC_DEMO_EVENT_ID=
```

Never commit `.env.local`. Do commit `.env.example`.

---

## Progress log

Keep a file at `NOTES.md` in the repo root. At the end of each phase, append a short
entry — no more than 6 lines:

```
## P2 — scanner (done 14:20)
- Working: VALID and DUPLICATE on desktop
- Decision: debounce set to 3s, same pass ignored within window
- Open: not yet tested on phone
- Next: P3 deploy
```

Record **decisions and surprises**, not a narration of what was typed. This file exists
so that a fresh session (or the author, after sleep) can pick up without re-reading the
whole codebase. It is also raw material for the pitch: the "why I built it this way"
answers come from here.

Do not update `CLAUDE.md` during the build. It is the spec. If reality diverges from the
spec, note the divergence in `NOTES.md` and flag it to the author.

## Working agreement

- Ask before adding any dependency not listed above.
- Ask before changing the pass format or the four result codes.
- If a phase runs more than ~50% over its target, stop and flag it rather than pushing on.
- Prefer the boring solution every time. This ships tomorrow.
