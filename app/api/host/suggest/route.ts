import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHost } from "@/lib/host-auth";
import { DEMO_EVENT_ID } from "@/lib/issuer";
import { LlmError, type LlmErrorKind } from "@/lib/llm";
import { suggestChanges } from "@/lib/suggest/suggest";

// Let the 30s model timeout fire before Vercel cuts the function off.
export const maxDuration = 30;

const MAX_TOTAL_CHARS = 8000;

const bodySchema = z.object({
  sources: z
    .array(
      z.object({
        label: z.string().trim().max(100, "Labels must be at most 100 characters"),
        content: z.string().trim().min(1, "Every message needs some text"),
      }),
    )
    .min(1, "Paste at least one message")
    .max(10, "At most 10 messages"),
});

const NOTHING_CHANGED = "Nothing was changed.";
const ERRORS: Record<LlmErrorKind, { status: number; message: string }> = {
  rate_limited: { status: 429, message: `The model is rate-limited — wait a minute and try again. ${NOTHING_CHANGED}` },
  timeout: { status: 504, message: `Couldn't generate suggestions — the model took too long. ${NOTHING_CHANGED}` },
  bad_output: { status: 502, message: `Couldn't generate suggestions — the model's answer was unusable. ${NOTHING_CHANGED}` },
  unavailable: { status: 503, message: `Couldn't generate suggestions — the model is unavailable. ${NOTHING_CHANGED}` },
};

export async function POST(req: Request) {
  const denied = requireHost(req);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request" }, { status: 400 });
  }
  const sources = parsed.data.sources.map((s, i) => ({ label: s.label || `Message ${i + 1}`, content: s.content }));
  const total = sources.reduce((n, s) => n + s.content.length, 0);
  if (total > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: `Messages are too long (${total} characters, max ${MAX_TOTAL_CHARS}). Remove some text.` },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await suggestChanges(DEMO_EVENT_ID, sources));
  } catch (err) {
    if (err instanceof LlmError) {
      console.error(`suggest failed (${err.kind}):`, err.message);
      const { status, message } = ERRORS[err.kind];
      return NextResponse.json({ error: message, kind: err.kind }, { status });
    }
    console.error("suggest failed:", err);
    return NextResponse.json({ error: `Couldn't generate suggestions. ${NOTHING_CHANGED}` }, { status: 500 });
  }
}
