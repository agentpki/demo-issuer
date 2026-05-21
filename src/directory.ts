// Builds the issuer directory document served at
//   /.well-known/agentpki-issuer.json
// per spec §6.2.

import type { IssuerDirectory } from '@agentpki/sdk';
import { DEMO_KEY_ID, DEMO_PUBLIC_KEY_SPKI } from './keys.js';

const VALID_FROM = 1714521600; // 2024-05-01 UTC
const VALID_TO   = 1893456000; // 2030-01-01 UTC (long-lived for demo)

export function buildIssuerDirectory(issuer: string, name: string): IssuerDirectory {
  return {
    v: 1,
    issuer,
    name,
    tier: 1,
    current_keys: [
      {
        kid: DEMO_KEY_ID,
        alg: 'Ed25519',
        pubkey: DEMO_PUBLIC_KEY_SPKI,
        valid_from: VALID_FROM,
        valid_to: VALID_TO,
      },
    ],
    crl_url: `https://${issuer}/.well-known/agentpki-crl.json`,
    abuse_report_url: `https://${issuer}/abuse`,
    contact: {
      abuse: 'mailto:abuse@agentpki.dev',
      security: 'mailto:security@agentpki.dev',
    },
  };
}
