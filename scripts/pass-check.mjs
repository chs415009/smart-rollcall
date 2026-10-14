// Sanity checks for lib/pass.ts. Run: `npm run check:pass`
import assert from "node:assert/strict";
import * as ed from "@noble/ed25519";
import { signPass, verifyPass, base64urlEncode, base64urlDecode } from "../lib/pass.ts";

const { secretKey, publicKey } = await ed.keygenAsync();
const sk = ed.etc.bytesToHex(secretKey);
const pk = ed.etc.bytesToHex(publicKey);
const payload = { v: 1, eid: "e-1", aid: "a-1", n: "Zoë Testcase", iat: 1760000000 };

// 1. Round trip
const pass = await signPass(payload, sk);
const ok = await verifyPass(pass, pk);
assert.equal(ok.ok, true);
assert.deepEqual(ok.payload, payload);

// 2. Tampered name, original signature kept -> BAD_SIGNATURE
const [, sig] = pass.split(".");
const forgedBody = base64urlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, n: "Mallory" })));
assert.deepEqual(await verifyPass(`${forgedBody}.${sig}`, pk), { ok: false, reason: "BAD_SIGNATURE" });

// 3. Signed by a different key -> BAD_SIGNATURE
const other = await ed.keygenAsync();
assert.deepEqual(await verifyPass(pass, ed.etc.bytesToHex(other.publicKey)), { ok: false, reason: "BAD_SIGNATURE" });

// 4. Garbage -> MALFORMED, never throws
for (const junk of ["", "hello", "a.b.c", "!!!.???", "https://example.com"]) {
  assert.equal((await verifyPass(junk, pk)).ok, false, junk);
}

// 5. base64url has no +, /, = and round-trips
const bytes = new Uint8Array(256).map((_, i) => i);
assert.match(base64urlEncode(bytes), /^[A-Za-z0-9_-]+$/);
assert.deepEqual(base64urlDecode(base64urlEncode(bytes)), bytes);

console.log("pass checks OK");
