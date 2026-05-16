# PrepTech — Roadmap

This is the plan we'll come back to. The current `main` branch is a localStorage MVP (BYOK key, single LLM-generated question at a time). The real product is below.

---

## Vision

A platform that gives candidates the **best realistic chance** of passing the interview they're actually preparing for. Differentiator vs. LeetCode / Pramp / Exponent: **real, recent, company-specific questions** (sourced from Reddit + open repos), **mastery tracking that connects the dots across users**, and **AI grading that goes beyond pass/fail** (complexity analysis, "would this pass a senior bar" feedback).

Tagline candidate: *"Real questions. Real grading. Real chance."*

---

## Current state (what's on `main`)

| Piece | Status |
|---|---|
| Next.js 15 + Tailwind scaffolding | ✅ |
| BYOK Anthropic API key (localStorage) | ✅ |
| Server route with web search tool | ✅ |
| Per-session role/company + transcript | ✅ |
| One-at-a-time question + numeric grading | ✅ |
| Real question sources | ❌ |
| Cross-user knowledge | ❌ |
| Code execution | ❌ |
| Difficulty / topic tagging | ❌ |
| Mastery tracking | ❌ |

The MVP proves the BYOK + web-search pattern works. It is **not** the foundation for the real product — localStorage doesn't support cross-user knowledge.

---

## Target architecture

### Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (keep) | Already scaffolded |
| Auth | Clerk or Supabase Auth | Drop-in, free tier handles thousands of users |
| Database | Supabase (Postgres + pgvector) | Free tier real, has vector search built-in, auth bundled |
| LLM | Anthropic Claude | Grading, behavioral feedback, question normalization |
| Code execution | Claude `code_execution` tool (Python) + Judge0 (everything else) | Zero infra for Python; Judge0 for Java/C++/Go etc. |
| Ingestion jobs | Supabase Edge Functions (cron) or GitHub Actions | Free, no separate worker infra |
| Editor | Monaco (lazy-loaded only on coding questions) | Same as VS Code, full syntax highlight |

### Core schema (rough)

```
users
  id, email, created_at, plan

prep_sessions
  id, user_id, target_role, target_company, created_at, updated_at

questions
  id, source ('reddit'|'github'|'wikipedia'|'curated'|'llm'),
  source_url, source_date,
  kind ('coding'|'system_design'|'behavioral'|'concept'),
  format ('multiple_choice'|'short_answer'|'long_form'|'code'),
  title, body, choices (jsonb, nullable),
  difficulty ('easy'|'medium'|'hard'),
  topics (text[]),         -- ['arrays','two-pointers','hash-map']
  companies (text[]),      -- ['stripe','meta','google']
  roles (text[]),          -- ['swe','sre','data-eng']
  level_hint ('junior'|'mid'|'senior'|'staff'|'any'),
  embedding vector(1536)   -- pgvector for semantic search

test_cases                 -- for coding questions
  id, question_id, input (jsonb), expected_output (jsonb), is_hidden bool

attempts
  id, user_id, question_id, session_id,
  answer_text, code_lang, code,
  test_results (jsonb),   -- per-test pass/fail
  grade (int 0-10), feedback, follow_up,
  topics_struggled (text[]), time_spent_s, created_at

mastery
  user_id, topic, score (0-1), last_seen, attempts_count
```

### API surface

| Route | Purpose |
|---|---|
| `POST /api/sessions` | Start a prep session (role + company) |
| `GET /api/questions/next?session_id=…` | Get next question, weighted by user's weak topics + difficulty curve |
| `POST /api/attempts` | Submit answer; triggers grading + mastery update |
| `POST /api/code/run` | Execute code against test cases (Claude code_execution or Judge0) |
| `GET /api/mastery` | Per-topic mastery for current user |
| `GET /api/questions/search?q=…` | Semantic search the bank |

### Ingestion pipeline

1. **Reddit cron** (daily, Edge Function):
   - Pull top posts from `r/cscareerquestions`, `r/leetcode`, `r/ExperiencedDevs`, `r/csMajors`, company-specific subs
   - Filter to posts containing keywords like "asked me", "interview", "onsite", "phone screen"
   - For each post, Claude extracts → `{company, role, level, questions: [...], topics, difficulty}`
   - Embed and insert into `questions` (dedup by semantic similarity to existing rows)
2. **GitHub seed** (one-time + monthly refresh):
   - Pull from `yangshun/tech-interview-handbook` (MIT), `donnemartin/system-design-primer` (CC-BY), `Olshansk/interview`, etc.
   - License-check, normalize, tag, insert
