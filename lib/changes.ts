// Server only. The single execution path for guest list changes: manual actions and
// applied LLM suggestions both end up here via POST /api/host/apply.
import { z } from "zod";
import { supabaseAdmin } from "./supabase-server";
import type { ApplyResult } from "./types";

export type ChangeOp =
  | { op: "ADD"; name: string; note?: string }
  | { op: "REMOVE"; attendeeId: string }
  | { op: "UPDATE_NOTE"; attendeeId: string; note: string };

export type ChangeMeta = { via: "manual" | "llm"; sourceLabel?: string; sourceQuote?: string };

export type Change = ChangeOp & ChangeMeta;

export const MAX_OPS = 30;
const MAX_NAME = 100;
const MAX_NOTE = 300;

// Callers pass JSON from the client, so the types above are not trusted at runtime.
// Each op is re-checked here; a bad op is rejected on its own, the rest still apply.
const meta = {
  via: z.enum(["manual", "llm"]),
  sourceLabel: z.string().max(200).optional(),
  sourceQuote: z.string().max(500).optional(),
};
const note = z.string().trim().max(MAX_NOTE, `Note must be at most ${MAX_NOTE} characters`);
const changeSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("ADD"),
    name: z.string().trim().min(1, "Name is required").max(MAX_NAME, `Name must be at most ${MAX_NAME} characters`),
    note: note.optional(),
    ...meta,
  }),
  z.object({ op: z.literal("REMOVE"), attendeeId: z.uuid("Unknown guest"), ...meta }),
  z.object({ op: z.literal("UPDATE_NOTE"), attendeeId: z.uuid("Unknown guest"), note, ...meta }),
]);

export async function applyChanges(eventId: string, changes: Change[]): Promise<ApplyResult[]> {
  if (changes.length > MAX_OPS) throw new Error(`At most ${MAX_OPS} changes per request`);
  const results: ApplyResult[] = [];
  // In order: a later op sees the effects of earlier ones (e.g. REMOVE then UPDATE_NOTE → rejected).
  for (const raw of changes) {
    try {
      results.push(await applyOne(eventId, raw));
    } catch (err) {
      results.push({ status: "rejected", op: opName(raw), reason: `Database error: ${errMsg(err)}` });
    }
  }
  return results;
}

async function applyOne(eventId: string, raw: unknown): Promise<ApplyResult> {
  const parsed = changeSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "rejected", op: opName(raw), reason: parsed.error.issues[0]?.message ?? "Malformed change" };
  }
  const c = parsed.data;
  const db = supabaseAdmin();
  const audit = (attendeeId: string, detail: Record<string, unknown>) => ({
    event_id: eventId,
    attendee_id: attendeeId,
    op: c.op,
    detail,
    source_label: c.sourceLabel ?? null,
    source_quote: c.sourceQuote ?? null,
    via: c.via,
  });

  if (c.op === "ADD") {
    const noteValue = c.note || null;
    const { data, error } = await db
      .from("attendees")
      .insert({ event_id: eventId, name: c.name, note: noteValue, added_via: c.via })
      .select("id, name")
      .single();
    if (error) throw error;
    await writeAudit(audit(data.id, { name: data.name, note: noteValue }));
    return { status: "applied", op: "ADD", attendeeId: data.id, name: data.name, passUrl: `/passes/${data.id}` };
  }

  const { data: guest, error: findErr } = await db
    .from("attendees")
    .select("id, name, note, revoked_at")
    .eq("id", c.attendeeId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!guest) return { status: "rejected", op: c.op, reason: "Guest is not on this event's list" };
  if (guest.revoked_at) return { status: "rejected", op: c.op, reason: `${guest.name} is already revoked` };

  if (c.op === "REMOVE") {
    // Never deletes: the pass stays cryptographically valid and check-in refuses it.
    // The revoked_at guard makes a concurrent double-revoke a no-op instead of a second write.
    const { data, error } = await db
      .from("attendees")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", guest.id)
      .is("revoked_at", null)
      .select("id");
    if (error) throw error;
    if (!data.length) return { status: "rejected", op: c.op, reason: `${guest.name} is already revoked` };
    await writeAudit(audit(guest.id, { name: guest.name }));
    return { status: "applied", op: "REMOVE", attendeeId: guest.id, name: guest.name };
  }

  const noteValue = c.note || null;
  const { error } = await db.from("attendees").update({ note: noteValue }).eq("id", guest.id);
  if (error) throw error;
  await writeAudit(audit(guest.id, { name: guest.name, note: noteValue, previous_note: guest.note }));
  return { status: "applied", op: "UPDATE_NOTE", attendeeId: guest.id, name: guest.name };
}

// The change itself already happened; a failed audit row must not report it as rejected.
async function writeAudit(row: Record<string, unknown>) {
  const { error } = await supabaseAdmin().from("guest_changes").insert(row);
  if (error) console.error("guest_changes insert failed", error.message, row);
}

function opName(raw: unknown): string {
  const op = (raw as { op?: unknown } | null)?.op;
  return typeof op === "string" ? op.slice(0, 20) : "UNKNOWN";
}

function errMsg(err: unknown): string {
  return (err as { message?: string })?.message ?? String(err);
}
