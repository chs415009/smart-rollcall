// Server-side checks on raw model output. Every provider is held to these; the model is
// never trusted. Pure function — no DB, no network — so check:suggest can run it directly.
import { LlmError } from "../llm/types"; // the interface file only — keeps this module provider-free
import type { Proposal, ProposalFlag, SuggestSource } from "../types";
import { outputSchema, proposalSchema } from "./schema";

export const MAX_PROPOSALS = 30;
const MAX_NAME = 100;
const MAX_NOTE = 300;
const MAX_QUOTE = 200;

export type ActiveGuest = {
  id: string;
  name: string;
  ticketType: string | null;
  note: string | null;
  checkedInAt: string | null;
};

export type ValidationResult = { proposals: Proposal[]; discarded: number; truncated: boolean };

export function validateOutput(raw: unknown, sources: SuggestSource[], guests: ActiveGuest[]): ValidationResult {
  const top = outputSchema.safeParse(raw);
  if (!top.success) throw new LlmError("bad_output", "Model output did not match the expected shape");

  const byId = new Map(guests.map((g) => [g.id, g]));
  const truncated = top.data.proposals.length > MAX_PROPOSALS;
  let discarded = 0;
  const proposals: Proposal[] = [];

  top.data.proposals.slice(0, MAX_PROPOSALS).forEach((item, i) => {
    const parsed = proposalSchema.safeParse(item);
    if (!parsed.success) return void discarded++;
    const p = parsed.data;

    let sourceLabel: string | undefined;
    if (p.source_index !== undefined) {
      const source = sources[p.source_index];
      if (!source) return void discarded++; // points at a message that doesn't exist
      sourceLabel = source.label;
    }
    const base = { key: String(i), sourceLabel, quote: p.quote?.trim().slice(0, MAX_QUOTE) || undefined, flags: [] };
    const unclear = (question: string, name?: string): Proposal => ({ ...base, op: "UNCLEAR", question, name });
    const note = p.note?.trim();
    if (note && note.length > MAX_NOTE) return void discarded++;

    switch (p.op) {
      case "ADD": {
        const name = p.name?.trim() ?? "";
        if (!name || name.length > MAX_NAME) {
          proposals.push(unclear("The message seems to add someone, but no usable name was given. Who is it?"));
        } else {
          proposals.push({ ...base, op: "ADD", name, note: note || undefined });
        }
        return;
      }
      case "REMOVE":
      case "UPDATE_NOTE": {
        if (p.op === "UPDATE_NOTE" && note === undefined) return void discarded++;
        const guest = p.target_id ? byId.get(p.target_id) : undefined;
        if (!guest) {
          proposals.push(unclear("Couldn't match this to a guest on the list"));
          return;
        }
        proposals.push({ ...base, op: p.op, target: guest, note: p.op === "UPDATE_NOTE" ? note : undefined });
        return;
      }
      case "UNCLEAR":
        proposals.push(
          unclear(p.question?.trim() || "The model wasn't sure what this message asks for.", p.name?.trim() || undefined),
        );
        return;
    }
  });

  addFlags(proposals, guests);
  return { proposals, discarded, truncated };
}

// Flags are computed here, never taken from the model.
function addFlags(proposals: Proposal[], guests: ActiveGuest[]) {
  const activeNames = new Set(guests.map((g) => g.name.toLowerCase()));
  const targetCount = new Map<string, number>();
  for (const p of proposals) {
    if (p.target) targetCount.set(p.target.id, (targetCount.get(p.target.id) ?? 0) + 1);
  }
  for (const p of proposals) {
    const flags: ProposalFlag[] = [];
    if (p.op === "REMOVE" && p.target?.checkedInAt) flags.push("ALREADY_CHECKED_IN");
    if (p.op === "ADD" && p.name && activeNames.has(p.name.toLowerCase())) flags.push("NAME_EXISTS");
    if (p.target && (targetCount.get(p.target.id) ?? 0) > 1) flags.push("SAME_TARGET_TWICE");
    p.flags = flags;
  }
}
