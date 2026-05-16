"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, upsertSession, newTurn } from "@/lib/storage";
import { callClaude } from "@/lib/api";
import {
  systemPrompt,
  curriculumMessages,
  questionMessages,
  gradeMessages,
  parseGrade,
} from "@/lib/prompts";
import type { Session, Turn } from "@/lib/types";

type Phase = "idle" | "loading-curriculum" | "ready-to-ask" | "loading-question" | "answering" | "grading";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession(id);
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
    const hasQuestion = s.turns.some((t) => t.kind === "question");
    const lastTurn = s.turns[s.turns.length - 1];
    if (!hasQuestion) setPhase(s.turns.some((t) => t.kind === "curriculum") ? "ready-to-ask" : "idle");
    else if (lastTurn?.kind === "question") setPhase("answering");
    else setPhase("ready-to-ask");
  }, [id, router]);

  const sys = useMemo(() => (session ? systemPrompt(session.role, session.company) : ""), [session]);

  function commit(updated: Session) {
    upsertSession(updated);
    setSession({ ...updated });
  }

  async function buildCurriculum() {
    if (!session) return;
    setError(null);
    setPhase("loading-curriculum");
    try {
      const res = await callClaude({ system: sys, messages: curriculumMessages(), useWebSearch: true });
      const t = newTurn("assistant", res.text, "curriculum");
      const updated: Session = { ...session, turns: [...session.turns, t] };
      commit(updated);
      setPhase("ready-to-ask");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setPhase("idle");
    }
  }

  async function nextQuestion() {
    if (!session) return;
    setError(null);
    setPhase("loading-question");
    try {
      const res = await callClaude({ system: sys, messages: questionMessages(session), useWebSearch: true });
      const t = newTurn("assistant", res.text, "question");
      const updated: Session = { ...session, turns: [...session.turns, t] };
      commit(updated);
      setAnswer("");
      setPhase("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setPhase("ready-to-ask");
    }
  }

  async function submitAnswer() {
    if (!session || !answer.trim()) return;
    setError(null);
    setPhase("grading");
    const answerTurn = newTurn("user", answer.trim(), "answer");
    const withAnswer: Session = { ...session, turns: [...session.turns, answerTurn] };
    commit(withAnswer);

    try {
      const res = await callClaude({
        system: sys,
        messages: gradeMessages(withAnswer, answer.trim()),
        useWebSearch: false,
      });
      const grade = parseGrade(res.text);
      if (!grade) {
        const t = newTurn("assistant", res.text, "grade");
        commit({ ...withAnswer, turns: [...withAnswer.turns, t] });
      } else {
        const display = `**Score: ${grade.score}/10**\n\n${grade.feedback}${
          grade.follow_up ? `\n\n_Follow-up:_ ${grade.follow_up}` : ""
        }`;
        const t = newTurn("assistant", display, "grade", grade.score);
        commit({ ...withAnswer, turns: [...withAnswer.turns, t], scores: [...withAnswer.scores, grade.score] });
      }
      setAnswer("");
      setPhase("ready-to-ask");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setPhase("answering");
    }
  }

  if (!session) {
    return <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-400">Loading…</main>;
  }

  const avg = session.scores.length
    ? (session.scores.reduce((a, b) => a + b, 0) / session.scores.length).toFixed(1)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← back
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {session.role} <span className="text-zinc-500">@</span> {session.company}
          </h1>
        </div>
        {avg && (
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-right">
            <div className="text-xs text-zinc-500">avg score</div>
            <div className="text-lg font-semibold">{avg}/10</div>
            <div className="text-xs text-zinc-500">{session.scores.length} graded</div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {session.turns.map((t) => (
          <TurnView key={t.id} turn={t} />
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
        {error && (
          <div className="mb-3 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {phase === "idle" && (
          <button
            onClick={buildCurriculum}
            className="w-full rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Build my study plan
          </button>
        )}

        {phase === "loading-curriculum" && <PhaseStatus label="Searching the web and building your study plan…" />}
        {phase === "loading-question" && <PhaseStatus label="Pulling a question grounded in current sources…" />}
        {phase === "grading" && <PhaseStatus label="Grading your answer…" />}

        {phase === "ready-to-ask" && (
          <button
            onClick={nextQuestion}
            className="w-full rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {session.turns.some((t) => t.kind === "question") ? "Next question" : "Ask me the first question"}
          </button>
        )}

        {phase === "answering" && (
          <div className="flex flex-col gap-2">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              placeholder="Type your answer. Be specific."
              className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
            />
            <button
              onClick={submitAnswer}
              disabled={!answer.trim()}
              className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit for grading
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function PhaseStatus({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {label}
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const label = turn.kind ?? (turn.role === "user" ? "you" : "assistant");
  const tone =
    turn.kind === "curriculum"
      ? "border-sky-900 bg-sky-950/30"
      : turn.kind === "question"
        ? "border-amber-900 bg-amber-950/30"
        : turn.kind === "answer"
          ? "border-zinc-800 bg-zinc-900/40"
          : turn.kind === "grade"
            ? "border-emerald-900 bg-emerald-950/30"
            : "border-zinc-800 bg-zinc-900/40";
  return (
    <div className={`rounded-lg border ${tone} p-4`}>
      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{turn.content}</div>
    </div>
  );
}
