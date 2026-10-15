// Returns the demo event to the exact P7 recording start state without re-seeding, so
// every seeded pass QR stays the same. Run before every take: `npm run reset:demo`
import { createClient } from "@supabase/supabase-js";
import { DEMO_GUESTS, FILLER_GUESTS, PRECHECKED_GUEST } from "./demo-guests.mjs";

const eventId = process.env.NEXT_PUBLIC_DEMO_EVENT_ID;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function check({ error }) {
  if (error) throw error;
}

for (const table of ["checkins", "scan_log", "guest_changes"]) {
  check(await db.from(table).delete().eq("event_id", eventId));
}

// Guests added during a take (manual or LLM) go away entirely.
check(await db.from("attendees").delete().eq("event_id", eventId).in("added_via", ["manual", "llm"]));

// Un-revoke everyone and restore seed notes and ticket types. Ticket type isn't in the
// signed pass, so this never changes a QR code.
check(await db.from("attendees").update({ revoked_at: null, note: null }).eq("event_id", eventId));
for (const g of [...DEMO_GUESTS, ...FILLER_GUESTS]) {
  check(
    await db
      .from("attendees")
      .update({ note: g.note, ticket_type: g.ticket_type })
      .eq("event_id", eventId)
      .eq("name", g.name),
  );
}

const { data: james, error: jErr } = await db
  .from("attendees")
  .select("id")
  .eq("event_id", eventId)
  .eq("name", PRECHECKED_GUEST)
  .single();
if (jErr) throw new Error(`${PRECHECKED_GUEST} not found — run \`npm run seed\` once after the P7 migration`);
check(await db.from("checkins").insert({ event_id: eventId, attendee_id: james.id }));

const { count } = await db
  .from("attendees")
  .select("*", { count: "exact", head: true })
  .eq("event_id", eventId);
console.log(`Demo reset: ${count} guests, none revoked, ${PRECHECKED_GUEST} checked in.`);
