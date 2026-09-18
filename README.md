# DiffJury

**Jev decides if this PR is risky or not.**

Paste a public GitHub pull request URL and hit **Analyze**. One click fetches the PR dossier (title, body, diff, contributors) and runs a TypeSafe Jev `systemOne` judgment — risk bars, noul probabilities, and a verdict. No essays. No second button.

## How it works

1. Landing: one large URL field. Optional quiet sample chip.
2. Analyze fetches `POST /api/github-pr`, then immediately `POST /api/review`.
3. Success opens a split view — dossier on the left, judgment on the right.
4. Failure stays on the landing screen with a clear error.

Large PRs are trimmed locally to fit Jev's ~32k/64k token limits; small PRs keep their full, unchanged context.

## Stack

- Next.js 15 App Router + TypeScript + Tailwind
- `@typesafe-ai/sdk` (`TypeSafeClient.systemOne`, model `jev-latest`) — **server-only** via `POST /api/review`
- Env: `TYPESAFE_API_KEY` (never exposed to the browser)
- Optional: `GITHUB_TOKEN` for higher GitHub API rate limits when fetching public PRs

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
# put your keys in .env.local — never commit them
# TYPESAFE_API_KEY=...
# GITHUB_TOKEN=...   # optional; public unauthenticated API works

npm run dev
# open http://localhost:3000
```

Production locally:

```bash
npm run build
npm run start
```

## API

### `POST /api/review`

Unchanged. Accepts a PR payload and returns Jev answers.

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

### `POST /api/github-pr` (also `GET ?url=`)

Fetches a **public** GitHub PR via the REST API (no user OAuth). Uses unauthenticated requests by default; set `GITHUB_TOKEN` on the server for higher rate limits.

```json
{ "url": "https://github.com/owner/repo/pull/123" }
```

Response includes `title`, `body`, `diff`, `author` / `contributors` (login + `avatarUrl` + `htmlUrl`), `linkedIssues`, file stats, and metadata. Clear errors for invalid URL, 404/private, and rate limits.

## Railway

1. Create a new Railway service from this repo (Docker or Nixpacks).
2. Set variable **`TYPESAFE_API_KEY`** in the Railway service environment (same name as local).
3. Optionally set **`GITHUB_TOKEN`** for higher PR-fetch rate limits.
4. Railway injects `PORT`; the Dockerfile and Nixpacks start command bind `0.0.0.0`.
5. Health: `GET /` serves the UI.

**Dockerfile** — multi-stage Next.js standalone build (preferred if you select Docker).

**Nixpacks** — `nixpacks.toml` uses Node 22, `npm ci`, `npm run build`, then `next start -H 0.0.0.0 -p $PORT`.

## Security

- `TYPESAFE_API_KEY` and `GITHUB_TOKEN` are read only from `process.env` on the server.
- Ship `.env.example` with empty values; do not commit real keys.
- No GitHub OAuth, no database, no LLM fallback in v1.
- PR fetch only works for **public** repositories.

## License

Demo app for TypeSafe Jev.
