import Link from "next/link";

const LINKS = [
  { href: "/scan", title: "Scanner", detail: "Check in attendees with the camera" },
  { href: "/dashboard", title: "Dashboard", detail: "Live attendance" },
  { href: "/passes", title: "Passes", detail: "Show an attendee's signed pass" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="mb-2 text-3xl font-semibold">Smart Rollcall</h1>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="block rounded-lg border border-neutral-200 p-6 hover:border-neutral-900"
        >
          <div className="text-2xl font-semibold">{l.title}</div>
          <div className="text-neutral-500">{l.detail}</div>
        </Link>
      ))}
      <Link href="/demo/forge" className="mt-2 text-center text-sm text-neutral-400 hover:underline">
        Demo tool: forged passes
      </Link>
      <Link href="/host" className="text-center text-sm text-neutral-400 hover:underline">
        Host: manage guest list
      </Link>
    </main>
  );
}
