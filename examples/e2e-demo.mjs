// End-to-end demo: mint a passport at the demo issuer, post it to the live
// verifier, assert the verdict is "allow".
//
// Pure Node ESM — no dependencies, no build step, no SDK install needed.
// Just Node 18+ (for global fetch).
//
// Run with:
//   node examples/e2e-demo.mjs
//
// Override URLs via env if you have custom domains attached:
//   DEMO_ISSUER_URL=https://demo.agentpki.dev \
//   VERIFIER_URL=https://verify.agentpki.dev \
//   node examples/e2e-demo.mjs

// Custom domains are required (not just *.workers.dev) because Cloudflare's
// same-account Worker-to-Worker fetch routing returns 404 for *.workers.dev
// cross-Worker calls. demo.agentpki.dev is attached to the demo-issuer
// Worker via wrangler.toml [[routes]] custom_domain entry.
const DEMO_ISSUER =
  process.env.DEMO_ISSUER_URL ??
  'https://demo.agentpki.dev';

const VERIFIER =
  process.env.VERIFIER_URL ??
  'https://verify.agentpki.dev';

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim:  (s) => `\x1b[2m${s}\x1b[0m`,
  green:(s) => `\x1b[32m${s}\x1b[0m`,
  red:  (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

console.log('');
console.log(c.bold('AgentPKI end-to-end demo'));
console.log(c.dim('─'.repeat(56)));
console.log(`  demo issuer:  ${c.cyan(DEMO_ISSUER)}`);
console.log(`  verifier:     ${c.cyan(VERIFIER)}`);
console.log('');

// ────────────────────────────────────────────────────────────────────
// Step 1 — fetch the issuer directory (proves discovery works)
console.log(c.bold('1. Fetch issuer directory'));
const dirRes = await fetch(`${DEMO_ISSUER}/.well-known/agentpki-issuer.json`);
if (!dirRes.ok) {
  console.error(c.red(`   FAIL: ${dirRes.status} ${await dirRes.text()}`));
  process.exit(1);
}
const dir = await dirRes.json();
console.log(`   ${c.green('OK')}  issuer=${dir.issuer}  name="${dir.name}"  tier=${dir.tier}`);
console.log(`        ${c.dim(`current_keys[0].kid = ${dir.current_keys[0].kid}`)}`);
console.log('');

// ────────────────────────────────────────────────────────────────────
// Step 2 — mint a passport
console.log(c.bold('2. Mint a passport'));
const mintParams = new URLSearchParams({
  sub: 'agent:demo/research-bot-v1',
  scope: 'read:articles,read:public-data',
  lifetime: '600',
});
const mintRes = await fetch(`${DEMO_ISSUER}/mint?${mintParams}`);
if (!mintRes.ok) {
  console.error(c.red(`   FAIL: ${mintRes.status} ${await mintRes.text()}`));
  process.exit(1);
}
const minted = await mintRes.json();
console.log(`   ${c.green('OK')}  ${minted.token.slice(0, 56)}…`);
console.log(`        ${c.dim(`sub=${minted.passport.sub}`)}`);
console.log(`        ${c.dim(`scope=[${minted.passport.scope.join(', ')}]`)}`);
console.log(`        ${c.dim(`expires_in=${minted.expires_in}s  jti=${minted.passport.jti.slice(0, 16)}…`)}`);
console.log('');

// ────────────────────────────────────────────────────────────────────
// Step 3 — POST to the verifier
console.log(c.bold('3. POST to verifier /v1/verify'));
const t0 = Date.now();
const verifyRes = await fetch(`${VERIFIER}/v1/verify`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: minted.token }),
});
const verdict = await verifyRes.json();
const wallMs = Date.now() - t0;

if (!verifyRes.ok || verdict.verdict !== 'allow') {
  console.log(c.red('   FAIL'));
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(1);
}

console.log(`   ${c.green('OK')}  verdict=${c.bold(verdict.verdict)}  worker=${verdict.elapsed_ms ?? '?'}ms  wall=${wallMs}ms`);
console.log(`        ${c.dim(`passport.issuer=${verdict.passport.issuer}`)}`);
console.log(`        ${c.dim(`passport.tier=${verdict.passport.tier}  scopes=[${verdict.passport.scopes.join(', ')}]`)}`);
console.log(`        ${c.dim(`abuse_score=${verdict.abuse_score}  cached_until=+${verdict.cached_until - Math.floor(Date.now()/1000)}s`)}`);
console.log('');

// ────────────────────────────────────────────────────────────────────
// Step 4 — negative-path sanity: tamper with the token and confirm reject.
//
// Tamper inside the BODY segment (where the signature lives) — not the
// footer or the last char — so we get a clean `bad_signature` rejection.
// Any of bad_signature / malformed / signature_invalid is accepted as
// a valid tamper rejection per spec §8.1.3.
console.log(c.bold('4. Tamper-detection sanity check'));

const parts = minted.token.split('.'); // ['v4', 'public', body, footer?]
const body = parts[2];
const mid = Math.floor(body.length / 2);
const flipped = body[mid] === 'A' ? 'B' : 'A';
parts[2] = body.slice(0, mid) + flipped + body.slice(mid + 1);
const tampered = parts.join('.');

const tamperRes = await fetch(`${VERIFIER}/v1/verify`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: tampered }),
});
const tamperResult = await tamperRes.json();
const validRejections = new Set(['bad_signature', 'malformed', 'signature_invalid']);
if (tamperResult.verdict === 'deny' && validRejections.has(tamperResult.failure_reason)) {
  console.log(`   ${c.green('OK')}  tampered token rejected with failure_reason=${tamperResult.failure_reason}`);
} else {
  console.log(c.red(`   FAIL: tampered token should have been rejected. Got verdict=${tamperResult.verdict} reason=${tamperResult.failure_reason}`));
  process.exit(1);
}
console.log('');

console.log(c.dim('─'.repeat(56)));
console.log(c.bold(c.green('  ✓ End-to-end pipeline works on production infra.')));
console.log('');
