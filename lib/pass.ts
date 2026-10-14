// Pass = <base64url(payload_json)>.<base64url(signature)>
// Ed25519 over the exact UTF-8 bytes of payload_json. Isomorphic: no secrets in this
// file — callers pass the private key in (server only) or use the public key (anywhere).
import * as ed from "@noble/ed25519";

export type PassPayload = {
  v: 1;
  eid: string; // event uuid
  aid: string; // attendee uuid
  n: string; // attendee name, shown offline by the scanner
  iat: number; // issued-at, unix seconds
};

export type VerifyResult =
  | { ok: true; payload: PassPayload }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" };

const utf8 = new TextEncoder();
const utf8Decode = new TextDecoder("utf-8", { fatal: true });

export function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function signPass(payload: PassPayload, privateKeyHex: string): Promise<string> {
  const bytes = utf8.encode(JSON.stringify(payload));
  const sig = await ed.signAsync(bytes, ed.etc.hexToBytes(privateKeyHex));
  return `${base64urlEncode(bytes)}.${base64urlEncode(sig)}`;
}

function isPayload(p: unknown): p is PassPayload {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.eid === "string" &&
    typeof o.aid === "string" &&
    typeof o.n === "string" &&
    typeof o.iat === "number"
  );
}

// Never throws: anything that isn't a well-formed, correctly signed pass is rejected.
export async function verifyPass(pass: string, publicKeyHex: string): Promise<VerifyResult> {
  const parts = pass.trim().split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED" };

  let payloadBytes: Uint8Array, sig: Uint8Array;
  try {
    payloadBytes = base64urlDecode(parts[0]);
    sig = base64urlDecode(parts[1]);
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (sig.length !== 64) return { ok: false, reason: "MALFORMED" };

  // Check the signature over the raw bytes before trusting anything inside them.
  let valid = false;
  try {
    valid = await ed.verifyAsync(sig, payloadBytes, ed.etc.hexToBytes(publicKeyHex));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "BAD_SIGNATURE" };

  try {
    const payload: unknown = JSON.parse(utf8Decode.decode(payloadBytes));
    if (!isPayload(payload)) return { ok: false, reason: "MALFORMED" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
}
