# PrepTech

Tell it the role and the company. It builds a tailored study plan, drills you with graded interview questions, and helps you iterate until you can answer them cleanly.

Built with Next.js (App Router), the Claude API, and Claude's web search tool — so prep is grounded in real, current info about the company instead of stale training-data guesses.

## How it works

1. Enter the role and company.
2. PrepTech generates a 5–8 item study plan, searching the web for what the company actually cares about for this role.
3. It drills you with one question at a time.
4. You answer; it grades you 0–10 with feedback and a follow-up question.
5. Running average is shown so you can see yourself improve.

Everything — sessions, scores, transcripts — lives in your browser's `localStorage`. Nothing is stored on the server.

## Bring your own key

PrepTech is BYOK. You paste your Anthropic API key into the home screen; it's stored in `localStorage` and forwarded through the Next.js server route to Anthropic. The repo ships with no secrets and no shared backend, so it's safe to fork and run.

Get a key: <https://console.anthropic.com/settings/keys>

The web search tool is metered separately — see [Anthropic's pricing](https://docs.claude.com/en/docs/build-with-claude/tool-use/web-search-tool) for current rates. A full prep session is typically a few cents.

## Run locally

```bash
git clone https://github.com/Xayvay/PrepTech.git
cd PrepTech
npm install
npm run dev
```

Open <http://localhost:3000> and paste your API key when prompted.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript + Tailwind CSS
- `@anthropic-ai/sdk` with the `web_search_20250305` server-side tool
- `localStorage` for all persistence — no database

## Layout

```
app/
  page.tsx                home / setup
  session/[id]/page.tsx   drill UI
  api/claude/route.ts     server proxy to Anthropic (uses BYOK header)
lib/
  api.ts                  client fetch helper
  prompts.ts              system prompt + per-mode message builders
  storage.ts              localStorage CRUD for sessions
  types.ts                shared types
```

## License

MIT — do whatever you want with it.
