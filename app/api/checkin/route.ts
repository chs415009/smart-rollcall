import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyPass } from "@/lib/pass";
import { DEMO_EVENT_ID, ISSUER_PUBLIC_KEY_HEX } from "@/lib/issuer";
import type { CheckinResponse, CheckinResult } from "@/lib/types";

const UNIQUE_VIOLATION = "23505";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pass = typeof body?.pass === "string" ? body.pass : "";
  const db = supabaseAdmin();

  // Every scan is logged against the venue's event, including rejections.
  // For a failed signature the payload is untrusted, so no attendee id is recorded.
  async function respond(res: CheckinResponse, attendeeId: string | null) {
    await db
      .from("scan_log")
      .insert({ event_id: DEMO_EVENT_ID, attendee_id: attendeeId, result: res.result });
    return NextResponse.json(res);
  }
  const reject = (result: CheckinResult, attendeeId: string | null = null) =>
    respond({ result }, attendeeId);

  const verified = await verifyPass(pass, ISSUER_PUBLIC_KEY_HEX);
  if (!verified.ok) return reject("INVALID_SIGNATURE");
  const { eid, aid } = verified.payload;

  if (eid !== DEMO_EVENT_ID) return reject("NOT_ON_LIST");
  const { data: attendee, error: findErr } = await db
    .from("attendees")
    .select("id, name, ticket_type, revoked_at")
    .eq("id", aid)
    .eq("event_id", DEMO_EVENT_ID)
    .maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!attendee) return reject("NOT_ON_LIST");

  const who = { name: attendee.name, ticketType: attendee.ticket_type };

  // The pass is still cryptographically valid; the host withdrew it. Checked before
  // duplicates, so a revoked guest who already checked in is refused too.
  if (attendee.revoked_at) return respond({ result: "REVOKED", attendee: who }, aid);

  // The unique constraint decides duplicates — no read-then-write race.
  const { data: inserted, error: insErr } = await db
    .from("checkins")
    .insert({ event_id: DEMO_EVENT_ID, attendee_id: aid })
    .select("checked_in_at")
    .single();

  if (!insErr) {
    return respond({ result: "VALID", attendee: who, checkedInAt: inserted.checked_in_at }, aid);
  }
  if (insErr.code !== UNIQUE_VIOLATION) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const { data: existing } = await db
    .from("checkins")
    .select("checked_in_at")
    .eq("event_id", DEMO_EVENT_ID)
    .eq("attendee_id", aid)
    .single();
  return respond({ result: "DUPLICATE", attendee: who, checkedInAt: existing?.checked_in_at }, aid);
}
