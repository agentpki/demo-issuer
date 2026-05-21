// ⚠️  DEMO KEYPAIR — DO NOT USE IN PRODUCTION ⚠️
//
// Generated: 2026-05-21T18:29:53.763Z
// Algorithm: Ed25519 (RFC 8032)
// Curve:     edwards25519
//
// This file is checked into source. Anyone with the repository can mint
// passports signed by this key. That is acceptable ONLY because the
// demo issuer is explicitly non-production. Production issuers MUST
// keep private key material in an HSM / KMS / TEE per spec §5.3.
//
// To regenerate, run from agentpki/sdk-typescript:
//   pnpm tsx examples/gen-demo-key.ts

export const DEMO_KEY_ID = 'demo-2026-q2';

export const DEMO_PRIVATE_KEY_HEX = '1847f748ce9b6f11a81d577f396c1bc172faaa6a00d05df800b5e0df0856e4ac';
export const DEMO_PUBLIC_KEY_HEX  = '228121d3024cd14369fa9ec07f174d8a68ffaf063856b6dbe2abed64ac030757';
export const DEMO_PUBLIC_KEY_SPKI = 'MCowBQYDK2VwAyEAIoEh0wJM0UNp+p7AfxdNimj/rwY4Vrbb4qvtZKwDB1c=';

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return out;
}

export const DEMO_PRIVATE_KEY = hexToBytes(DEMO_PRIVATE_KEY_HEX);
