// Server only: reads the issuer private key. Never import from a client component.
import { signPass } from "./pass";
import { DEMO_EVENT_ID } from "./issuer";
import type { Attendee } from "./types";

function privateKey(): string {
  const key = process.env.ISSUER_PRIVATE_KEY_HEX;
  if (!key) throw new Error("ISSUER_PRIVATE_KEY_HEX missing");
  return key;
}

export async function issuePassFor(attendee: Attendee): Promise<string> {
  return signPass(
    {
      v: 1,
      eid: attendee.event_id,
      aid: attendee.id,
      n: attendee.name,
      // iat from created_at keeps the pass deterministic: same attendee, same QR, every load.
      iat: Math.floor(new Date(attendee.created_at).getTime() / 1000),
    },
    privateKey(),
  );
}

// Demo tool only: a genuinely signed pass whose attendee id is not in the database.
// Fixed id + iat so the QR is stable across loads.
export const UNLISTED_ATTENDEE_ID = "00000000-0000-4000-8000-000000000000";
export async function issueUnlistedPass(): Promise<string> {
  return signPass(
    { v: 1, eid: DEMO_EVENT_ID, aid: UNLISTED_ATTENDEE_ID, n: "Uninvited Guest", iat: 1760000000 },
    privateKey(),
  );
}
