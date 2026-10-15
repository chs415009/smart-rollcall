import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host-auth";
import { applyChanges, MAX_OPS, type Change } from "@/lib/changes";
import { DEMO_EVENT_ID } from "@/lib/issuer";

export async function POST(req: Request) {
  const denied = requireHost(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const changes: unknown = body?.changes;
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: "Body must be { changes: [...] } with at least one change" }, { status: 400 });
  }
  if (changes.length > MAX_OPS) {
    return NextResponse.json({ error: `At most ${MAX_OPS} changes per request` }, { status: 400 });
  }

  // applyChanges re-validates every op; the cast only satisfies the signature.
  const results = await applyChanges(DEMO_EVENT_ID, changes as Change[]);
  return NextResponse.json({ results });
}