3. **Wikipedia enrichment** (on-demand):
   - For each topic, cache a Claude-summarized study explanation grounded in the Wikipedia article. Surface in the "study this topic" sidebar.
4. **LLM gap-fill** (on-demand):
   - When a user picks a company we have no real questions for, generate plausible ones via Claude + web search and mark them `source='llm'` so we can downweight them once real data arrives.

### Books / paid resources

We **link, don't copy**. The "study this topic" view recommends:
- *Cracking the Coding Interview* (Ch. X) — Amazon link
- *Elements of Programming Interviews*
- *System Design Interview, Vol. 1 & 2* (Alex Xu)
- *The Tech Resume Inside Out* (Gergely Orosz)

Affiliate links if you want a small revenue stream that doesn't compromise the product.

---

## Phases

### Phase 1 — Data foundation (week 1–2)
- Supabase project + schema migration
- Auth (Clerk or Supabase)
- Seed import from open GitHub repos (one-time ETL)
- Basic Reddit ingestion (manual trigger first, then cron)
- Question search UI

### Phase 2 — Drilling loop (week 2–3)
- Next-question selector (weighted by mastery + difficulty curve)
- Multiple choice (local grading, no LLM tokens)
- Short answer with LLM grading
- Mastery tracking + heatmap

### Phase 3 — Coding (week 3–4)
- Monaco editor integration
- Claude `code_execution` for Python
- Judge0 for Java/C++/Go/JS
- Test case runner with pass/fail UI
- Claude code review on top of pass/fail (complexity, edge cases, style)

### Phase 4 — Behavioral + company-specific (week 4–5)
- Company leadership principles / values DB (Amazon LPs, Meta tenets, etc.)
- Behavioral question bank tagged by principle
- Long-form answer grading against the principle the question is testing
- "Recent company news to weave into your story" sidebar (web search)

### Phase 5 — Polish + launch (week 5–6)
- Pricing model (free tier + paid? founder skin in the game)
- Onboarding flow (resume upload → infer role+level→ tailor first session)
- Public landing page
- Soft launch on r/cscareerquestions, HN

### Out of scope for v1
- Voice / mock interview mode (Exponent owns this; revisit later)
- Mobile app
- Negotiation prep / comp data (requires levels.fyi-style data, paywalled)
- Multi-language UI

---

## Legal notes (don't skip these)

| Source | Status | Notes |
|---|---|---|
| Reddit API | ✅ Allowed | Register app, respect rate limits, attribute when displaying |
| Wikipedia | ✅ Allowed | CC-BY-SA, attribute the article |
| `donnemartin/system-design-primer` | ✅ Allowed | CC-BY-SA — attribute, share-alike |
| `yangshun/tech-interview-handbook` | ✅ Allowed | MIT |
| LeetCode | ❌ No | ToS forbids scraping, content copyrighted |
| Glassdoor | ❌ No | Same |
| Blind | ❌ No | Same, plus auth-gated |
| levels.fyi | ❌ No | Same; partial API exists, paid |
| CTCI / EPI / Alex Xu books | ⚠️ Reference only | Link to buy, don't reproduce questions or solutions |

When displaying a Reddit-sourced question, always show: original post link, author username (or "redditor"), date. Same for Wikipedia and GitHub repos. Attribution is non-negotiable.

---

## Open questions to decide before Phase 1

1. **Auth provider** — Clerk (more polished, free up to 10k MAU) vs. Supabase Auth (free, bundled but less polished UX). Default: **Supabase Auth** for simplicity.
2. **Pricing** — free with BYOK forever, or freemium with our key? Affects positioning.
3. **Brand** — keep "PrepTech" or rename? Domain availability?
4. **Hosting** — Vercel (Next.js native, free tier) vs. Fly.io (cheaper at scale). Default: **Vercel** until it matters.
5. **Who is the target user** — new-grad? L4 → L5? Career switcher? Affects what we seed first.

---

## Next steps (when you come back)

1. Read this doc + check the `/demo` page on the current build for the UX feel.
2. Decide the answers to the 5 open questions above.
3. Spin up a Supabase project.
4. Run the schema migration.
5. Start Phase 1: seed import from `tech-interview-handbook`.

**Estimated total time to credible v1: 4–6 weeks** of focused work. **First useful thing (Phase 1+2): ~2 weeks.**
