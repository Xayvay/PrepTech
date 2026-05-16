"use client";

import Link from "next/link";
import { useState } from "react";

// Static demo of the future PrepTech UX. No API calls, no tokens. Hardcoded
// data shows what a real drilling session looks like once the data pipeline
// (Reddit ingestion + open-repo seed + code execution) is built out — see
// PLAN.md in the repo root.

type Lang = "python" | "javascript" | "typescript" | "java" | "cpp" | "go";

const STARTER: Record<Lang, string> = {
  python: `def two_sum(nums, target):
    # Your solution here
    pass
`,
  javascript: `function twoSum(nums, target) {
  // Your solution here
}
`,
  typescript: `function twoSum(nums: number[], target: number): number[] {
  // Your solution here
  return [];
}
`,
  java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Your solution here
        return new int[]{};
    }
}
`,
  cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Your solution here
        return {};
    }
};
`,
  go: `func twoSum(nums []int, target int) []int {
    // Your solution here
    return nil
}
`,
};

const LANG_LABEL: Record<Lang, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
};

const LANG_RUNNER: Record<Lang, string> = {
  python: "Claude code_execution",
  javascript: "Judge0",
  typescript: "Judge0",
  java: "Judge0",
  cpp: "Judge0",
  go: "Judge0",
};

type TestResult = { name: string; input: string; expected: string; actual: string; passed: boolean };

const FAKE_TEST_RESULTS: TestResult[] = [
  { name: "basic", input: "[2,7,11,15], 9", expected: "[0,1]", actual: "[0,1]", passed: true },
  { name: "duplicates", input: "[3,3], 6", expected: "[0,1]", actual: "[0,1]", passed: true },
  { name: "negatives", input: "[-1,-2,-3,-4,-5], -8", expected: "[2,4]", actual: "[2,4]", passed: true },
  { name: "single solution", input: "[3,2,4], 6", expected: "[1,2]", actual: "[1,2]", passed: true },
  { name: "long array", input: "[0,4,3,0], 0", expected: "[0,3]", actual: "[0,3]", passed: true },
  { name: "no solution", input: "[1,2,3], 100", expected: "[]", actual: "[]", passed: true },
  { name: "large input (perf)", input: "[10k elements]", expected: "[3,7842]", actual: "[3,7842]", passed: true },
  { name: "edge: empty array", input: "[], 5", expected: "[]", actual: "[]", passed: true },
  { name: "edge: single element", input: "[5], 5", expected: "[]", actual: "TypeError", passed: false },
  { name: "edge: target=0", input: "[0,0], 0", expected: "[0,1]", actual: "TypeError", passed: false },
];

