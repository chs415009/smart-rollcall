"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_EVENT_ID } from "@/lib/issuer";
import type { DashboardResponse } from "@/lib/types";

const POLL_MS = 2000;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [stale, setStale] = useState(false);

  // Chained timeouts, not setInterval: a slow response never stacks requests.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/dashboard?eventId=${DEMO_EVENT_ID}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next: DashboardResponse = await res.json();
        if (!stopped) {
          setData(next);
          setStale(false);
        }
      } catch {
        if (!stopped) setStale(true); // keep showing the last good numbers
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        {stale ? "Can't reach server — retrying…" : "Loading…"}
      </main>
    );
  }

  const rate = data.expected ? Math.round((data.checkedIn / data.expected) * 100) : 0;
  // Most recent check-ins first, then everyone still expected, alphabetically.
  const rows = [...data.attendees].sort((a, b) => {
    if (a.checkedInAt && b.checkedInAt) return b.checkedInAt.localeCompare(a.checkedInAt);
    if (a.checkedInAt) return -1;
    if (b.checkedInAt) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.event.name}</h1>
          {data.event.venue && <p className="text-sm text-neutral-500">{data.event.venue}</p>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={stale ? "text-red-600" : "text-neutral-500"}>
            {stale ? "● Reconnecting…" : "● Live"}
          </span>
          <Link href="/" className="text-neutral-500 hover:underline">
            Home
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Checked in">
          {data.checkedIn} <span className="text-neutral-400">/ {data.expected}</span>
        </Stat>
        <Stat label="Attendance rate">{rate}%</Stat>
        <Stat label="Rejected scans">{data.rejected}</Stat>
      </section>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={rate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Attendance rate"
      >
        <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${rate}%` }} />
      </div>

      <h2 className="mt-8 mb-2 text-sm font-medium text-neutral-500">Attendees</h2>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-4 py-2">
            <div>
              <span className="font-medium">{a.name}</span>
              <span className="ml-2 text-sm text-neutral-500">{a.ticketType}</span>
            </div>
            {a.checkedInAt ? (
              <span className="text-sm text-neutral-900">
                <span className="text-green-600">✓</span> Checked in {timeOf(a.checkedInAt)}
              </span>
            ) : (
              <span className="text-sm text-neutral-400">○ Expected</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-5xl font-semibold tabular-nums">{children}</div>
    </div>
  );
}
