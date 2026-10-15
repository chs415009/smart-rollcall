// Server only. Shared host passcode for /api/host/* — not an account system, just one secret.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const PASSCODE_HEADER = "x-host-passcode";

// Returns a 401 response if the request lacks the right passcode, else null.
// Fails closed: with HOST_PASSCODE unset, every request is refused.
export function requireHost(req: Request): NextResponse | null {
  const expected = process.env.HOST_PASSCODE ?? "";
  const given = req.headers.get(PASSCODE_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const ok = expected.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  return ok ? null : NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
}
