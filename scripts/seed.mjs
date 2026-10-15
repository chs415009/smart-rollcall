// Seeds 1 demo event + 40 fictional attendees. Run: `npm run seed`
// Idempotent: deletes the existing demo event (cascades) and re-creates it with the
// same fixed id, so NEXT_PUBLIC_DEMO_EVENT_ID never changes.
import { createClient } from "@supabase/supabase-js";
import { DEMO_GUESTS } from "./demo-guests.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const eventId = process.env.NEXT_PUBLIC_DEMO_EVENT_ID;
if (!url || !serviceKey || !eventId) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_DEMO_EVENT_ID");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Obviously fictional names only. 31 of these + 9 named P7 demo guests = 40.
const NAMES = [
  "Ada Placeholder", "Zed Placeholder", "Mona Mockingbird", "Rex Sandbox",
  "Pixel McDemo", "Juniper Fakename", "Otto Fixture", "Luna Lorem",
  "Ivy Ipsum", "Barnaby Stub", "Clara Configure", "Dexter Dummy",
  "Echo Example", "Felix Foobar", "Greta Gadget", "Hugo Hypothetical",
  "Iris Instance", "Jasper Json", "Kiki Keystroke", "Leo Localhost",
  "Maple Mockup", "Nico Nullable", "Olive Offline", "Percy Prototype",
  "Quinn Queryson", "Rosa Runtime", "Sly Sample", "Tess Testcase",
  "Umberto Undefined", "Vera Variable", "Wally Widget",
];

const TICKET_TYPES = ["General", "General", "General", "VIP", "Speaker"];

const { error: delErr } = await db.from("events").delete().eq("id", eventId);
if (delErr) throw delErr;

const startsAt = new Date();
startsAt.setHours(19, 0, 0, 0);
const { error: evErr } = await db.from("events").insert({
  id: eventId,
  name: "Smart Rollcall Demo Night",
  venue: "Example Hall, Fictional City",
  starts_at: startsAt.toISOString(),
});
if (evErr) throw evErr;

const email = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
const rows = [
  ...DEMO_GUESTS.map((g) => ({ event_id: eventId, ...g, email: email(g.name) })),
  ...NAMES.map((name, i) => ({
    event_id: eventId,
    name,
    email: email(name),
    ticket_type: TICKET_TYPES[i % TICKET_TYPES.length],
  })),
];
const { error: atErr } = await db.from("attendees").insert(rows);
if (atErr) throw atErr;

// Clear scans for this event so the dashboard starts at 0 rejected.
const { error: logErr } = await db.from("scan_log").delete().eq("event_id", eventId);
if (logErr) throw logErr;

const { count } = await db
  .from("attendees")
  .select("*", { count: "exact", head: true })
  .eq("event_id", eventId);
console.log(`Seeded event ${eventId} with ${count} attendees.`);
