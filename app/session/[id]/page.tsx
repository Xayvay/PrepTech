"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import { getSession, upsertSession, newTurn } from "@/lib/storage";
import { callClaude } from "@/lib/api";

SyntaxHighlighter.registerLanguage("swift", swift);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("scala", scala);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("kotlin", kotlin);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("ruby", ruby);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("shell", bash);

const SUPPORTED_LANGS = new Set([
  "swift", "python", "scala", "typescript", "ts", "javascript", "js",
  "kotlin", "java", "go", "rust", "ruby", "sql", "bash", "shell",
]);

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const lang = language?.toLowerCase();
  if (lang && SUPPORTED_LANGS.has(lang)) {
    return (
      <SyntaxHighlighter
        language={lang}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          background: "rgb(9 9 11)",
          fontSize: "11px",
          padding: "0.5rem 0.75rem",
          borderRadius: "0.25rem",
          lineHeight: "1.6",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-mono, ui-monospace, monospace)" } }}
      >
        {code}
      </SyntaxHighlighter>
    );
  }
  return (
    <pre className="overflow-x-auto rounded bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-200">
      {code}
    </pre>
  );
}
import {
  systemPrompt,
  curriculumMessages,
  questionMessages,
  questionBankMessages,
  parseQuestionBank,
  cheatSheetMessages,
  parseCheatSheet,
  cheatSheetAskCoachMessages,
  gradeMessages,
  parseGrade,
  parseCurriculum,
  isCodingTopic,
  isPairProgrammingTopic,
  pairKickoffMessages,
  pairTurnMessages,
  pairGradeMessages,
  BANK_SCHEMA_VERSION,
  type Curriculum,
  type CurriculumItem,
  type Grade,
} from "@/lib/prompts";
import {
  computeMastery,
  recommendNextTopic,
  masteryStats,
  dayOfPlan,
  leetcodeUrl,
  type Mastery,
  type Recommendation,
} from "@/lib/mastery";
import type { BankEntry, CheatSheetEntry, Session, Turn } from "@/lib/types";

type FocusedTopic = { title: string; isCoding: boolean };

type Phase = "idle" | "loading-curriculum" | "ready-to-ask" | "loading-question" | "answering" | "grading";

type Mode = "transcript" | "drilling" | "pair";

