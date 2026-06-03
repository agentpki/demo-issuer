// Builds the issuer directory document served at
//   /.well-known/agentpki-issuer.json
// per spec §6.2.

import type { IssuerDirectory } from '@agentpki/sdk';
import {
  DEMO_KEY_ID,
  DEMO_PUBLIC_KEY_SPKI,
  DEMO_REVOKED_KEY_ID,
} from './keys.js';

const VALID_FROM = 1714521600; // 2024-05-01 UTC
const VALID_TO   = 1893456000; // 2030-01-01 UTC (long-lived for demo)

// 2026-05-28 — the date our demo "revoked" kid was rotated out.
// Chosen to be recent so the story reads as "we rotated last week" not
// "ancient artifact."
const REVOKED_AT = 1748390400;

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
    // Demo: a previously-active kid that has since been rotated out.
    // Tokens signed by this kid will be rejected by verifiers with
    // failure_reason "revoked_key" — even though the underlying Ed25519
    // signature is mathematically valid. Demonstrates the CRL/rotation
    // story for /demo.
    revoked_keys: [
      {
        kid: DEMO_REVOKED_KEY_ID,
        revoked_at: REVOKED_AT,
        reason: 'planned_rotation',
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
