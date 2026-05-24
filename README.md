# PrepTech

Tell it the role and the company. It builds you a tailored study plan, drills you with graded interview questions sourced from real candidate reports, and helps you iterate until you can answer them cleanly.

Built with Next.js (App Router) and the [Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview), so prep runs against your local `claude` CLI login — usage bills to your Claude subscription, not a separate API key. Web search keeps the prep grounded in real, current info about the company instead of stale training-data guesses.

> **Status:** this branch has shipped a large chunk of the vision in [`PLAN.md`](./PLAN.md): real questions from web sources, mastery tracking, structured iterative grading, stack-specific cheat sheets, day-of-N plan. Code execution against test cases and peer mocks remain on the roadmap. A static preview of the original target UX lives at [`/demo`](./app/demo/page.tsx) — run the app and visit `/demo`.

## How it works

1. **Enter the role and company.** Optional details fold in if you provide them: language(s), interview round types to focus on, seniority, free-text notes, and — most importantly — *what would landing this role change for you*. That motivation gets referenced in every grade nudge.
2. **The study plan auto-builds** on session entry: a 5–8 item curriculum tailored to the role + company, with at least one item on AI-augmented engineering for that company.
3. **A "Today" panel** recommends what to drill: spaced-rep topics you struggled with 3+ days ago, then your weakest non-mastered topic, then a refresh. Day N of 14 + mastery stats at a glance.
4. **Drilling** breaks into its own focused view. The question stays pinned at the top; your answer pad sits below. Coding topics get a monospace code mode with Tab-to-indent and a language chip.
5. **Each question comes from a per-topic bank** of 6 real questions, web-searched from Glassdoor, Reddit `r/cscareerquestions` / `r/leetcode`, candidate blog posts, and the company's own engineering blog. Each question is sourced with attribution and tagged with the concepts it tests.
6. **You get a structured grade** — score with progress bar, what you nailed, where you're weak, 1–3 concrete improvements each with a real web-searched resource link, follow-up question, and a motivation-aware nudge.
7. **Try the same question again** with your prior answer pre-filled, or move to the next.
8. **Cheat sheet drawer** opens at any time — stack-aware syntax reference with Prism syntax highlighting, your own notes per entry, and a rebuild button.
9. **Concept-tag chips** on questions open the cheat sheet at the relevant topic so you can reference your knowledge mid-drill.

Everything — sessions, scores, transcripts, banks, cheat sheets, mastery — lives in your browser's `localStorage`. Nothing is stored on the server.

## Auth

PrepTech uses the [Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview), which shells out to your locally-installed `claude` CLI. Whatever you're already logged into — Pro, Max, or API-key billing — is what gets used. No separate API key to manage; nothing stored in the browser besides your session data.

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

## Features

- **Session-tailored coaching.** Optional language / interview-type / seniority / motivation / notes fields fold into the system prompt so questions and grades are calibrated to *you*.
- **Auto-curriculum on session start.** No "build my plan" button — the moment you arrive, it starts searching the web and assembling the study plan.
- **Mastery tracking.** Red/amber/green dots per topic based on your scoring history. Green = 3+ scores at 8+ with average ≥8.
- **Today panel.** Day N of 14, mastery stats, single recommended topic for today with spaced-rep priority.
- **Drilling view.** Focused mode with sticky question, code-mode input, and a Try-again loop.
- **Real-source question banks.** Per topic, lazy-built batch of 6 questions sourced from candidate reports with attribution. Replaced on exhaustion with persistent seen-question tracking so the model never repeats.
- **Schema-versioned banks.** Future schema changes (new fields, new tags) invalidate legacy entries cleanly without breaking existing sessions.
- **Concept-tagged questions.** Each bank entry carries `concept_tags` chips — clicking one opens the cheat sheet at the relevant topic.
- **Structured grade card.** Score with progress bar, strengths, gaps, improvements with web-searched real resource links, follow-up question, motivation-aware nudge.
- **Try this again.** One-click revise on any grade — pre-fills your prior answer, drops you back into the answer pad.
- **Cheat sheet drawer.** Lazy-built per session, stack-aware syntax reference with Prism syntax highlighting (Swift, Python, Scala, TS/JS, Kotlin, Java, Go, Rust, Ruby, SQL, Bash). Editable user notes per entry. Rebuild button.
- **LeetCode link-outs** on coding curriculum cards for when you want to drill outside the app.
- **AI-augmented-engineering item required** in every curriculum — covers how the company uses AI, which AI tools you should be fluent in, and how to demonstrate AI judgment in interviews.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript + Tailwind CSS
- `@anthropic-ai/claude-agent-sdk` with the built-in `WebSearch` tool
- `react-syntax-highlighter` (Prism light) for the cheat sheet code blocks
- `localStorage` for all persistence — no database, no backend state

## Layout

```
app/
  page.tsx                home / setup with optional session details
  session/[id]/page.tsx   drilling view + transcript view + cheat sheet drawer
  api/claude/route.ts     server route — invokes Agent SDK against local claude login
lib/
  api.ts                  client fetch helper
  prompts.ts              system prompt, message builders, bank/cheat sheet/grade parsers
  mastery.ts              mastery scoring, spaced-rep, day-of-plan, LeetCode URL builder
  storage.ts              localStorage CRUD for sessions
  types.ts                shared types (Session, Turn, BankEntry, CheatSheetEntry, Grade)
```

## Storage shape

All persisted state is in `localStorage` under `preptech.sessions`. Each session carries:

```ts
type Session = {
  id: string;
  role: string;
  company: string;
  languages?: string;
  interviewTypes?: ("coding" | "system_design" | "behavioral" | "domain")[];
  seniority?: string;
  motivation?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];                                     // curriculum + question + answer + grade
  scores: number[];                                  // for the running average
  questionBanks?: Record<string, BankEntry[]>;       // active 6 per topic
  seenQuestions?: Record<string, string[]>;          // every question seen on each topic
  cheatSheet?: CheatSheetEntry[];                    // stack-aware reference
};
```

No data leaves your browser except the prompts and answers you send to Anthropic.

## License

MIT — do whatever you want with it.
