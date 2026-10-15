import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import { DEMO_EVENT_ID } from "@/lib/issuer";
import type { Attendee } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PassesPage() {
  const { data, error } = await supabaseAdmin()
    .from("attendees")
    .select("*")
    .eq("event_id", DEMO_EVENT_ID)
    .order("name");
  if (error) throw error;
  const attendees = data as Attendee[];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Passes</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Home
        </Link>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        {attendees.length} attendees. Click one to show its signed pass.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {attendees.map((a) => (
          <li key={a.id}>
            <Link
              href={`/passes/${a.id}`}
              className="block rounded-lg border border-neutral-200 p-4 hover:border-neutral-900"
            >
              <div className="font-medium">{a.name}</div>
              <div className="text-sm text-neutral-500">
                {a.ticket_type}
                {a.revoked_at && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Revoked
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
