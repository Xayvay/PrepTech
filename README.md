# PrepTech

Tell it the role and the company. It builds a tailored study plan, drills you with graded interview questions, and helps you iterate until you can answer them cleanly.

Built with Next.js (App Router) and the [Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview), so prep runs against your local `claude` CLI login — usage bills to your Claude subscription, not an API key. Web search is grounded in real, current info about the company instead of stale training-data guesses.

> **Status:** this branch is the MVP. The full product vision — real questions from Reddit + open repos, code execution against test cases, mastery tracking, company-specific behavioral prep — is documented in [`PLAN.md`](./PLAN.md). A static preview of the target UX lives at [`/demo`](./app/demo/page.tsx) (run the app and visit `/demo`).

## How it works

1. Enter the role and company.
2. PrepTech generates a 5–8 item study plan, searching the web for what the company actually cares about for this role.
3. It drills you with one question at a time.
4. You answer; it grades you 0–10 with feedback and a follow-up question.
5. Running average is shown so you can see yourself improve.

Everything — sessions, scores, transcripts — lives in your browser's `localStorage`. Nothing is stored on the server.

## Auth

PrepTech uses the [Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview), which shells out to your locally-installed `claude` CLI. Whatever you're already logged into — Pro, Max, or API-key billing — is what gets used. No separate API key to manage; nothing stored in the browser besides your session transcripts.

Prereq: install Claude Code and log in once:

```bash
npm install -g @anthropic-ai/claude-code
claude /login
```

Confirm with `claude /status`. If `ANTHROPIC_API_KEY` is set in your shell environment, PrepTech explicitly strips it before invoking the SDK so subscription auth is used.

## Run locally

```bash
git clone https://github.com/Xayvay/PrepTech.git
cd PrepTech
npm install
npm run dev
```

Open <http://localhost:3000> and start a session.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript + Tailwind CSS
- `@anthropic-ai/claude-agent-sdk` with the built-in `WebSearch` tool
- `localStorage` for all persistence — no database

## Layout

```
app/
  page.tsx                home / setup
  session/[id]/page.tsx   drill UI
  api/claude/route.ts     server route — invokes Agent SDK against local claude login
lib/
  api.ts                  client fetch helper
  prompts.ts              system prompt + per-mode message builders
  storage.ts              localStorage CRUD for sessions
  types.ts                shared types
```

## License

MIT — do whatever you want with it.