const FAKE_AI_REVIEW = `**Score: 7/10**

**What worked**
- Correct hash-map approach — O(n) time, O(n) space. This is the senior-bar solution; brute-force O(n²) would have been a yellow flag.
- Clean variable names, single pass, returns indices in the order expected.

**What's missing**
- Two edge cases fail: empty array and single-element array both raise \`TypeError\` because you don't guard the iteration. A staff-bar interviewer would catch this in 10 seconds.
- No early exit comment or assertion about input shape. Stripe in particular asks about input validation in onsite rounds (see [Reddit thread](https://reddit.com/r/cscareerquestions), May 2026).

**Concrete improvement**
Add \`if not nums or len(nums) < 2: return []\` at the top. Then state out loud during the interview: *"I'm assuming the problem guarantees a solution exists; let me handle the case where it doesn't anyway."* That single sentence is what separates senior from mid.

**Follow-up question**
What if the array is sorted? Can you do better than O(n) space?`;

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(STARTER.python);
  const [phase, setPhase] = useState<"idle" | "running" | "ran" | "reviewing" | "reviewed">("idle");
  const [showHidden, setShowHidden] = useState(false);

  function switchLang(next: Lang) {
    setLang(next);
    setCode(STARTER[next]);
    setPhase("idle");
  }

  function runTests() {
    setPhase("running");
    setTimeout(() => setPhase("ran"), 900);
  }

  function submitForReview() {
    setPhase("reviewing");
    setTimeout(() => setPhase("reviewed"), 1400);
  }

  function reset() {
    setCode(STARTER[lang]);
    setPhase("idle");
    setShowHidden(false);
  }

  const visibleResults = showHidden ? FAKE_TEST_RESULTS : FAKE_TEST_RESULTS.slice(0, 6);
  const passed = FAKE_TEST_RESULTS.filter((t) => t.passed).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← back
        </Link>
        <div className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-1 text-xs text-amber-200">
          Static preview · no API calls · hardcoded data to show the target UX
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge color="emerald">Easy</Badge>
          <Badge color="sky">arrays</Badge>
          <Badge color="sky">hash-map</Badge>
          <Badge color="sky">two-pointers</Badge>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">asked at</span>
          <Badge color="zinc">Stripe</Badge>
          <Badge color="zinc">Meta</Badge>
          <Badge color="zinc">Google</Badge>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">3 Reddit reports in last 90 days</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Two Sum</h1>
        <p className="mt-2 text-zinc-400">
          Given an array of integers <code className="font-mono text-zinc-300">nums</code> and an integer{" "}
          <code className="font-mono text-zinc-300">target</code>, return indices of the two numbers such that they
          add up to target. Each input has exactly one solution, and you may not use the same element twice.
        </p>
        <details className="mt-3 text-xs text-zinc-500">
          <summary className="cursor-pointer hover:text-zinc-300">Sources</summary>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li>
              Seeded from <span className="text-zinc-400">yangshun/tech-interview-handbook</span> (MIT)
            </li>
            <li>
              Reported recently in <span className="text-zinc-400">r/cscareerquestions</span> (3 posts, May 2026)
            </li>
            <li>
              Topic explainer cached from <span className="text-zinc-400">Wikipedia: Hash table</span> (CC-BY-SA)
            </li>
          </ul>
        </details>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Solution</span>
              <select
                value={lang}
                onChange={(e) => switchLang(e.target.value as Lang)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              >
                {(Object.keys(STARTER) as Lang[]).map((l) => (
                  <option key={l} value={l}>
                    {LANG_LABEL[l]}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">runner: {LANG_RUNNER[lang]}</span>
            </div>
            <div className="text-xs text-zinc-500">Monaco editor in the real build</div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            rows={14}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm leading-relaxed text-emerald-200 outline-none focus:border-zinc-600"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={runTests}
              disabled={phase === "running" || phase === "reviewing"}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {phase === "running" ? "Running tests…" : "Run tests"}
            </button>
            <button
              onClick={submitForReview}
              disabled={phase !== "ran"}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              title={phase !== "ran" ? "Run tests first" : ""}
            >
              {phase === "reviewing" ? "AI reviewing…" : "Submit for AI review"}
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Reset
            </button>
          </div>

          {(phase === "ran" || phase === "reviewing" || phase === "reviewed") && (
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-medium">
                  <span className={passed === FAKE_TEST_RESULTS.length ? "text-emerald-400" : "text-amber-400"}>
                    {passed}/{FAKE_TEST_RESULTS.length}
                  </span>{" "}
                  tests passed
                </div>
                <button
                  onClick={() => setShowHidden((v) => !v)}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  {showHidden ? "Hide hidden tests" : "Show hidden tests"}
                </button>
              </div>
              <ul className="space-y-1.5 text-sm">
                {visibleResults.map((t) => (
                  <li
                    key={t.name}
                    className={`flex items-start gap-2 rounded px-2 py-1 ${
                      t.passed ? "text-zinc-300" : "bg-red-950/30 text-red-200"
                    }`}
                  >
                    <span className={t.passed ? "text-emerald-400" : "text-red-400"}>{t.passed ? "✓" : "✗"}</span>
                    <div className="flex-1">
                      <div className="font-mono text-xs">{t.name}</div>
                      <div className="font-mono text-xs text-zinc-500">
                        in: {t.input} → expected {t.expected}
                        {!t.passed && <span className="text-red-300"> · got {t.actual}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-zinc-500">
                Executed via Claude <code className="font-mono">code_execution</code> tool in the real build · Judge0
                for non-Python.
              </div>
            </div>
          )}

          {phase === "reviewed" && (
            <div className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/20 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-emerald-400">AI review</div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{FAKE_AI_REVIEW}</div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <ThinkAloudPanel />

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Topic mastery</div>
            <div className="space-y-2 text-sm">
              <MasteryRow topic="arrays" value={0.78} />
              <MasteryRow topic="hash-map" value={0.62} />
              <MasteryRow topic="two-pointers" value={0.41} />
              <MasteryRow topic="binary-search" value={0.30} weak />
              <MasteryRow topic="dp" value={0.18} weak />
            </div>
            <button className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
              Drill my weak spots →
            </button>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Study this topic</div>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>
                <div className="text-zinc-100">Hash table</div>
                <div className="text-xs text-zinc-500">Wikipedia · cached summary</div>
              </li>
              <li>
                <div className="text-zinc-100">CTCI Ch. 1: Arrays &amp; Strings</div>
                <div className="text-xs text-zinc-500">Cracking the Coding Interview · reference only</div>
              </li>
              <li>
                <div className="text-zinc-100">tech-interview-handbook · arrays</div>
                <div className="text-xs text-zinc-500">MIT · usable in full</div>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Recent at Stripe</div>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>
                <div className="text-zinc-100">Idempotency in payment APIs</div>
                <div className="text-xs text-zinc-500">From stripe.com/blog · weave into system design</div>
              </li>
              <li>
                <div className="text-zinc-100">Reliability principles</div>
                <div className="text-xs text-zinc-500">From eng-blog · cite in behavioral</div>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-16 border-t border-zinc-800 pt-10">
        <VoiceDemo />
      </div>

      <div className="mt-10 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
        <div className="mb-1 font-medium text-zinc-200">This is a static preview.</div>
        Everything you see is hardcoded to show the target UX. See <code className="font-mono text-zinc-300">PLAN.md</code> in
        the repo for the architecture, ingestion pipeline, and milestones to build the real version.
      </div>
    </main>
  );
}

type ThinkPhase = "off" | "listening" | "analyzed";

function ThinkAloudPanel() {
  const [phase, setPhase] = useState<ThinkPhase>("off");

  function toggle() {
    if (phase === "off") setPhase("listening");
    else if (phase === "listening") setPhase("analyzed");
    else setPhase("off");
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Think aloud</div>
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            phase === "listening"
              ? "border border-rose-700 bg-rose-950/40 text-rose-200"
              : phase === "analyzed"
                ? "border border-emerald-800 bg-emerald-950/40 text-emerald-200"
                : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              phase === "listening" ? "animate-pulse bg-rose-500" : phase === "analyzed" ? "bg-emerald-500" : "bg-zinc-500"
            }`}
          />
          {phase === "off" ? "Start mic" : phase === "listening" ? "Listening · stop" : "Show another"}
        </button>
      </div>

      {phase === "off" && (
        <p className="text-xs text-zinc-500">
          Real interviewers grade your <em>reasoning</em>, not your final code. Turn on the mic and narrate what
          you&apos;re doing — PrepTech transcribes and grades the signal you&apos;re actually being scored on.
        </p>
      )}

      {phase === "listening" && (
        <div className="space-y-2">
          <div className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-300">
            <span className="text-zinc-500">[00:04]</span> ok so the input is an array of ints, target is an int…
            <br />
            <span className="text-zinc-500">[00:11]</span> can the same element be used twice? the problem says no.
            <br />
            <span className="text-zinc-500">[00:18]</span> brute force is O(n²) nested loop, but…
            <br />
            <span className="text-zinc-500">[00:24]</span> hash map gets me O(n) — store complement as I go.
            <br />
            <span className="animate-pulse text-zinc-500">▍</span>
          </div>
          <div className="text-[11px] text-zinc-500">Live transcript · Web Speech API</div>
        </div>
      )}

      {phase === "analyzed" && (
        <div className="space-y-2.5 text-xs">
          <ThinkRow label="Clarified constraints" status="ok" />
          <ThinkRow label="Stated complexity" status="ok" note="O(n) before writing" />
          <ThinkRow label="Walked edge cases" status="weak" note="no mention of empty / single-element" />
          <ThinkRow label="Narrated while coding" status="ok" />
          <ThinkRow label="Traced through example" status="bad" note="jumped to submit without dry-run" />
          <ThinkRow label="Discussed tradeoffs" status="weak" note="no mention of space O(n)" />
          <div className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">
            Silence ratio: <span className="text-amber-300">38%</span> · target &lt; 25%
          </div>
          <div className="text-zinc-400">
            Reasoning ↔ code: <span className="text-emerald-300">aligned</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ThinkRow({ label, status, note }: { label: string; status: "ok" | "weak" | "bad"; note?: string }) {
  const mark = status === "ok" ? "✓" : status === "weak" ? "△" : "✗";
  const color = status === "ok" ? "text-emerald-400" : status === "weak" ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex items-start gap-2">
      <span className={color}>{mark}</span>
      <div className="flex-1">
        <div className="text-zinc-200">{label}</div>
        {note && <div className="text-[11px] text-zinc-500">{note}</div>}
      </div>
    </div>
  );
}

type VoicePhase = "idle" | "recording" | "transcribing" | "transcribed" | "grading" | "graded";

const MOCK_TRANSCRIPT = `So, um, like last quarter I was working on, uh, our payments pipeline and we had this issue where, you know, transactions were sometimes timing out. And, um, I didn't really have, like, full visibility into the database side of things. So I kind of had to just make a call. I, uh, I bumped the timeout and added some retry logic, and I think it worked out fine, like, the error rate went down. Yeah.`;

const FILLERS = ["um", "uh", "like", "you know", "kind of", "I think", "sort of"];

function VoiceDemo() {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [seconds, setSeconds] = useState(0);

  function record() {
    setPhase("recording");
    setSeconds(0);
    const start = Date.now();
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setSeconds(s);
      if (s >= 4) {
        clearInterval(tick);
        setPhase("transcribing");
        setTimeout(() => setPhase("transcribed"), 1100);
      }
    }, 100);
  }

  function grade() {
    setPhase("grading");
    setTimeout(() => setPhase("graded"), 1500);
  }

  function reset() {
    setPhase("idle");
    setSeconds(0);
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs">
        <Badge color="amber">Behavioral</Badge>
        <Badge color="sky">leadership-principle</Badge>
        <Badge color="zinc">Amazon</Badge>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-400">tests &quot;Bias for Action&quot; + &quot;Are Right, A Lot&quot;</span>
      </div>
      <h2 className="text-xl font-semibold tracking-tight">
        Tell me about a time you had to make a decision without all the information you needed.
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Behavioral mode: speak your answer like you would in the real interview. PrepTech transcribes it, then grades
        both <em>content</em> and <em>delivery</em> — filler words, pacing, STAR structure, hedging language,
        specificity of outcome.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {phase === "idle" && (
          <button
            onClick={record}
            className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-white" />
            Record answer
          </button>
        )}
        {phase === "recording" && (
          <div className="flex items-center gap-2 rounded-md border border-rose-700 bg-rose-950/40 px-4 py-2 text-sm text-rose-200">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            Recording… {seconds}s
          </div>
        )}
        {phase === "transcribing" && <PhaseInline label="Transcribing with Web Speech API…" />}
        {phase === "grading" && <PhaseInline label="Grading content + delivery…" />}
        {(phase === "transcribed" || phase === "graded") && (
          <>
            <button
              onClick={grade}
              disabled={phase === "graded"}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              {phase === "graded" ? "Graded" : "Grade my answer"}
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Re-record
            </button>
          </>
        )}
      </div>

      {(phase === "transcribed" || phase === "grading" || phase === "graded") && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="uppercase tracking-wide text-zinc-500">Transcript · 32s</span>
                <span className="text-zinc-500">filler words highlighted</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {renderTranscriptWithFillers(MOCK_TRANSCRIPT)}
              </p>
            </div>

            {phase === "graded" && (
              <div className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-emerald-400">Delivery + content review</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{`**Content: 5/10 · Delivery: 4/10**

**Content**
The story is real but underspecified. We hear what you did (bumped timeout, added retries) but not *why* the decision was hard, what tradeoffs you considered, or what specifically improved. "Error rate went down" is exactly the kind of weak result that hiring committees flag in debriefs.

**Delivery**
- 9 filler words in 32 seconds = ~1 every 3.5s. Target is < 1 per 15s.
- Pacing 95 wpm — slow, reads as uncertain. Target 130–160 for behavioral.
- 4 hedges ("kind of", "I think", "like", "I think it worked out") — drop them. "It worked" is stronger than "I think it worked".
- Length 32s. Behavioral targets 90–120s. You're leaving the room without making your case.

**What to do**
1. Open with one crisp sentence of stakes: *"Payment timeouts were causing roughly 2% of checkouts to fail at peak hours."*
2. Name the missing information: *"I had no read access to the production DB and the DBA team was offline for the weekend."*
3. Name the tradeoff you made: *"I could wait until Monday for a proper root cause, or ship a mitigation that might mask the real issue. I shipped the mitigation."*
4. Quantify the result: replace "went down" with the actual number.

**Rewritten model answer (90s target)**
"During Q3 our payments pipeline started timing out at peak hours — about 2% of checkouts were failing and Stripe was paging us. I was on call, the DBA team was offline for the weekend, and I had no read access to the production DB to confirm whether the issue was query latency or connection pooling. I had to choose: wait 48 hours for a clean diagnosis, or ship a mitigation now and root-cause later. I shipped the mitigation — bumped the connection timeout from 5s to 15s and added a single retry with exponential backoff. Error rate dropped from 2.1% to 0.3% within an hour. On Monday we did the proper root cause — turned out to be connection pool exhaustion from a deploy two days earlier — and reverted the timeout once the real fix was in. The lesson: if you can ship a safe, reversible mitigation that buys you time, do it; don't let perfect block good."

**Follow-up**
What would you have done if the mitigation had made things worse?`}</div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">STAR structure</div>
              <div className="space-y-2 text-sm">
                <StarRow label="Situation" status="ok" note="payments pipeline issue" />
                <StarRow label="Task" status="weak" note="vague — what was at stake?" />
                <StarRow label="Action" status="ok" note="bumped timeout + retry" />
                <StarRow label="Result" status="weak" note='"went down" — no metric' />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Delivery metrics</div>
              <ul className="space-y-2 text-sm">
                <Metric label="Filler words" value="9 (1 per 3.5s)" tone="bad" />
                <Metric label="Pacing" value="95 wpm" tone="warn" />
                <Metric label="Hedging" value="4 instances" tone="warn" />
                <Metric label="Length" value="32s / target 90–120s" tone="bad" />
                <Metric label="Quantified outcome" value="No" tone="bad" />
              </ul>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Recent at Amazon</div>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li>
                  <div className="text-zinc-100">2026 LP refresh: emphasis on operational excellence</div>
                  <div className="text-xs text-zinc-500">From aboutamazon.com · weave into ops-flavored stories</div>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function PhaseInline({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {label}
    </div>
  );
}

function StarRow({ label, status, note }: { label: string; status: "ok" | "weak"; note: string }) {
  const ok = status === "ok";
  return (
    <div className="flex items-start gap-2">
      <span className={ok ? "text-emerald-400" : "text-amber-400"}>{ok ? "✓" : "△"}</span>
      <div>
        <div className="text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500">{note}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-rose-300";
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-zinc-400">{label}</span>
      <span className={color}>{value}</span>
    </li>
  );
}

function renderTranscriptWithFillers(text: string) {
  const pattern = new RegExp(`\\b(${FILLERS.join("|")})\\b`, "gi");
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(
      <mark key={key++} className="rounded bg-rose-950/60 px-1 text-rose-200">
        {match[0]}
      </mark>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

function Badge({ children, color }: { children: React.ReactNode; color: "emerald" | "sky" | "zinc" | "amber" }) {
  const styles = {
    emerald: "border-emerald-800 bg-emerald-950/50 text-emerald-300",
    sky: "border-sky-800 bg-sky-950/50 text-sky-300",
    zinc: "border-zinc-700 bg-zinc-900 text-zinc-300",
    amber: "border-amber-800 bg-amber-950/50 text-amber-300",
  }[color];
  return <span className={`rounded border ${styles} px-1.5 py-0.5 text-[10px] uppercase tracking-wide`}>{children}</span>;
}

function MasteryRow({ topic, value, weak }: { topic: string; value: number; weak?: boolean }) {
  const pct = Math.round(value * 100);
  const barColor = weak ? "bg-amber-500" : value > 0.7 ? "bg-emerald-500" : "bg-sky-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300">{topic}</span>
        <span className={weak ? "text-amber-400" : "text-zinc-500"}>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
