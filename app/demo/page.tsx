"use client";

import Link from "next/link";
import { useState } from "react";

// Static demo of the future PrepTech UX. No API calls, no tokens. Hardcoded
// data shows what a real drilling session looks like once the data pipeline
// (Reddit ingestion + open-repo seed + code execution) is built out — see
// PLAN.md in the repo root.

const STARTER_CODE = `def two_sum(nums, target):
    # Your solution here
    pass
`;

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
  const [code, setCode] = useState(STARTER_CODE);
  const [phase, setPhase] = useState<"idle" | "running" | "ran" | "reviewing" | "reviewed">("idle");
  const [showHidden, setShowHidden] = useState(false);

  function runTests() {
    setPhase("running");
    setTimeout(() => setPhase("ran"), 900);
  }

  function submitForReview() {
    setPhase("reviewing");
    setTimeout(() => setPhase("reviewed"), 1400);
  }

  function reset() {
    setCode(STARTER_CODE);
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
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-zinc-400">Solution · Python</div>
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

      <div className="mt-10 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
        <div className="mb-1 font-medium text-zinc-200">This is a static preview.</div>
        Everything you see is hardcoded to show the target UX. See <code className="font-mono text-zinc-300">PLAN.md</code> in
        the repo for the architecture, ingestion pipeline, and milestones to build the real version.
      </div>
    </main>
  );
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
