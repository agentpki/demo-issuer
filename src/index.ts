// AgentPKI Demo Issuer — Cloudflare Worker.
//
// Hosts a discoverable issuer directory document and a public, no-auth /mint
// endpoint that returns a freshly-signed passport. Designed for maximum
// passive UX: anyone with the URL can curl /mint and feed the token to the
// verifier with zero setup.
//
// DO NOT USE IN PRODUCTION — keypair is hardcoded in src/keys.ts. Real
// issuers use HSM/KMS-resident keys and gate /mint behind auth.

import { signPassport, util } from '@agentpki/sdk';
import { buildIssuerDirectory } from './directory.js';
import { DEMO_KEY_ID, DEMO_PRIVATE_KEY, DEMO_REVOKED_KEY_ID } from './keys.js';

export interface Env {
  SPEC_URL: string;
  ISSUER_NAME: string;
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

const VERIFIER_URL = 'https://verify.agentpki.dev';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const issuer = url.host;

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ─── Issuer directory (spec §6.2)
    if (req.method === 'GET' && url.pathname === '/.well-known/agentpki-issuer.json') {
      return json(buildIssuerDirectory(issuer, env.ISSUER_NAME), 200, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      });
    }

    // ─── CRL (empty for demo) (spec §10.1)
    if (req.method === 'GET' && url.pathname === '/.well-known/agentpki-crl.json') {
      const now = Math.floor(Date.now() / 1000);
      return json({
        v: 1,
        issuer,
        generated_at: now,
        next_update: now + 3600,
        revoked: [],
      });
    }

    // ─── Mint a passport (public, no-auth — DEMO ONLY)
    //   GET /mint?sub=agent:foo&scope=read:articles,read:public&lifetime=600
    //   POST /mint   (same fields in a JSON body)
    if (url.pathname === '/mint' && (req.method === 'GET' || req.method === 'POST')) {
      return handleMint(req, url, issuer);
    }

    // ─── Service info / health
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({
        service: 'agentpki-demo-issuer',
        version: '0.1.0-alpha.1',
        issuer,
        name: env.ISSUER_NAME,
        tier: 1,
        warning: 'DEMO ISSUER — hardcoded keypair, public unauthenticated /mint. Do NOT use in production.',
        endpoints: {
          directory: 'GET /.well-known/agentpki-issuer.json',
          crl:       'GET /.well-known/agentpki-crl.json',
          mint_get:  'GET /mint?sub=<agentId>&scope=<comma,list>&lifetime=<seconds>',
          mint_post: 'POST /mint  (JSON body with same fields)',
        },
        verifier: VERIFIER_URL,
        spec: env.SPEC_URL,
      });
    }

    return json({ error: 'not_found', detail: `${req.method} ${url.pathname}` }, 404);
  },
} satisfies ExportedHandler<Env>;

async function handleMint(req: Request, url: URL, issuer: string): Promise<Response> {
  let params: Record<string, unknown>;
  if (req.method === 'GET') {
    params = Object.fromEntries(url.searchParams) as Record<string, unknown>;
  } else {
    try {
      params = (await req.json()) as Record<string, unknown>;
    } catch (e) {
      return json(
        { error: 'malformed_json', detail: e instanceof Error ? e.message : String(e) },
        400,
      );
    }
  }

  const sub =
    typeof params['sub'] === 'string' && (params['sub'] as string).length > 0
      ? (params['sub'] as string)
      : `agent:${issuer}/demo-bot`;

  const scopeIn = params['scope'];
  let scope: string[];
  if (Array.isArray(scopeIn)) {
    scope = scopeIn.filter((s): s is string => typeof s === 'string');
  } else if (typeof scopeIn === 'string') {
    scope = scopeIn
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    scope = ['read:articles', 'read:public-data'];
  }

  const lifetimeIn = Number(params['lifetime']);
  const lifetime = Number.isFinite(lifetimeIn) && lifetimeIn > 0
    ? Math.min(86400, Math.max(60, Math.floor(lifetimeIn)))
    : 3600;

  const now = Math.floor(Date.now() / 1000);
  const jti = util.randomHex(16);

  // ─── Demo flag: mint with the revoked-rotated kid.
  // Signature is still mathematically valid (we use the same private key),
  // but the kid is listed in the directory's `revoked_keys` so the
  // verifier returns failure_reason "revoked_key". This demonstrates the
  // CRL/key-rotation story without requiring a separate revoked private
  // key (no need for additional secret material).
  const isRevoked =
    params['revoked'] === '1' ||
    params['revoked'] === 1 ||
    params['revoked'] === true;
  const kidToUse = isRevoked ? DEMO_REVOKED_KEY_ID : DEMO_KEY_ID;

  const token = signPassport(
    {
      v: 1,
      iss: issuer,
      sub,
      iat: now,
      exp: now + lifetime,
      jti,
      tier: 1,
      scope,
    },
    { privateKey: DEMO_PRIVATE_KEY, kid: kidToUse },
  );

  return json(
    {
      token,
      passport: {
        iss: issuer,
        sub,
        iat: now,
        exp: now + lifetime,
        jti,
        tier: 1,
        scope,
        kid: kidToUse,
      },
      expires_in: lifetime,
      revoked_kid: isRevoked ? true : undefined,
      try_verify: `curl -s ${VERIFIER_URL}/v1/verify -X POST -H 'content-type: application/json' -d '${JSON.stringify({ token })}'`,
    },
    200,
    { 'Cache-Control': 'no-store' },
  );
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
      ...extra,
    },
  });
}
