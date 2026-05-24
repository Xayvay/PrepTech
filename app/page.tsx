"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listSessions,
  newSession,
  upsertSession,
  setActiveSessionId,
  deleteSession,
} from "@/lib/storage";
import type { InterviewType, Session } from "@/lib/types";

const INTERVIEW_TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
  { value: "coding", label: "Coding" },
  { value: "system_design", label: "System Design" },
  { value: "behavioral", label: "Behavioral" },
  { value: "domain", label: "Domain" },
];

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [languages, setLanguages] = useState("");
  const [interviewTypes, setInterviewTypes] = useState<InterviewType[]>([]);
  const [seniority, setSeniority] = useState("");
  const [motivation, setMotivation] = useState("");
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setSessions(listSessions().sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  function toggleInterviewType(t: InterviewType) {
    setInterviewTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function startSession() {
    const trimmedRole = role.trim();
    const trimmedCompany = company.trim();
    if (!trimmedRole || !trimmedCompany) return;
    const s = newSession(trimmedRole, trimmedCompany, {
      languages: languages.trim() || undefined,
      interviewTypes: interviewTypes.length > 0 ? interviewTypes : undefined,
      seniority: seniority.trim() || undefined,
      motivation: motivation.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    upsertSession(s);
    setActiveSessionId(s.id);
    router.push(`/session/${s.id}`);
  }

  function removeSession(id: string) {
    deleteSession(id);
    setSessions(listSessions().sort((a, b) => b.updatedAt - a.updatedAt));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">PrepTech</h1>
          <Link
            href="/demo"
            className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-950/50"
          >
            See the demo →
          </Link>
        </div>
        <p className="mt-2 text-zinc-400">
          Tell it the role and company. It builds you a tailored study plan, drills you with graded questions, and
          helps you iterate until you can answer them cleanly.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          What you&apos;re looking at is the MVP. The full vision — real Reddit-sourced questions, code execution,
          mastery tracking — is in <code className="font-mono">PLAN.md</code> and previewable at{" "}
          <Link href="/demo" className="underline hover:text-zinc-300">
            /demo
          </Link>
          .
        </p>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
        <h2 className="mb-4 text-lg font-medium">Start a new prep session</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Role</span>
            <input
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
              placeholder="e.g. Senior Backend Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Company</span>
            <input
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
              placeholder="e.g. Stripe"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>
        </div>

        <details className="group mt-4 rounded-md border border-zinc-800 bg-zinc-900/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-zinc-300 [&::-webkit-details-marker]:hidden">
            <span>
              Add details <span className="text-zinc-500">(optional, but improves tailoring)</span>
            </span>
            <svg
              className="h-4 w-4 text-zinc-500 transition group-open:rotate-180"
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
          <div className="space-y-3 border-t border-zinc-800 px-3 py-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-200">What would landing this role change for you?</span>
              <span className="text-xs text-zinc-500">
                The coach references this on every grade — to push you when it gets hard. Be honest, not generic.
                Money, title, team, project, what you&apos;d prove to yourself.
              </span>
              <textarea
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
                rows={3}
                placeholder="e.g. First staff offer — proves I can lead at scale. Means I can finally move my family closer to my parents."
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-400">Programming language(s)</span>
                <input
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
                  placeholder="e.g. Swift, Python"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-400">Seniority</span>
                <input
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
                  placeholder="e.g. Senior, Staff, EM"
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Interview round types to focus on</span>
              <div className="flex flex-wrap gap-2">
                {INTERVIEW_TYPE_OPTIONS.map((opt) => {
                  const on = interviewTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleInterviewType(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        on
                          ? "border-sky-500 bg-sky-950/60 text-sky-100"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Notes for the coach</span>
              <textarea
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-600"
                rows={3}
                placeholder="Recent projects, weak areas, the JD link — anything that should shape the prep."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
        </details>

        <button
          onClick={startSession}
          className="mt-4 w-full rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!role.trim() || !company.trim()}
        >
          Start drilling
        </button>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
        <h2 className="mb-2 text-lg font-medium">Authentication</h2>
        <p className="text-sm text-zinc-400">
          PrepTech runs against your local{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs">claude</code> CLI login, so usage is
          billed to your Claude subscription — no API key needed. Run{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs">claude /status</code> in a terminal
          to confirm you&apos;re logged in.
        </p>
      </section>

      {sessions.length > 0 && (
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="mb-3 text-lg font-medium">Past sessions</h2>
          <ul className="divide-y divide-zinc-800">
            {sessions.map((s) => {
              const avg = s.scores.length
                ? (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(1)
                : "—";
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <button
                    className="flex-1 text-left"
                    onClick={() => {
                      setActiveSessionId(s.id);
                      router.push(`/session/${s.id}`);
                    }}
                  >
                    <div className="font-medium">
                      {s.role} <span className="text-zinc-500">@</span> {s.company}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(s.updatedAt).toLocaleString()} · avg score {avg} · {s.scores.length} graded
                    </div>
                  </button>
                  <button
                    onClick={() => removeSession(s.id)}
                    className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="mt-10 text-xs text-zinc-600">
        Built with Next.js · Claude Agent SDK · WebSearch · localStorage. Sessions stay in your browser; prompts go
        through your local Claude CLI login.
      </footer>
    </main>
  );
}
