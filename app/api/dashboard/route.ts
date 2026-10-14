import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { DEMO_EVENT_ID } from "@/lib/issuer";
import type { CheckinResult, DashboardResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REJECTED: CheckinResult[] = ["INVALID_SIGNATURE", "NOT_ON_LIST"];

export async function GET(req: Request) {
  const eventId = new URL(req.url).searchParams.get("eventId") ?? DEMO_EVENT_ID;
  if (!UUID.test(eventId)) return NextResponse.json({ error: "bad eventId" }, { status: 400 });

  const db = supabaseAdmin();
  const [event, attendees, checkins, rejected] = await Promise.all([
    db.from("events").select("name, venue").eq("id", eventId).maybeSingle(),
    db.from("attendees").select("id, name, ticket_type").eq("event_id", eventId).order("name"),
    db.from("checkins").select("attendee_id, checked_in_at").eq("event_id", eventId),
    db
      .from("scan_log")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("result", REJECTED),
  ]);
  const err = event.error ?? attendees.error ?? checkins.error ?? rejected.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  if (!event.data) return NextResponse.json({ error: "event not found" }, { status: 404 });

  const attendeeRows = attendees.data ?? [];
  const checkinRows = checkins.data ?? [];
  const checkedInAt = new Map(checkinRows.map((c) => [c.attendee_id, c.checked_in_at]));
  const body: DashboardResponse = {
    event: event.data,
    expected: attendeeRows.length,
    checkedIn: checkinRows.length,
    rejected: rejected.count ?? 0,
    attendees: attendeeRows.map((a) => ({
      id: a.id,
      name: a.name,
      ticketType: a.ticket_type,
      checkedInAt: checkedInAt.get(a.id) ?? null,
    })),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
