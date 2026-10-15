import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host-auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { DEMO_EVENT_ID } from "@/lib/issuer";
import type { HostGuest } from "@/lib/types";

export const dynamic = "force-dynamic";

// Full guest list for /host, including notes and revoked guests.
export async function GET(req: Request) {
  const denied = requireHost(req);
  if (denied) return denied;

  const db = supabaseAdmin();
  const [attendees, checkins] = await Promise.all([
    db
      .from("attendees")
      .select("id, name, ticket_type, note, revoked_at, added_via")
      .eq("event_id", DEMO_EVENT_ID)
      .order("name"),
    db.from("checkins").select("attendee_id, checked_in_at").eq("event_id", DEMO_EVENT_ID),
  ]);
  const err = attendees.error ?? checkins.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const checkedInAt = new Map((checkins.data ?? []).map((c) => [c.attendee_id, c.checked_in_at]));
  const guests: HostGuest[] = (attendees.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    ticketType: a.ticket_type,
    note: a.note,
    revokedAt: a.revoked_at,
    checkedInAt: checkedInAt.get(a.id) ?? null,
    addedVia: a.added_via,
  }));
  return NextResponse.json({ guests }, { headers: { "cache-control": "no-store" } });
}
