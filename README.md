# DiffJury

**Jev decides if this PR ships. No essays. Just judgments.**

Paste a pull request (title, body, diff, optional CI log / linked issue). One TypeSafe Jev `systemOne` call returns a risk router + code review coach — scores, noul probabilities, and a final verdict. No LLM text generation.

## Stack

- Next.js 15 App Router + TypeScript + Tailwind
- `@typesafe-ai/sdk` (`TypeSafeClient.systemOne`, model `jev-latest`) — **server-only** via `POST /api/review`
- Env: `TYPESAFE_API_KEY` (never exposed to the browser)

## Jev questions (single call)

| Key | Type | Meaning |
| --- | --- | --- |
| `risk` | Score | Overall merge risk |
| `review_depth` | Choice | `skim` / `standard` / `deep` |
| `needs_design` | Noul | Design discussion needed? |
| `needs_security` | Noul | Security review needed? |
| `merge_blocker` | Noul | Block merge until fixed? |
| `missing_tests` | Score | Test coverage gaps |
| `docs_debt` | Score | Documentation debt |
| `blast_radius` | Score | How wide a bug could spread |
| `verdict` | Choice | `approve_with_nits` / `request_changes` / `block` |

## Local run

```bash
npm install
cp .env.example .env.local
# put your key in .env.local — never commit it
# TYPESAFE_API_KEY=...

npm run dev
# open http://localhost:3000
```

Production locally:

```bash
npm run build
npm run start
```

Use **Load sample PR** then **Analyze PR** to exercise the full nine-answer payload.

## API

`POST /api/review`

```json
{
  "title": "string",
  "body": "string",
  "diff": "string",
  "ciLog": "string (optional)",
  "linkedIssue": "string (optional)"
}
```

Response includes `answers`, `model`, `latency_ms`, and `usage`.

## Railway

1. Create a new Railway service from this repo (Docker or Nixpacks).
2. Set variable **`TYPESAFE_API_KEY`** in the Railway service environment (same name as local).
3. Railway injects `PORT`; the Dockerfile and Nixpacks start command bind `0.0.0.0`.
4. Health: `GET /` serves the UI.

**Dockerfile** — multi-stage Next.js standalone build (preferred if you select Docker).

**Nixpacks** — `nixpacks.toml` uses Node 22, `npm ci`, `npm run build`, then `next start -H 0.0.0.0 -p $PORT`.

## Security

- `TYPESAFE_API_KEY` is read only from `process.env` on the server.
- Ship `.env.example` with an empty value; do not commit real keys.
- No GitHub OAuth, no database, no LLM fallback in v1.

## License

Demo app for TypeSafe Jev.
