import { NextResponse } from "next/server";
import { ISSUER_PUBLIC_KEY_HEX } from "@/lib/issuer";

// The scanner bundles this key so it can verify offline; this endpoint just exposes it.
export function GET() {
  return NextResponse.json({ publicKeyHex: ISSUER_PUBLIC_KEY_HEX });
}
