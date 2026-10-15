// Server only. Orchestrates: guest list → prompt → provider → validate → enriched proposals.
// Read-only: nothing here writes to the database. Applying goes through lib/changes.ts.
import { getLlmProvider, LlmError } from "../llm";
import { supabaseAdmin } from "../supabase-server";
import type { SuggestResponse, SuggestSource } from "../types";
import { buildUserContent, SYSTEM_PROMPT } from "./prompt";
import { outputJsonSchema } from "./schema";
import { validateOutput, type ActiveGuest } from "./validate";

export const SUGGEST_TIMEOUT_MS = 30_000;

export async function suggestChanges(eventId: string, sources: SuggestSource[]): Promise<SuggestResponse> {
  const guests = await activeGuests(eventId);
  const provider = getLlmProvider();
  const raw = await withTimeout(
    provider.generateStructured({
      system: SYSTEM_PROMPT,
      user: buildUserContent(
        sources,
        guests.map((g) => ({ ...g, checkedIn: g.checkedInAt !== null })),
      ),
      jsonSchema: outputJsonSchema,
      timeoutMs: SUGGEST_TIMEOUT_MS,
    }),
    SUGGEST_TIMEOUT_MS,
  );
  return { provider: provider.name, ...validateOutput(raw, sources, guests) };
}

async function activeGuests(eventId: string): Promise<ActiveGuest[]> {
  const db = supabaseAdmin();
  const [attendees, checkins] = await Promise.all([
    db
      .from("attendees")
      .select("id, name, ticket_type, note")
      .eq("event_id", eventId)
      .is("revoked_at", null)
      .order("name"),
    db.from("checkins").select("attendee_id, checked_in_at").eq("event_id", eventId),
  ]);
  const err = attendees.error ?? checkins.error;
  if (err) throw err;
  const checkedInAt = new Map((checkins.data ?? []).map((c) => [c.attendee_id, c.checked_in_at]));
  return (attendees.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    ticketType: a.ticket_type,
    note: a.note,
    checkedInAt: checkedInAt.get(a.id) ?? null,
  }));
}

// Backstop in case an adapter ignores timeoutMs.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LlmError("timeout", `No response within ${ms / 1000}s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
