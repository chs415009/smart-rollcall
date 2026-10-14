import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase-server";
import { issuePassFor } from "@/lib/issue-pass";
import type { Attendee } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PassPage({
  params,
}: {
  params: Promise<{ attendeeId: string }>;
}) {
  const { attendeeId } = await params;
  if (!UUID.test(attendeeId)) notFound();

  const { data, error } = await supabaseAdmin()
    .from("attendees")
    .select("*")
    .eq("id", attendeeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const attendee = data as Attendee;

  const pass = await issuePassFor(attendee);
  // Low error correction = fewer, larger modules, which scan more reliably off a screen.
  const svg = await QRCode.toString(pass, { type: "svg", errorCorrectionLevel: "L", margin: 4 });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-black">
      <div
        className="w-full max-w-[min(80vh,520px)] [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <h1 className="mt-6 text-3xl font-semibold">{attendee.name}</h1>
      <p className="mt-1 text-lg text-neutral-600">{attendee.ticket_type}</p>
      <Link href="/passes" className="mt-8 text-sm text-neutral-500 hover:underline">
        All passes
      </Link>
    </main>
  );
}
