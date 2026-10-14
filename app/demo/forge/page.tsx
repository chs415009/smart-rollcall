import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import { issuePassFor, issueUnlistedPass } from "@/lib/issue-pass";
import { base64urlDecode, base64urlEncode } from "@/lib/pass";
import { DEMO_EVENT_ID } from "@/lib/issuer";
import { qrSvg } from "@/lib/qr";
import type { Attendee } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_FORGED_NAME = "Mallory Forger";

// Take a real pass, rewrite the name, keep the original signature.
function tamper(pass: string, newName: string) {
  const [body, sig] = pass.split(".");
  const original = JSON.parse(new TextDecoder().decode(base64urlDecode(body)));
  const forged = { ...original, n: newName };
  const forgedBody = base64urlEncode(new TextEncoder().encode(JSON.stringify(forged)));
  return { original, forged, pass: `${forgedBody}.${sig}` };
}

export default async function ForgePage({
  searchParams,
}: {
  searchParams: Promise<{ attendee?: string; name?: string }>;
}) {
  const params = await searchParams;
  const { data, error } = await supabaseAdmin()
    .from("attendees")
    .select("*")
    .eq("event_id", DEMO_EVENT_ID)
    .order("name");
  if (error) throw error;
  const attendees = data as Attendee[];
  const victim = attendees.find((a) => a.id === params.attendee) ?? attendees[0];
  const newName = params.name?.trim().slice(0, 60) || DEFAULT_FORGED_NAME;

  const t = tamper(await issuePassFor(victim), newName);
  const [forgedSvg, unlistedSvg] = await Promise.all([
    qrSvg(t.pass),
    issueUnlistedPass().then(qrSvg),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-amber-900">
        <strong>Demo tool.</strong> This page deliberately produces passes the scanner must reject.
        It exists only to demonstrate rejection on camera.
      </div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Forged & unlisted passes</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Home
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold">Tampered pass</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Expect: <span className="font-medium text-red-700">✕ Invalid pass — signature failed</span>
          </p>
          <form className="mb-4 flex flex-wrap gap-2 text-sm" action="/demo/forge">
            <select
              name="attendee"
              defaultValue={victim.id}
              className="rounded border border-neutral-300 px-2 py-1"
            >
              {attendees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              defaultValue={newName}
              className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1"
              aria-label="Forged name"
            />
            <button className="rounded bg-neutral-900 px-3 py-1 text-white">Forge</button>
          </form>
          <div className="bg-white [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: forgedSvg }} />
          <dl className="mt-3 space-y-1 font-mono text-xs">
            <div>
              <dt className="inline text-neutral-500">signed name: </dt>
              <dd className="inline">{t.original.n}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-500">forged name: </dt>
              <dd className="inline text-red-700">{t.forged.n}</dd>
            </div>
            <div className="text-neutral-500">signature: unchanged from the real pass</div>
          </dl>
        </section>

        <section className="rounded-lg border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold">Genuine signature, not on the list</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Expect: <span className="font-medium text-red-700">✕ Not on the guest list</span>
          </p>
          <p className="mb-4 text-sm text-neutral-500">
            Correctly signed by the issuer for &ldquo;Uninvited Guest&rdquo;, whose attendee id
            does not exist for this event. The math passes; the guest list does not.
          </p>
          <div className="bg-white [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: unlistedSvg }} />
        </section>
      </div>
    </main>
  );
}
