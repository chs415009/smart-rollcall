"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChangeOp } from "@/lib/changes"; // type only — erased, no server code in the bundle
import { TICKET_TYPES, type ApplyResult, type HostGuest, type TicketType } from "@/lib/types";

export type GuestDraft = { name: string; note: string; ticketType: TicketType };
export const EMPTY_DRAFT: GuestDraft = { name: "", note: "", ticketType: TICKET_TYPES[0] };

// Panel B's "Add as new guest" focuses this input after prefilling the draft.
export const ADD_NAME_INPUT_ID = "add-guest-name";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function GuestPanel({
  guests,
  draft,
  setDraft,
  apply,
}: {
  guests: HostGuest[];
  draft: GuestDraft;
  setDraft: (d: GuestDraft) => void;
  apply: (change: ChangeOp) => Promise<ApplyResult | undefined>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; passUrl?: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);

  async function run(change: ChangeOp, onApplied?: () => void) {
    setBusy(true);
    try {
      const r = await apply(change);
      if (r?.status === "applied") {
        onApplied?.();
        const verb = { ADD: "Added", REMOVE: "Revoked", UPDATE_NOTE: "Updated note for" }[r.op];
        setMessage({ ok: true, text: `${verb} ${r.name}`, passUrl: r.passUrl });
      } else {
        setMessage({ ok: false, text: `Not applied: ${r?.reason ?? "no result"}` });
      }
    } catch (err) {
      setMessage({ ok: false, text: `Not applied: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  function revoke(g: HostGuest) {
    const warning = g.checkedInAt
      ? `${g.name} ALREADY CHECKED IN at ${timeOf(g.checkedInAt)}.\n\nRevoke their invitation anyway?`
      : `Revoke ${g.name}'s invitation? Their pass will be refused at the door.`;
    if (window.confirm(warning)) void run({ op: "REMOVE", attendeeId: g.id });
  }

  // Active guests alphabetically, revoked last.
  const rows = [...guests].sort(
    (a, b) => Number(!!a.revokedAt) - Number(!!b.revokedAt) || a.name.localeCompare(b.name),
  );
  const active = guests.filter((g) => !g.revokedAt).length;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Guest list</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run({ op: "ADD", name: draft.name, note: draft.note, ticketType: draft.ticketType }, () =>
            setDraft(EMPTY_DRAFT),
          );
        }}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 p-4"
      >
        <label className="flex min-w-48 flex-1 flex-col text-sm text-neutral-500">
          Name
          <input
            id={ADD_NAME_INPUT_ID}
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mt-1 rounded border border-neutral-300 px-3 py-2 text-base text-neutral-900"
          />
        </label>
        <label className="flex flex-col text-sm text-neutral-500">
          Ticket
          <select
            value={draft.ticketType}
            onChange={(e) => setDraft({ ...draft, ticketType: e.target.value as TicketType })}
            className="mt-1 rounded border border-neutral-300 px-2 py-2 text-base text-neutral-900"
          >
            {TICKET_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-[2] flex-col text-sm text-neutral-500">
          Note (optional)
          <input
            maxLength={300}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="mt-1 rounded border border-neutral-300 px-3 py-2 text-base text-neutral-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !draft.name.trim()}
          className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Add guest
        </button>
      </form>

      {message && (
        <p
          role="status"
          className={`mb-4 rounded px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}
        >
          {message.text}
          {message.passUrl && (
            <Link href={message.passUrl} className="ml-2 font-medium underline">
              Open pass
            </Link>
          )}
        </p>
      )}

      <h2 className="mb-2 text-sm font-medium text-neutral-500">
        {active} active guests · {guests.length - active} revoked
      </h2>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {rows.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <div className="min-w-48 flex-1">
              <span className={g.revokedAt ? "font-medium text-neutral-400 line-through" : "font-medium"}>
                {g.name}
              </span>
              <span className="ml-2 text-sm text-neutral-500">{g.ticketType}</span>
              {editing?.id === g.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run({ op: "UPDATE_NOTE", attendeeId: g.id, note: editing.note }, () => setEditing(null));
                  }}
                  className="mt-1 flex gap-2"
                >
                  <input
                    autoFocus
                    maxLength={300}
                    value={editing.note}
                    onChange={(e) => setEditing({ id: g.id, note: e.target.value })}
                    className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button type="submit" disabled={busy} className="text-sm font-medium disabled:opacity-40">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-sm text-neutral-500">
                    Cancel
                  </button>
                </form>
              ) : (
                g.note && <div className="text-sm text-neutral-600">{g.note}</div>
              )}
            </div>
            <Status guest={g} />
            {!g.revokedAt && editing?.id !== g.id && (
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing({ id: g.id, note: g.note ?? "" })}
                  className="text-neutral-700 hover:underline disabled:opacity-40"
                >
                  Edit note
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(g)}
                  className="text-red-700 hover:underline disabled:opacity-40"
                >
                  Revoke
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Status({ guest: g }: { guest: HostGuest }) {
  if (g.revokedAt) {
    return (
      <span className="text-sm text-neutral-500">
        {g.checkedInAt && <>Checked in {timeOf(g.checkedInAt)} · </>}
        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Revoked</span>
      </span>
    );
  }
  if (g.checkedInAt) {
    return (
      <span className="text-sm">
        <span className="text-green-600">✓</span> Checked in {timeOf(g.checkedInAt)}
      </span>
    );
  }
  return <span className="text-sm text-neutral-400">○ Expected</span>;
}
