"use client";

import Link from "next/link";
import { useState } from "react";
import type { ApplyResult, Proposal, SuggestResponse, SuggestSource } from "@/lib/types";

const MAX_SOURCES = 10;
const MAX_TOTAL_CHARS = 8000;

const DEMO_MESSAGES: SuggestSource[] = [
  {
    label: "Hale Capital office",
    content:
      "Hi, so sorry for the late notice. Richard won't be able to make it on Saturday. He'd like his chief of staff, Lena Moritz, to attend in his place. Lena is vegetarian.",
  },
  {
    label: "Mei Chen (text)",
    content: "hi!! is it still ok if we bring my sister Anna? also Daniel is gluten free now, forgot to mention",
  },
  {
    label: "Planner notes",
    content:
      "Priya confirmed, all good. Drop James Whitfield, his firm pulled out of the sponsorship. Tom needs a seat near the stage, bad knee. Chris can't come anymore.",
  },
];

const OP_LABEL: Record<Proposal["op"], string> = {
  ADD: "Add guest",
  REMOVE: "Revoke invitation",
  UPDATE_NOTE: "Update note",
  UNCLEAR: "Needs your decision",
};
const OP_BORDER: Record<Proposal["op"], string> = {
  ADD: "border-l-green-600",
  REMOVE: "border-l-red-600",
  UPDATE_NOTE: "border-l-blue-600",
  UNCLEAR: "border-l-amber-500",
};
const OP_TEXT: Record<Proposal["op"], string> = {
  ADD: "text-green-700",
  REMOVE: "text-red-700",
  UPDATE_NOTE: "text-blue-700",
  UNCLEAR: "text-amber-700",
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

type Selection = { ticked: boolean; revokeAnyway: boolean };

// A REMOVE of someone already checked in needs its own explicit confirmation.
const needsSecondCheck = (p: Proposal) => p.flags.includes("ALREADY_CHECKED_IN");
const isSelected = (p: Proposal, s?: Selection) =>
  p.op !== "UNCLEAR" && !!s?.ticked && (!needsSecondCheck(p) || s.revokeAnyway);

export function SuggestPanel({
  activeGuests,
  suggest,
  apply,
  onAddAsNew,
}: {
  activeGuests: number;
  suggest: (sources: SuggestSource[]) => Promise<SuggestResponse>;
  apply: (changes: unknown[]) => Promise<ApplyResult[]>;
  onAddAsNew: (name: string) => void;
}) {
  const [sources, setSources] = useState<SuggestSource[]>([{ label: "", content: "" }]);
  const [phase, setPhase] = useState<"idle" | "suggesting" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SuggestResponse | null>(null);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirmMass, setConfirmMass] = useState(false);
  const [applied, setApplied] = useState<ApplyResult[] | null>(null);

  const totalChars = sources.reduce((n, s) => n + s.content.length, 0);
  const filled = sources.filter((s) => s.content.trim());
  const busy = phase !== "idle";

  const setSource = (i: number, patch: Partial<SuggestSource>) =>
    setSources(sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function runSuggest() {
    setPhase("suggesting");
    setError(null);
    setResponse(null);
    setApplied(null);
    setConfirmMass(false);
    try {
      const res = await suggest(filled.map((s) => ({ label: s.label.trim(), content: s.content })));
      setResponse(res);
      setDismissed(new Set());
      // Clean cards start ticked; flagged cards start unticked; UNCLEAR can't be ticked.
      setSelection(
        Object.fromEntries(
          res.proposals.map((p) => [p.key, { ticked: p.op !== "UNCLEAR" && p.flags.length === 0, revokeAnyway: false }]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhase("idle");
    }
  }

  const visible = response?.proposals.filter((p) => !dismissed.has(p.key)) ?? [];
  const selected = visible.filter((p) => isSelected(p, selection[p.key]));
  const selectedRemoves = selected.filter((p) => p.op === "REMOVE").length;

  async function runApply() {
    if (selectedRemoves > activeGuests / 2 && !confirmMass) {
      setConfirmMass(true);
      return;
    }
    setConfirmMass(false);
    setPhase("applying");
    setError(null);
    try {
      const changes = selected.map((p) => {
        const meta = { via: "llm", sourceLabel: p.sourceLabel, sourceQuote: p.quote };
        if (p.op === "ADD") return { op: "ADD", name: p.name, note: p.note, ...meta };
        if (p.op === "REMOVE") return { op: "REMOVE", attendeeId: p.target!.id, ...meta };
        return { op: "UPDATE_NOTE", attendeeId: p.target!.id, note: p.note ?? "", ...meta };
      });
      setApplied(await apply(changes));
      setResponse(null);
    } catch (err) {
      setError(`Not applied: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPhase("idle");
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Paste messages</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSources(DEMO_MESSAGES)}
          className="text-sm text-neutral-600 hover:underline disabled:opacity-40"
        >
          Fill demo messages
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {sources.map((s, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex gap-2">
              <input
                placeholder="From (e.g. Hale Capital office)"
                maxLength={100}
                value={s.label}
                disabled={busy}
                onChange={(e) => setSource(i, { label: e.target.value })}
                className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-medium"
              />
              {sources.length > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSources(sources.filter((_, j) => j !== i))}
                  aria-label={`Remove message ${i + 1}`}
                  className="px-2 text-neutral-400 hover:text-neutral-900"
                >
                  ×
                </button>
              )}
            </div>
            <textarea
              rows={3}
              placeholder="Paste the message here"
              value={s.content}
              disabled={busy}
              onChange={(e) => setSource(i, { content: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || sources.length >= MAX_SOURCES}
          onClick={() => setSources([...sources, { label: "", content: "" }])}
          className="text-sm text-neutral-600 hover:underline disabled:opacity-40"
        >
          + Add another message
        </button>
        <span className={`text-xs ${totalChars > MAX_TOTAL_CHARS ? "text-red-600" : "text-neutral-400"}`}>
          {totalChars} / {MAX_TOTAL_CHARS} characters
        </span>
        <button
          type="button"
          disabled={busy || filled.length === 0 || totalChars > MAX_TOTAL_CHARS}
          onClick={runSuggest}
          className="ml-auto rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          {phase === "suggesting" ? "Reading messages…" : "Suggest changes"}
        </button>
      </div>

      {error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {response && (
        <div className="mt-6">
          {response.provider === "fixture" && (
            <p className="mb-3 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
              Canned fixture output (LLM_PROVIDER=fixture) — not a live model.
            </p>
          )}
          <p className="mb-3 text-sm text-neutral-500">
            {response.proposals.length} suggested changes — review, then apply. Nothing changes until you do.
            {response.discarded > 0 && ` ${response.discarded} malformed suggestion(s) discarded.`}
            {response.truncated && " Only the first 30 suggestions are shown."}
          </p>
          {visible.length === 0 && <p className="text-sm text-neutral-500">No changes found in these messages.</p>}
          <ul className="flex flex-col gap-2">
            {visible.map((p) => (
              <ProposalCard
                key={p.key}
                p={p}
                sel={selection[p.key]}
                disabled={busy}
                onChange={(s) => {
                  setSelection({ ...selection, [p.key]: s });
                  setConfirmMass(false);
                }}
                onDismiss={() => setDismissed(new Set(dismissed).add(p.key))}
                onAddAsNew={() => onAddAsNew(p.name ?? "")}
              />
            ))}
          </ul>

          {confirmMass && (
            <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              This revokes {selectedRemoves} of {activeGuests} active guests — more than half the list. Are you sure?
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={runApply} className="rounded bg-red-700 px-3 py-1 font-medium text-white">
                  Yes, apply
                </button>
                <button type="button" onClick={() => setConfirmMass(false)} className="text-red-800 hover:underline">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {visible.length > 0 && !confirmMass && (
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={runApply}
              className="mt-4 w-full rounded bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-40"
            >
              {phase === "applying" ? "Applying…" : `Apply ${selected.length} selected`}
            </button>
          )}
        </div>
      )}

      {applied && <ApplySummary results={applied} />}
    </section>
  );
}

function ProposalCard({
  p,
  sel,
  disabled,
  onChange,
  onDismiss,
  onAddAsNew,
}: {
  p: Proposal;
  sel: Selection | undefined;
  disabled: boolean;
  onChange: (s: Selection) => void;
  onDismiss: () => void;
  onAddAsNew: () => void;
}) {
  const s = sel ?? { ticked: false, revokeAnyway: false };
  const second = needsSecondCheck(p);
  return (
    <li className={`rounded-lg border border-l-4 border-neutral-200 bg-white p-3 ${OP_BORDER[p.op]}`}>
      <div className="flex gap-3">
        {p.op !== "UNCLEAR" && (
          <input
            type="checkbox"
            aria-label={`Select: ${OP_LABEL[p.op]}`}
            className="mt-1 h-5 w-5 shrink-0"
            checked={isSelected(p, s)}
            // The already-checked-in REMOVE is driven by its own "revoke anyway" box below.
            disabled={disabled || second}
            onChange={(e) => onChange({ ...s, ticked: e.target.checked })}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-semibold tracking-wide uppercase ${OP_TEXT[p.op]}`}>
            {OP_LABEL[p.op]}
          </div>
          <CardBody p={p} />
          {(p.sourceLabel || p.quote) && (
            <p className="mt-1 text-sm text-neutral-500">
              from {p.sourceLabel ?? "a message"}
              {p.quote && <span className="italic">: “{p.quote}”</span>}
            </p>
          )}
          {p.flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.flags.map((f) => (
                <span key={f} className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {f === "ALREADY_CHECKED_IN" && `Already checked in at ${timeOf(p.target!.checkedInAt!)}`}
                  {f === "NAME_EXISTS" && "A guest with this name already exists"}
                  {f === "SAME_TARGET_TWICE" && "Another suggestion also changes this guest"}
                </span>
              ))}
            </div>
          )}
          {second && (
            <label className="mt-2 flex items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={s.revokeAnyway}
                disabled={disabled}
                onChange={(e) => onChange({ ticked: e.target.checked, revokeAnyway: e.target.checked })}
              />
              They already checked in at {timeOf(p.target!.checkedInAt!)} — revoke anyway
            </label>
          )}
          {p.op === "UNCLEAR" && (
            <div className="mt-2 flex gap-3 text-sm">
              <button type="button" onClick={onAddAsNew} className="font-medium text-neutral-900 hover:underline">
                Add as new guest
              </button>
              <button type="button" onClick={onDismiss} className="text-neutral-500 hover:underline">
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function CardBody({ p }: { p: Proposal }) {
  if (p.op === "UNCLEAR") return <p className="mt-1 font-medium">{p.question}</p>;
  if (p.op === "ADD") {
    return (
      <p className="mt-1">
        <span className="font-semibold">{p.name}</span>
        {p.note && <span className="text-neutral-600"> — {p.note}</span>}
      </p>
    );
  }
  const t = p.target!;
  return (
    <div className="mt-1">
      <span className="font-semibold">{t.name}</span>
      <span className="ml-2 text-sm text-neutral-500">{t.ticketType}</span>
      {p.op === "REMOVE" && t.note && <div className="text-sm text-neutral-600">{t.note}</div>}
      {p.op === "UPDATE_NOTE" && (
        <div className="text-sm">
          <span className="text-neutral-400 line-through">{t.note || "(no note)"}</span>
          <span className="mx-1 text-neutral-400">→</span>
          <span className="text-neutral-900">{p.note || "(no note)"}</span>
        </div>
      )}
    </div>
  );
}

function ApplySummary({ results }: { results: ApplyResult[] }) {
  const ok = results.filter((r) => r.status === "applied");
  const rejected = results.filter((r) => r.status === "rejected");
  const group = (op: string) => ok.filter((r) => r.op === op);
  return (
    <div className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm" role="status">
      <h3 className="mb-2 font-semibold">
        Applied {ok.length} of {results.length} changes
      </h3>
      {group("ADD").length > 0 && (
        <p>
          Added:{" "}
          {group("ADD").map((r, i) => (
            <span key={r.attendeeId}>
              {i > 0 && ", "}
              {r.name}{" "}
              <Link href={r.passUrl!} className="underline">
                pass
              </Link>
            </span>
          ))}
        </p>
      )}
      {group("REMOVE").length > 0 && <p>Revoked: {group("REMOVE").map((r) => r.name).join(", ")}</p>}
      {group("UPDATE_NOTE").length > 0 && <p>Updated notes: {group("UPDATE_NOTE").map((r) => r.name).join(", ")}</p>}
      {rejected.length > 0 && (
        <div className="mt-2 text-red-700">
          Not applied:
          <ul className="ml-4 list-disc">
            {rejected.map((r, i) => (
              <li key={i}>
                {r.op}: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
