// Issuer public key (Ed25519, hex). Public by design — the scanner verifies passes with it.
// Env var wins if set; the committed value is the fallback so the scanner never lacks a key.
export const ISSUER_PUBLIC_KEY_HEX =
  process.env.NEXT_PUBLIC_ISSUER_PUBLIC_KEY_HEX ??
  "49f89bef0514b5e700e7bcf927a08493f23d3d86027abc49811337a21787dced";

export const DEMO_EVENT_ID =
  process.env.NEXT_PUBLIC_DEMO_EVENT_ID ?? "25225fe2-cd3c-4356-a2e3-f5d8953cf9eb";
