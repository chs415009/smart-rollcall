// Generates an Ed25519 issuer keypair. Run once: `npm run keygen`
// Paste the private key into .env.local only. The public key is safe to commit.
import * as ed from "@noble/ed25519";

const { secretKey, publicKey } = await ed.keygenAsync();
console.log(`ISSUER_PRIVATE_KEY_HEX=${ed.etc.bytesToHex(secretKey)}`);
console.log(`NEXT_PUBLIC_ISSUER_PUBLIC_KEY_HEX=${ed.etc.bytesToHex(publicKey)}`);
