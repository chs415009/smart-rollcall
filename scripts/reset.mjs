// Clears check-ins and the scan log for the demo event, keeping attendees (and their
// pass QRs) unchanged. Run before every rehearsal/recording: `npm run reset`
import { createClient } from "@supabase/supabase-js";

const eventId = process.env.NEXT_PUBLIC_DEMO_EVENT_ID;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const table of ["checkins", "scan_log"]) {
  const { error } = await db.from(table).delete().eq("event_id", eventId);
  if (error) throw error;
}
console.log(`Reset check-ins and scan log for event ${eventId}.`);
