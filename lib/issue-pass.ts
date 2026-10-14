// Server only: reads the issuer private key. Never import from a client component.
import { signPass } from "./pass";
import type { Attendee } from "./types";

export async function issuePassFor(attendee: Attendee): Promise<string> {
  const key = process.env.ISSUER_PRIVATE_KEY_HEX;
  if (!key) throw new Error("ISSUER_PRIVATE_KEY_HEX missing");
  return signPass(
    {
      v: 1,
      eid: attendee.event_id,
      aid: attendee.id,
      n: attendee.name,
      // iat from created_at keeps the pass deterministic: same attendee, same QR, every load.
      iat: Math.floor(new Date(attendee.created_at).getTime() / 1000),
    },
    key,
  );
}