type PairMessage = { id: string; role: "user" | "assistant"; content: string };

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focusedTopic, setFocusedTopic] = useState<FocusedTopic | null>(null);
  const [mode, setMode] = useState<Mode>("transcript");
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [cheatSheetFilter, setCheatSheetFilter] = useState<string | null>(null);
  const [cheatSheetConcept, setCheatSheetConcept] = useState<string | null>(null);
  const [cheatSheetLoading, setCheatSheetLoading] = useState(false);
  const [wasSpoken, setWasSpoken] = useState(false);
  const [pairTurns, setPairTurns] = useState<PairMessage[]>([]);
  const [pairTopic, setPairTopic] = useState<string | null>(null);
  const [pairBusy, setPairBusy] = useState(false);
  const [pairInput, setPairInput] = useState("");
  const autoBuildFired = useRef(false);

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

  useEffect(() => {
    if (autoBuildFired.current) return;
    if (!session || phase !== "idle" || error) return;
    if (session.turns.some((t) => t.kind === "curriculum")) return;
    autoBuildFired.current = true;
    void buildCurriculum();
    // buildCurriculum is stable; intentionally not in deps to keep this fire-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, phase, error]);

  const sys = useMemo(() => (session ? systemPrompt(session) : ""), [session]);

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

  async function nextQuestion(overrideFocus?: FocusedTopic) {
    if (!session) return;
    const focus = overrideFocus ?? focusedTopic;
    setError(null);
    setWasSpoken(false);
    setPhase("loading-question");
    try {
      if (focus) {
        const result = await serveFromBank(session, sys, focus.title);
        commit(result.session);
        setAnswer("");
        setPhase("answering");
        return;
      }

      const res = await callClaude({
        system: sys,
        messages: questionMessages(session, undefined),
        useWebSearch: true,
      });
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

  function drillTopic(item: CurriculumItem) {
    const focus: FocusedTopic = { title: item.title, isCoding: isCodingTopic(item) };
    setFocusedTopic(focus);
    setMode("drilling");
    void nextQuestion(focus);
  }

  function backToPlan() {
    setMode("transcript");
  }

  async function startPairProgramming(item: CurriculumItem) {
    if (!session) return;
    setPairTopic(item.title);
    setPairTurns([]);
    setPairInput("");
    setMode("pair");
    setPairBusy(true);
    setError(null);
    try {
      const res = await callClaude({
        system: sys,
        messages: pairKickoffMessages(session, item.title),
        useWebSearch: false,
      });
      setPairTurns([{ id: crypto.randomUUID(), role: "assistant", content: res.text.trim() }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start pair session");
    } finally {
      setPairBusy(false);
    }
  }

  async function sendPairMessage() {
    if (!session || !pairInput.trim() || !pairTopic) return;
    const userMsg: PairMessage = { id: crypto.randomUUID(), role: "user", content: pairInput.trim() };
    const nextTurns = [...pairTurns, userMsg];
    setPairTurns(nextTurns);
    setPairInput("");
    setPairBusy(true);
    setError(null);
    try {
      const res = await callClaude({
        system: sys,
        messages: pairTurnMessages(
          session,
          nextTurns.map((t) => ({ role: t.role, content: t.content })),
        ),
        useWebSearch: false,
      });
      setPairTurns([
        ...nextTurns,
        { id: crypto.randomUUID(), role: "assistant", content: res.text.trim() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setPairBusy(false);
    }
  }

  async function wrapUpPairAndGrade() {
    if (!session || !pairTopic || pairTurns.length < 2) return;
    setPairBusy(true);
    setError(null);
    try {
      const res = await callClaude({
        system: sys,
        messages: pairGradeMessages(
          session,
          pairTurns.map((t) => ({ role: t.role, content: t.content })),
          pairTopic,
        ),
        useWebSearch: true,
      });
      const grade = parseGrade(res.text);
      const transcriptText =
        `[PAIR SESSION: ${pairTopic}]\n\n` +
        pairTurns
          .map((t) => `${t.role === "assistant" ? "Interviewer" : "Candidate"}: ${t.content}`)
          .join("\n\n");
      const transcriptTurn = newTurn("user", transcriptText, "answer", undefined, pairTopic);
      const gradeTurn = newTurn("assistant", res.text, "grade", grade?.score, pairTopic);
      const nextScores = grade ? [...session.scores, grade.score] : session.scores;
      commit({
        ...session,
        turns: [...session.turns, transcriptTurn, gradeTurn],
        scores: nextScores,
      });
      setMode("transcript");
      setPairTurns([]);
      setPairTopic(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grade");
    } finally {
      setPairBusy(false);
    }
  }

  async function askCoachForEntry(entry: CheatSheetEntry, question: string): Promise<string> {
    if (!session) return "";
    const res = await callClaude({
      system: sys,
      messages: cheatSheetAskCoachMessages(session, entry, question),
      useWebSearch: false,
    });
    return res.text.trim();
  }

  function nextTopicAndDrill() {
    if (!session) return;
    const curriculumTurn = session.turns.find((t) => t.kind === "curriculum");
    const parsed = curriculumTurn ? parseCurriculum(curriculumTurn.content) : null;
    if (!parsed || parsed.items.length === 0) {
      backToPlan();
      return;
    }
    const currentNorm = focusedTopic?.title.trim().toLowerCase();
    const remaining = currentNorm
      ? parsed.items.filter((it) => it.title.trim().toLowerCase() !== currentNorm)
      : parsed.items;
    const pool = remaining.length > 0 ? remaining : parsed.items;
    const rec = recommendNextTopic(session, pool);
    if (rec.kind === "all_done") {
      backToPlan();
      return;
    }
    drillTopic(rec.item);
  }

  function tryAgain() {
    if (!session) return;
    const lastAnswer = [...session.turns].reverse().find((t) => t.kind === "answer");
    if (!lastAnswer) return;
    const unfenced = lastAnswer.content
      .replace(/^```[a-zA-Z0-9_+-]*\n?/, "")
      .replace(/\n?```$/, "");
    setAnswer(unfenced);
    setError(null);
    setWasSpoken(false);
    setPhase("answering");
  }

  function discardQuestion(questionTurn: Turn) {
    if (!session) return;
    const next = session.turns.filter((t) => t.id !== questionTurn.id);
    commit({ ...session, turns: next });
  }

  function redoQuestion(questionTurn: Turn) {
    if (!session || questionTurn.kind !== "question") return;
    const topicTitle = questionTurn.topic;

    let isCoding = false;
    if (topicTitle) {
      const curriculumTurn = session.turns.find((t) => t.kind === "curriculum");
      const parsed = curriculumTurn ? parseCurriculum(curriculumTurn.content) : null;
      const item = parsed?.items.find(
        (it) => it.title.trim().toLowerCase() === topicTitle.trim().toLowerCase(),
      );
      isCoding = item ? isCodingTopic(item) : false;
    }

    const idx = session.turns.findIndex((t) => t.id === questionTurn.id);
    const subsequent = idx === -1 ? [] : session.turns.slice(idx + 1);
    const hasAnswerOrGrade = subsequent.some((t) => t.kind === "answer" || t.kind === "grade");
    const isLatestQuestion = !subsequent.some((t) => t.kind === "question");

    if (!hasAnswerOrGrade && isLatestQuestion) {
      // Resume — never answered, no later question came after. Just enter drilling.
      setFocusedTopic(topicTitle ? { title: topicTitle, isCoding } : null);
      setMode("drilling");
      setAnswer("");
      setWasSpoken(false);
      setError(null);
      setPhase("answering");
      return;
    }

    // Clone for a fresh attempt.
    const cloned: Turn = {
      id: crypto.randomUUID(),
      role: questionTurn.role,
      content: questionTurn.content,
      kind: "question",
      topic: questionTurn.topic,
      source: questionTurn.source,
      concept_tags: questionTurn.concept_tags,
      createdAt: Date.now(),
    };

    commit({ ...session, turns: [...session.turns, cloned] });
    setFocusedTopic(topicTitle ? { title: topicTitle, isCoding } : null);
    setMode("drilling");
    setAnswer("");
    setWasSpoken(false);
    setError(null);
    setPhase("answering");
  }

  function saveCheatSheetNote(entryId: string, note: string) {
    if (!session?.cheatSheet) return;
    const trimmed = note.trim();
    const next = session.cheatSheet.map((e) =>
      e.id === entryId ? { ...e, user_note: trimmed.length > 0 ? trimmed : undefined } : e,
    );
    commit({ ...session, cheatSheet: next });
  }

  async function buildCheatSheetForSession() {
    if (!session) return;
    const curriculumTurn = session.turns.find((t) => t.kind === "curriculum");
    const parsed = curriculumTurn ? parseCurriculum(curriculumTurn.content) : null;
    if (!parsed) {
      setError("Build the study plan first — the cheat sheet uses it as input.");
      return;
    }
    setError(null);
    setCheatSheetLoading(true);
    try {
      const res = await callClaude({
        system: sys,
        messages: cheatSheetMessages(session, parsed),
        useWebSearch: true,
      });
      const entries = parseCheatSheet(res.text);
      if (!entries) {
        setError("Could not parse cheat sheet response. Try again.");
        return;
      }
      const stored: CheatSheetEntry[] = entries.map((e) => ({ ...e, id: crypto.randomUUID() }));
      commit({ ...session, cheatSheet: stored });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build cheat sheet");
    } finally {
      setCheatSheetLoading(false);
    }
  }

  async function openCheatSheet(filterTopic?: string, filterConcept?: string) {
    if (!session) return;
    setCheatSheetFilter(filterTopic ?? null);
    setCheatSheetConcept(filterConcept ?? null);
    setCheatSheetOpen(true);
    if (session.cheatSheet && session.cheatSheet.length > 0) return;
    await buildCheatSheetForSession();
  }

  async function rebuildCheatSheet() {
    await buildCheatSheetForSession();
  }

  async function submitAnswer() {
    if (!session || !answer.trim()) return;
    setError(null);
    setPhase("grading");
    const codingLang = focusedTopic?.isCoding ? (session.languages?.split(",")[0]?.trim() || "") : "";
    const storedAnswer =
      focusedTopic?.isCoding
        ? `\`\`\`${codingLang}\n${answer.trim()}\n\`\`\``
        : answer.trim();
    const answerTurn = newTurn("user", storedAnswer, "answer", undefined, focusedTopic?.title);
    const withAnswer: Session = { ...session, turns: [...session.turns, answerTurn] };
    commit(withAnswer);

    const wasSpokenForThisAnswer = wasSpoken;
    try {
      const res = await callClaude({
        system: sys,
        messages: gradeMessages(withAnswer, storedAnswer, { wasSpoken: wasSpokenForThisAnswer }),
        useWebSearch: true,
      });
      const grade = parseGrade(res.text);
      const t = newTurn("assistant", res.text, "grade", grade?.score, focusedTopic?.title);
      const nextScores = grade ? [...withAnswer.scores, grade.score] : withAnswer.scores;
      commit({ ...withAnswer, turns: [...withAnswer.turns, t], scores: nextScores });
      setAnswer("");
      setWasSpoken(false);
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

  const codingLanguage = focusedTopic?.isCoding
    ? session.languages?.split(",")[0]?.trim() || "code"
    : undefined;

  if (mode === "pair") {
    return (
      <>
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6">
          <div className="sticky top-0 z-20 -mx-6 bg-zinc-950/95 backdrop-blur">
            <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-6 py-3">
              <button
                onClick={() => {
                  setMode("transcript");
                  setPairTurns([]);
                  setPairTopic(null);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                ← Back to study plan
              </button>
              <div className="min-w-0 flex-1 truncate text-center text-sm text-zinc-200">
                Pair session: {pairTopic ?? "—"}
                <span className="ml-2 rounded bg-purple-900/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-purple-200">
                  pair
                </span>
              </div>
              <button
                onClick={() => openCheatSheet(pairTopic ?? undefined)}
                className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                title="Open cheat sheet"
              >
                📖
              </button>
            </header>
          </div>

          <div className="flex-1 space-y-3 py-4">
            {error && (
              <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            {pairTurns.length === 0 && pairBusy && (
              <PhaseStatus label="Starting the pair-programming session…" />
            )}
            {pairTurns.map((t) => (
              <div
                key={t.id}
                className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm leading-relaxed ${
                    t.role === "user"
                      ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-100"
                      : "border-purple-900/60 bg-purple-950/40 text-zinc-100"
                  }`}
                >
                  <div className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
                    {t.role === "user" ? "you" : "interviewer"}
                  </div>
                  <div className="whitespace-pre-wrap">{t.content}</div>
                </div>
              </div>
            ))}
            {pairBusy && pairTurns.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg border border-purple-900/60 bg-purple-950/40 px-3 py-2 text-sm">
                  <PhaseStatus label="Thinking…" />
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
            <AnswerInput
              value={pairInput}
              onChange={setPairInput}
              onSubmit={sendPairMessage}
              codingLanguage={undefined}
              onSpeechCaptured={() => setWasSpoken(true)}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <button
                onClick={wrapUpPairAndGrade}
                disabled={pairBusy || pairTurns.length < 2}
                className="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                title="End the session and get a graded review"
              >
                Wrap up & grade →
              </button>
              <button
                onClick={() => {
                  setMode("transcript");
                  setPairTurns([]);
                  setPairTopic(null);
                }}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
              >
                Discard & back
              </button>
            </div>
          </div>
        </main>
        <CheatSheetDrawer
          open={cheatSheetOpen}
          loading={cheatSheetLoading}
          entries={session.cheatSheet}
          filterTopic={cheatSheetFilter}
          filterConcept={cheatSheetConcept}
          onClose={() => setCheatSheetOpen(false)}
          onRebuild={rebuildCheatSheet}
          onSaveNote={saveCheatSheetNote}
          onAskCoach={askCoachForEntry}
        />
      </>
    );
  }

  if (mode === "drilling") {
    const lastQuestion = [...session.turns].reverse().find((t) => t.kind === "question");
    const lastTurn = session.turns[session.turns.length - 1];
    const latestGrade =
      lastTurn?.kind === "grade" ? parseGrade(lastTurn.content) : null;

    return (
      <>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6">
        <div className="sticky top-0 z-20 -mx-6 bg-zinc-950/95 backdrop-blur">
          <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-6 py-3">
            <button
              onClick={backToPlan}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              ← Back to study plan
            </button>
            <div className="min-w-0 flex-1 truncate text-center text-sm text-zinc-200">
              {focusedTopic?.title ?? "Drilling"}
              {focusedTopic?.isCoding && (
                <span className="ml-2 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
                  code
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => openCheatSheet(focusedTopic?.title)}
                className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                title="Open cheat sheet"
              >
                📖 Cheat sheet
              </button>
              {avg && (
                <span className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-xs">
                  <span className="text-zinc-500">avg</span> <span className="font-semibold">{avg}</span>
                  <span className="text-zinc-500">/10</span>
                </span>
              )}
            </div>
          </header>

          {lastQuestion && (
            <div className="max-h-[40vh] overflow-y-auto border-b border-amber-900/40 bg-amber-950/30 px-6 py-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-amber-400">Question</div>
                {focusedTopic && (() => {
                  const bank = session.questionBanks?.[focusedTopic.title];
                  if (!bank || bank.length === 0) return null;
                  const usedCount = bank.filter((e) => e.used).length;
                  return (
                    <span className="text-[10px] text-zinc-500">
                      {usedCount} of {bank.length} from this bank
                    </span>
                  );
                })()}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                {lastQuestion.content}
              </div>
              {lastQuestion.source && (
                <div className="mt-2 text-[11px] text-zinc-500">
                  Source:{" "}
                  {lastQuestion.source.url ? (
                    <a
                      href={lastQuestion.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                    >
                      {lastQuestion.source.description} ↗
                    </a>
                  ) : (
                    <span className="text-zinc-400">{lastQuestion.source.description}</span>
                  )}
                </div>
              )}
              {lastQuestion.concept_tags && lastQuestion.concept_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-500">Tags:</span>
                  {lastQuestion.concept_tags.map((tag, i) => (
                    <button
                      key={i}
                      onClick={() => openCheatSheet(lastQuestion.topic ?? focusedTopic?.title, tag)}
                      className="rounded-full border border-sky-900/60 bg-sky-950/40 px-2 py-0.5 text-sky-200 hover:bg-sky-950/70"
                      title={`Open cheat sheet at ${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                  <span className="text-zinc-500">— click a tag to open the cheat sheet</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 py-4">
          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {phase === "loading-question" && (
            <PhaseStatus label="Pulling a question grounded in current sources…" />
          )}
          {phase === "grading" && <PhaseStatus label="Grading your answer (searching for resources)…" />}

          {phase === "ready-to-ask" && latestGrade && (
            <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-4">
              <GradeView grade={latestGrade} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
          {phase === "answering" && (
            <AnswerInput
              value={answer}
              onChange={setAnswer}
              onSubmit={submitAnswer}
              codingLanguage={codingLanguage}
              onSpeechCaptured={() => setWasSpoken(true)}
            />
          )}

          {phase === "ready-to-ask" && (
            <div className="flex flex-col gap-2">
              <button
                onClick={nextTopicAndDrill}
                className="w-full rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400"
              >
                Next topic →
              </button>
              <div className="flex flex-wrap gap-2 text-sm">
                <button
                  onClick={() => nextQuestion()}
                  className="flex-1 rounded-md border border-sky-900/60 bg-sky-950/40 px-3 py-1.5 text-sky-200 hover:bg-sky-950/60"
                >
                  Another question on this topic
                </button>
                {latestGrade && (
                  <button
                    onClick={tryAgain}
                    className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-amber-200 hover:bg-amber-950/60"
                  >
                    Try this again
                  </button>
                )}
                <button
                  onClick={backToPlan}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
                >
                  Back to plan
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <CheatSheetDrawer
        open={cheatSheetOpen}
        loading={cheatSheetLoading}
        entries={session.cheatSheet}
        filterTopic={cheatSheetFilter}
        filterConcept={cheatSheetConcept}
        onClose={() => setCheatSheetOpen(false)}
        onRebuild={rebuildCheatSheet}
        onSaveNote={saveCheatSheetNote}
        onAskCoach={askCoachForEntry}
      />
      </>
    );
  }

  return (
    <>
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
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => openCheatSheet()}
            className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
            title="Open cheat sheet"
          >
            📖 Cheat sheet
          </button>
          {avg && (
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-right">
              <div className="text-xs text-zinc-500">avg score</div>
              <div className="text-lg font-semibold">{avg}/10</div>
              <div className="text-xs text-zinc-500">{session.scores.length} graded</div>
            </div>
          )}
        </div>
      </div>

      {(() => {
        const curriculumTurn = session.turns.find((t) => t.kind === "curriculum");
        const parsed = curriculumTurn ? parseCurriculum(curriculumTurn.content) : null;
        if (!parsed) return null;
        return <TodayPanel session={session} curriculum={parsed} onStart={drillTopic} />;
      })()}

      <div className="space-y-4">
        {session.turns.map((t) => (
          <TurnView
            key={t.id}
            turn={t}
            session={session}
            onDrillTopic={drillTopic}
            onPairProgram={startPairProgramming}
            onRedoQuestion={redoQuestion}
            onDiscardQuestion={discardQuestion}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 -mx-6 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
        {error && (
          <div className="mb-3 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {focusedTopic && phase !== "loading-curriculum" && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-sky-900/60 bg-sky-950/40 px-3 py-1.5 text-xs">
            <span className="truncate text-sky-100">
              <span className="text-sky-400">Focused on:</span> {focusedTopic.title}
              {focusedTopic.isCoding && (
                <span className="ml-2 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
                  code
                </span>
              )}
            </span>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={() => setMode("drilling")}
                className="text-sky-300 hover:text-sky-200"
                title="Resume drilling"
              >
                resume
              </button>
              <button
                onClick={() => setFocusedTopic(null)}
                className="text-zinc-400 hover:text-zinc-200"
                title="Clear focus"
              >
                clear
              </button>
            </div>
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

        {phase === "ready-to-ask" && !focusedTopic && (
          <button
            onClick={() => {
              setMode("drilling");
              void nextQuestion();
            }}
            className="w-full rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {session.turns.some((t) => t.kind === "question") ? "Next question" : "Ask me the first question"}
          </button>
        )}
      </div>
    </main>
    <CheatSheetDrawer
      open={cheatSheetOpen}
      loading={cheatSheetLoading}
      entries={session.cheatSheet}
      filterTopic={cheatSheetFilter}
      filterConcept={cheatSheetConcept}
      onClose={() => setCheatSheetOpen(false)}
      onRebuild={rebuildCheatSheet}
      onSaveNote={saveCheatSheetNote}
    />
    </>
  );
}

async function serveFromBank(
  session: Session,
  sys: string,
  topicTitle: string,
): Promise<{ session: Session }> {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const banks = session.questionBanks ?? {};
  const seenAll = session.seenQuestions ?? {};
  const bank = banks[topicTitle] ?? [];
  const seenForTopic = seenAll[topicTitle] ?? [];

  const newestCreatedAt = bank.reduce(
    (acc, e) => Math.max(acc, e.createdAt ?? 0),
    0,
  );
  const bankIsStale = bank.length > 0 && Date.now() - newestCreatedAt > DAY_MS;

  const unused = bankIsStale
    ? undefined
    : bank.find((e) => !e.used && (e.schemaVersion ?? 1) >= BANK_SCHEMA_VERSION);

  if (unused) {
    const t = newTurn("assistant", unused.content, "question", undefined, topicTitle);
    if (unused.source) t.source = unused.source;
    if (unused.concept_tags && unused.concept_tags.length > 0) t.concept_tags = unused.concept_tags;
    const updatedBank = bank.map((e) =>
      e.id === unused.id ? { ...e, used: true, usedAt: Date.now() } : e,
    );
    const updatedSeen = seenForTopic.includes(unused.content)
      ? seenForTopic
      : [...seenForTopic, unused.content];
    return {
      session: {
        ...session,
        turns: [...session.turns, t],
        questionBanks: { ...banks, [topicTitle]: updatedBank },
        seenQuestions: { ...seenAll, [topicTitle]: updatedSeen },
      },
    };
  }

  const alreadySeen = Array.from(new Set([...seenForTopic, ...bank.map((e) => e.content)]));
  const res = await callClaude({
    system: sys,
    messages: questionBankMessages(session, topicTitle, alreadySeen),
    useWebSearch: true,
  });
  const parsed = parseQuestionBank(res.text);

  if (!parsed || parsed.length === 0) {
    const fallback = await callClaude({
      system: sys,
      messages: questionMessages(session, topicTitle),
      useWebSearch: true,
    });
    const t = newTurn("assistant", fallback.text, "question", undefined, topicTitle);
    const updatedSeen = [...seenForTopic, fallback.text];
    return {
      session: {
        ...session,
        turns: [...session.turns, t],
        seenQuestions: { ...seenAll, [topicTitle]: updatedSeen },
      },
    };
  }

  const buildTime = Date.now();
  const newEntries: BankEntry[] = parsed.map((p) => ({
    id: crypto.randomUUID(),
    content: p.content,
    source: p.source,
    concept_tags: p.concept_tags,
    schemaVersion: BANK_SCHEMA_VERSION,
    used: false,
    createdAt: buildTime,
  }));
  const [first, ...rest] = newEntries;
  const firstUsed: BankEntry = { ...first, used: true, usedAt: Date.now() };
  const t = newTurn("assistant", first.content, "question", undefined, topicTitle);
  if (first.source) t.source = first.source;
  if (first.concept_tags && first.concept_tags.length > 0) t.concept_tags = first.concept_tags;
  const replacedBank = [firstUsed, ...rest];
  const updatedSeen = [...seenForTopic, ...newEntries.map((e) => e.content)];
  return {
    session: {
      ...session,
      turns: [...session.turns, t],
      questionBanks: { ...banks, [topicTitle]: replacedBank },
      seenQuestions: { ...seenAll, [topicTitle]: updatedSeen },
    },
  };
}

function PhaseStatus({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {label}
    </div>
  );
}

function TurnView({
  turn,
  session,
  onDrillTopic,
  onPairProgram,
  onRedoQuestion,
  onDiscardQuestion,
}: {
  turn: Turn;
  session: Session;
  onDrillTopic: (item: CurriculumItem) => void;
  onPairProgram: (item: CurriculumItem) => void;
  onRedoQuestion: (turn: Turn) => void;
  onDiscardQuestion: (turn: Turn) => void;
}) {
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

  if (turn.kind === "curriculum") {
    const parsed = parseCurriculum(turn.content);
    if (parsed) {
      return (
        <div className={`rounded-lg border ${tone} p-4`}>
          <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">study plan</div>
          <CurriculumView
            curriculum={parsed}
            session={session}
            onDrillTopic={onDrillTopic}
            onPairProgram={onPairProgram}
          />
        </div>
      );
    }
  }

  if (turn.kind === "grade") {
    const grade = parseGrade(turn.content);
    if (grade) {
      return (
        <div className={`rounded-lg border ${tone} p-4`}>
          <GradeView grade={grade} />
        </div>
      );
    }
  }

  if (turn.kind === "answer" && turn.content.startsWith("```")) {
    return (
      <div className={`rounded-lg border ${tone} p-4`}>
        <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">your answer</div>
        <pre className="overflow-x-auto rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-200">
          {turn.content.replace(/^```[a-zA-Z0-9_+-]*\n?/, "").replace(/\n?```$/, "")}
        </pre>
      </div>
    );
  }

  if (turn.kind === "question") {
    const idx = session.turns.findIndex((t) => t.id === turn.id);
    const subsequent = idx === -1 ? [] : session.turns.slice(idx + 1);
    const hasAnswerOrGrade = subsequent.some((t) => t.kind === "answer" || t.kind === "grade");
    const unanswered = !hasAnswerOrGrade;
    return (
      <div className={`rounded-lg border ${tone} p-4`}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-amber-400">
            question{unanswered ? " · unanswered" : ""}
          </span>
          <div className="flex items-center gap-2">
            {turn.topic && (
              <button
                onClick={() => onRedoQuestion(turn)}
                className="rounded-md border border-amber-700/60 bg-amber-950/60 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-950/80"
                title={unanswered ? "Continue this unfinished question" : "Drill this question again"}
              >
                {unanswered ? "Continue this question →" : "Drill again →"}
              </button>
            )}
            {unanswered && (
              <button
                onClick={() => onDiscardQuestion(turn)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                title="Discard this unanswered question from history"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{turn.content}</div>
        {turn.source && (
          <div className="mt-2 text-[11px] text-zinc-500">
            Source:{" "}
            {turn.source.url ? (
              <a
                href={turn.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                {turn.source.description} ↗
              </a>
            ) : (
              <span className="text-zinc-400">{turn.source.description}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${tone} p-4`}>
      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{turn.content}</div>
    </div>
  );
}

function CurriculumView({
  curriculum,
  session,
  onDrillTopic,
  onPairProgram,
}: {
  curriculum: Curriculum;
  session: Session;
  onDrillTopic: (item: CurriculumItem) => void;
  onPairProgram: (item: CurriculumItem) => void;
}) {
  return (
    <div className="space-y-2">
      {curriculum.items.map((item) => {
        const mastery = computeMastery(session, item.title);
        const coding = isCodingTopic(item);
        const pairable = isPairProgrammingTopic(item);
        return (
        <details
          key={item.number}
          className="group rounded-md border border-sky-900/60 bg-sky-950/20 transition open:bg-sky-950/40"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-900/60 text-xs font-semibold text-sky-200">
              {item.number}
            </span>
            <MasteryDot mastery={mastery} />
            <span className="flex-1 text-sm font-medium text-zinc-100">{item.title}</span>
            <svg
              className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <div className="border-t border-sky-900/40 px-3 py-3 text-sm leading-relaxed text-zinc-200">
            <InlineMarkdown text={item.body} />
            {item.resource && (
              <div className="mt-3 rounded-md border border-sky-900/50 bg-sky-950/40 px-3 py-2 text-xs text-sky-100">
                <span className="mr-1 font-semibold uppercase tracking-wide text-sky-300">Resource</span>
                <span className="text-zinc-200">
                  <InlineMarkdown text={item.resource} />
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onDrillTopic(item)}
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-sky-950 hover:bg-sky-400"
              >
                Drill this topic →
              </button>
              {pairable && (
                <button
                  onClick={() => onPairProgram(item)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-purple-500 px-3 py-1.5 text-xs font-medium text-purple-950 hover:bg-purple-400"
                >
                  Pair-program this →
                </button>
              )}
              {coding && (
                <a
                  href={leetcodeUrl(item.title)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Drill more on LeetCode ↗
                </a>
              )}
            </div>
          </div>
        </details>
        );
      })}

      {curriculum.sources.length > 0 && (
        <details className="group mt-3 rounded-md border border-zinc-800 bg-zinc-950/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs uppercase tracking-wide text-zinc-500 [&::-webkit-details-marker]:hidden">
            <span>Sources ({curriculum.sources.length})</span>
            <svg
              className="h-4 w-4 transition group-open:rotate-180"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <ul className="space-y-1.5 border-t border-zinc-800 px-3 py-3 text-xs">
            {curriculum.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 underline-offset-2 hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CheatSheetDrawer({
  open,
  loading,
  entries,
  filterTopic,
  filterConcept,
  onClose,
  onRebuild,
  onSaveNote,
  onAskCoach,
}: {
  open: boolean;
  loading: boolean;
  entries: CheatSheetEntry[] | undefined;
  filterTopic: string | null;
  filterConcept: string | null;
  onClose: () => void;
  onRebuild: () => void;
  onSaveNote: (entryId: string, note: string) => void;
  onAskCoach: (entry: CheatSheetEntry, question: string) => Promise<string>;
}) {
  const entryRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const matchedEntryId = useMemo(() => {
    if (!filterConcept || !entries || entries.length === 0) return null;
    const fc = filterConcept.trim().toLowerCase();
    const tn = filterTopic?.trim().toLowerCase();
    const fcEsc = fc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fcLeading = new RegExp(`^${fcEsc}(?:\\W|$)`, "i");

    function exactMatch(e: CheatSheetEntry) {
      return e.concept.trim().toLowerCase() === fc;
    }
    function leadingMatch(e: CheatSheetEntry) {
      const cn = e.concept.trim().toLowerCase();
      if (fcLeading.test(cn)) return true;
      const cnEsc = cn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const cnLeading = new RegExp(`^${cnEsc}(?:\\W|$)`, "i");
      return cnLeading.test(fc);
    }

    const inTopic = (e: CheatSheetEntry) => !tn || e.topic.trim().toLowerCase() === tn;

    return (
      entries.find((e) => inTopic(e) && exactMatch(e))?.id ??
      entries.find((e) => inTopic(e) && leadingMatch(e))?.id ??
      entries.find((e) => exactMatch(e))?.id ??
      entries.find((e) => leadingMatch(e))?.id ??
      null
    );
  }, [filterConcept, filterTopic, entries]);

  useEffect(() => {
    if (!open || !matchedEntryId) return;
    const el = entryRefs.current.get(matchedEntryId);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [open, matchedEntryId, entries]);

  if (!open) return null;

  const grouped: Record<string, CheatSheetEntry[]> = {};
  if (entries) {
    for (const e of entries) {
      grouped[e.topic] = grouped[e.topic] ?? [];
      grouped[e.topic].push(e);
    }
  }
  const topics = Object.keys(grouped);
  const filterNorm = filterTopic?.trim().toLowerCase();
  const orderedTopics = filterNorm
    ? [
        ...topics.filter((t) => t.trim().toLowerCase() === filterNorm),
        ...topics.filter((t) => t.trim().toLowerCase() !== filterNorm),
      ]
    : topics;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Cheat sheet</h2>
            {filterTopic && (
              <div className="mt-0.5 text-xs text-zinc-500">
                Focused on: {filterTopic}
                {filterConcept && (
                  <span className="text-sky-300"> · {filterConcept}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRebuild}
              disabled={loading}
              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              title="Rebuild cheat sheet"
            >
              {loading ? "rebuilding…" : "rebuild ↻"}
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              aria-label="Close cheat sheet"
            >
              close ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400" />
              Building cheat sheet from your curriculum (this takes ~20-25s the first time)…
            </div>
          )}
          {!loading && entries && entries.length === 0 && (
            <div className="text-sm text-zinc-500">No entries — try regenerating.</div>
          )}
          {!loading && entries && entries.length > 0 && (
            <div className="space-y-6">
              {orderedTopics.map((topic) => {
                const isFiltered = filterNorm && topic.trim().toLowerCase() === filterNorm;
                return (
                  <section key={topic}>
                    <h3
                      className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                        isFiltered ? "text-sky-300" : "text-zinc-500"
                      }`}
                    >
                      {topic}
                    </h3>
                    <div className="space-y-3">
                      {grouped[topic].map((e) => (
                        <CheatSheetEntryView
                          key={e.id}
                          entry={e}
                          onSaveNote={onSaveNote}
                          onAskCoach={onAskCoach}
                          highlighted={e.id === matchedEntryId}
                          registerRef={(el) => entryRefs.current.set(e.id, el)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function CheatSheetEntryView({
  entry,
  onSaveNote,
  onAskCoach,
  highlighted,
  registerRef,
}: {
  entry: CheatSheetEntry;
  onSaveNote: (entryId: string, note: string) => void;
  onAskCoach: (entry: CheatSheetEntry, question: string) => Promise<string>;
  highlighted?: boolean;
  registerRef?: (el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState(entry.user_note ?? "");
  const [askingCoach, setAskingCoach] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);

  useEffect(() => {
    setDraftNote(entry.user_note ?? "");
  }, [entry.user_note]);

  function commitNote() {
    onSaveNote(entry.id, draftNote);
    setEditing(false);
  }

  async function submitCoachQuestion() {
    if (!coachQuestion.trim()) return;
    setCoachBusy(true);
    try {
      const answer = await onAskCoach(entry, coachQuestion.trim());
      const prior = entry.user_note ?? "";
      const block = `**Q:** ${coachQuestion.trim()}\n\n${answer}`;
      const merged = prior.length > 0 ? `${prior}\n\n---\n\n${block}` : block;
      onSaveNote(entry.id, merged);
      setCoachQuestion("");
      setAskingCoach(false);
    } catch {
      // error surfaced elsewhere
    } finally {
      setCoachBusy(false);
    }
  }

  return (
    <div
      ref={registerRef}
      className={`rounded-md border p-3 transition ${
        highlighted
          ? "border-sky-500 bg-sky-950/30 ring-2 ring-sky-500/40"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold text-zinc-100">{entry.concept}</span>
        {entry.language && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            {entry.language}
          </span>
        )}
      </div>
      {entry.when_to_use && (
        <p className="mb-2 text-xs leading-relaxed text-zinc-300">{entry.when_to_use}</p>
      )}
      <CodeBlock code={entry.syntax} language={entry.language} />
      {entry.gotcha && (
        <p className="mt-2 text-[11px] italic leading-relaxed text-amber-300/90">
          <span className="font-semibold not-italic text-amber-400">Gotcha:</span> {entry.gotcha}
        </p>
      )}

      {!editing && entry.user_note && (
        <div className="mt-2 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-[11px] leading-relaxed text-emerald-100">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Your note</span>
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-emerald-300/70 hover:text-emerald-200"
            >
              edit
            </button>
          </div>
          <div className="whitespace-pre-wrap">{entry.user_note}</div>
        </div>
      )}

      {!editing && !askingCoach && (
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          <button
            onClick={() => setEditing(true)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            + {entry.user_note ? "Edit your note" : "Add your note"}
          </button>
          <button
            onClick={() => setAskingCoach(true)}
            className="text-purple-400 hover:text-purple-300"
          >
            + Ask the coach
          </button>
        </div>
      )}

      {askingCoach && (
        <div className="mt-2 rounded-md border border-purple-900/50 bg-purple-950/30 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-purple-400">
            Ask the coach about {entry.concept}
          </div>
          <textarea
            value={coachQuestion}
            onChange={(e) => setCoachQuestion(e.target.value)}
            rows={2}
            autoFocus
            disabled={coachBusy}
            placeholder="e.g. when would I pick this over async/await? what about cancellation?"
            className="w-full rounded border border-purple-900/50 bg-zinc-950 px-2 py-1 text-[11px] leading-relaxed text-zinc-200 outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <div className="mt-1 flex justify-end gap-2 text-[10px]">
            <button
              disabled={coachBusy}
              onClick={() => {
                setAskingCoach(false);
                setCoachQuestion("");
              }}
              className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
            >
              cancel
            </button>
            <button
              disabled={coachBusy || !coachQuestion.trim()}
              onClick={submitCoachQuestion}
              className="text-purple-300 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {coachBusy ? "asking…" : "ask"}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-2">
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onBlur={commitNote}
            autoFocus
            rows={3}
            placeholder="e.g. in our codebase we use OperationQueue here because…"
            className="w-full rounded-md border border-emerald-900/50 bg-zinc-950 px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-200 outline-none focus:border-emerald-600"
          />
          <div className="mt-1 flex justify-end gap-2 text-[10px]">
            <button
              onClick={() => {
                setDraftNote(entry.user_note ?? "");
                setEditing(false);
              }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              cancel
            </button>
            <button
              onClick={commitNote}
              className="text-emerald-400 hover:text-emerald-300"
            >
              save (or click out)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MasteryDot({ mastery }: { mastery: Mastery }) {
  const cls =
    mastery === "green"
      ? "bg-emerald-500 ring-emerald-500/30"
      : mastery === "amber"
        ? "bg-amber-500 ring-amber-500/30"
        : mastery === "red"
          ? "bg-red-500 ring-red-500/30"
          : "bg-zinc-700 ring-zinc-700/30";
  const label =
    mastery === "green"
      ? "Mastered"
      : mastery === "amber"
        ? "In progress"
        : mastery === "red"
          ? "Needs work"
          : "Not started";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ring-2 ${cls}`}
      title={label}
      aria-label={label}
    />
  );
}

function TodayPanel({
  session,
  curriculum,
  onStart,
}: {
  session: Session;
  curriculum: Curriculum;
  onStart: (item: CurriculumItem) => void;
}) {
  const { day, total } = dayOfPlan(session);
  const stats = masteryStats(session, curriculum.items);
  const rec: Recommendation = recommendNextTopic(session, curriculum.items);

  if (rec.kind === "all_done") {
    return (
      <div className="mb-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-4">
        <div className="text-sm font-medium text-emerald-200">All topics mastered.</div>
        <div className="mt-1 text-xs text-zinc-400">
          You&apos;ve hit 3+ strong scores on every item. Run a real mock interview (interviewing.io / pramp) before
          your loop.
        </div>
      </div>
    );
  }

  const label =
    rec.kind === "revisit"
      ? "Revisit (you struggled with this last time)"
      : rec.kind === "next"
        ? "Today"
        : "Refresh";
  const labelTone =
    rec.kind === "revisit" ? "text-amber-400" : rec.kind === "refresh" ? "text-zinc-400" : "text-sky-400";

  return (
    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-400">
          Day <span className="font-semibold text-zinc-200">{day}</span> of {total}
        </span>
        <span className="text-zinc-400">
          <span className="font-semibold text-zinc-200">{stats.mastered}</span> of {stats.total} topics mastered
        </span>
      </div>
      <div className={`text-xs font-semibold uppercase tracking-wide ${labelTone}`}>{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{rec.item.title}</div>
      {rec.kind === "revisit" && (
        <div className="mt-1 text-xs text-zinc-500">Last score: {rec.lastScore}/10 — try again with fresh eyes.</div>
      )}
      <button
        onClick={() => onStart(rec.item)}
        className="mt-3 w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
      >
        Start today&apos;s drill →
      </button>
    </div>
  );
}

function GradeView({ grade }: { grade: Grade }) {
  const scoreColor =
    grade.score >= 8
      ? "text-emerald-300"
      : grade.score >= 5
        ? "text-amber-300"
        : "text-red-300";
  const barColor =
    grade.score >= 8 ? "bg-emerald-400" : grade.score >= 5 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-zinc-500">grade</span>
          <span className={`text-2xl font-semibold tabular-nums ${scoreColor}`}>{grade.score}/10</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${grade.score * 10}%` }} />
        </div>
      </div>

      {grade.strengths.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            What you nailed
          </div>
          <ul className="space-y-1 text-sm text-zinc-200">
            {grade.strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>
                  <InlineMarkdown text={s} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.gaps.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-400">
            Where you&apos;re weak
          </div>
          <ul className="space-y-1 text-sm text-zinc-200">
            {grade.gaps.map((g, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-red-500">✗</span>
                <span>
                  <InlineMarkdown text={g} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.communication && (() => {
        const cs = grade.communication.score;
        const csColor =
          cs >= 8 ? "text-emerald-300" : cs >= 5 ? "text-amber-300" : "text-red-300";
        const csBar = cs >= 8 ? "bg-emerald-400" : cs >= 5 ? "bg-amber-400" : "bg-red-400";
        return (
          <div className="rounded-md border border-purple-900/50 bg-purple-950/30 px-3 py-2.5">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">
                🎙️ How you communicated
              </div>
              <span className={`text-sm font-semibold tabular-nums ${csColor}`}>{cs}/10</span>
            </div>
            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full ${csBar}`} style={{ width: `${cs * 10}%` }} />
            </div>
            {grade.communication.notes && (
              <div className="text-sm leading-relaxed text-zinc-200">
                <InlineMarkdown text={grade.communication.notes} />
              </div>
            )}
          </div>
        );
      })()}

      {grade.improvements.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-400">
            Get better at this
          </div>
          <ul className="space-y-2.5">
            {grade.improvements.map((imp, i) => (
              <li
                key={i}
                className="rounded-md border border-sky-900/50 bg-sky-950/30 px-3 py-2 text-sm"
              >
                {imp.skill && (
                  <div className="font-medium text-zinc-100">
                    <InlineMarkdown text={imp.skill} />
                  </div>
                )}
                {imp.how && (
                  <div className="mt-1 text-zinc-300">
                    <InlineMarkdown text={imp.how} />
                  </div>
                )}
                {imp.resource && (
                  <a
                    href={imp.resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-sky-400 underline-offset-2 hover:underline"
                  >
                    <span>📖</span>
                    {imp.resource.title}
                    <span className="text-sky-600">↗</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.follow_up && (
        <div className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm">
          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Follow-up
          </div>
          <div className="text-zinc-200">
            <InlineMarkdown text={grade.follow_up} />
          </div>
        </div>
      )}

      {grade.nudge && (
        <div className="border-t border-zinc-800 pt-3 text-sm italic leading-relaxed text-zinc-300">
          <InlineMarkdown text={grade.nudge} />
        </div>
      )}
    </div>
  );
}

function AnswerInput({
  value,
  onChange,
  onSubmit,
  codingLanguage,
  onSpeechCaptured,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  codingLanguage?: string;
  onSpeechCaptured?: () => void;
}) {
  const isCoding = !!codingLanguage;
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supportsSpeech =
    typeof window !== "undefined" &&
    (typeof (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition !== "undefined" ||
      typeof (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition !== "undefined");

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  function startListening() {
    if (!supportsSpeech) return;
    setSpeechError(null);
    const Ctor =
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim().length > 0) {
        const current = valueRef.current;
        const sep = current.length > 0 && !/\s$/.test(current) ? " " : "";
        onChange(current + sep + finalText.trim());
        onSpeechCaptured?.();
      }
    };
    rec.onerror = (event: { error?: string }) => {
      setSpeechError(event.error ? `mic: ${event.error}` : "mic error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setSpeechError(e instanceof Error ? e.message : "could not start mic");
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }

  const showMic = !isCoding && supportsSpeech;

  return (
    <div className="flex flex-col gap-2">
      {(isCoding || showMic) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {isCoding ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-zinc-300">
                <span className="text-zinc-500">lang:</span> {codingLanguage}
              </span>
              <span className="text-zinc-500">Tab inserts spaces · code is fenced before grading</span>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition ${
                  listening
                    ? "border-red-700 bg-red-950/60 text-red-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
                title={listening ? "Stop listening" : "Talk your answer out — we'll grade communication too"}
              >
                {listening ? (
                  <>
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
                    Listening… click to stop
                  </>
                ) : (
                  <>🎙️ Talk it out</>
                )}
              </button>
              <span className="text-zinc-500">
                {listening ? "speak naturally; you can also type" : "spoken answers get a communication score too"}
              </span>
            </>
          )}
        </div>
      )}
      {speechError && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-2.5 py-1 text-[11px] text-red-200">
          {speechError}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (isCoding && e.key === "Tab") {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const next = value.slice(0, start) + "  " + value.slice(end);
            onChange(next);
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = start + 2;
            });
          }
        }}
        rows={isCoding ? 12 : 4}
        placeholder={
          isCoding
            ? "// type your solution"
            : listening
              ? "transcribing… you can also type"
              : "Type your answer — or click 🎙️ to talk it out."
        }
        className={`w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600 ${
          isCoding ? "font-mono text-xs leading-relaxed" : "text-sm"
        }`}
        spellCheck={!isCoding}
      />
      <button
        onClick={() => {
          if (listening) stopListening();
          onSubmit();
        }}
        disabled={!value.trim()}
        className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit for grading
      </button>
    </div>
  );
}

type SpeechRecognitionResultItemLike = { transcript: string };
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionResultItemLike> & { isFinal: boolean };
type SpeechRecognitionResultsLike = ArrayLike<SpeechRecognitionResultLike>;
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultsLike;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function InlineMarkdown({ text }: { text: string }) {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*\n]+)\*\*/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) nodes.push(text.slice(lastIdx, m.index));
    if (m[2]) {
      nodes.push(
        <a
          key={key++}
          href={m[2]}
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline-offset-2 hover:underline"
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-zinc-100">
          {m[3]}
        </strong>,
      );
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) nodes.push(text.slice(lastIdx));
  return <>{nodes}</>;
}
