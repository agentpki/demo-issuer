# `@agentpki/demo-issuer` — public demo issuer

A no-auth, no-setup AgentPKI issuer for demos, tutorials, and integration
testing. Anyone can `curl` it and feed the resulting token to the verifier.

- **Spec:** https://agentpki.dev/spec/v0.1
- **Hosted instance:** `https://demo.agentpki.dev`

> ⚠️ **NOT FOR PRODUCTION.** The keypair is hardcoded in
> [`src/keys.ts`](./src/keys.ts) and the `/mint` endpoint is intentionally
> open. Real issuers MUST use HSM/KMS-resident keys and gate `/mint` behind
> auth. See spec §5.3.

## Endpoints

```
GET  /.well-known/agentpki-issuer.json   # discoverable directory document
GET  /.well-known/agentpki-crl.json      # empty CRL for the demo
GET  /mint?sub=...&scope=...&lifetime=.. # mint a passport (no auth)
POST /mint                               # same but JSON body
GET  /                                   # service info
GET  /health                             # liveness probe
```

## One-line demo

```bash
# Mint, then verify, in one pipeline
curl -s 'https://demo.agentpki.dev/mint?sub=agent:hello/world&scope=read:articles' \
  | jq -r .token \
  | xargs -I {} curl -s -X POST https://verify.agentpki.dev/v1/verify \
      -H 'content-type: application/json' \
      -d '{"token":"{}"}' \
  | jq
```

Returns a JSON verdict with `"verdict": "allow"`.

## Local development

```bash
git clone https://github.com/agentpki/demo-issuer
cd demo-issuer
pnpm install
pnpm dev               # miniflare on localhost
pnpm run release       # deploy to your own Cloudflare account
pnpm demo              # run the bundled end-to-end demo against production
```

## Run your own demo issuer

`wrangler.toml` ships configured for `demo.agentpki.dev`. To run your own:

1. Edit `wrangler.toml` — change `name` and the `routes.pattern` to your domain
2. Regenerate the demo keypair (run `pnpm tsx examples/gen-demo-key.ts` from
   `agentpki/sdk-typescript`) and paste the output into `src/keys.ts`
3. `pnpm run release`

## License

MIT. Spec it implements is Apache 2.0.
