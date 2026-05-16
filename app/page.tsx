"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getApiKey,
  setApiKey,
  listSessions,
  newSession,
  upsertSession,
  setActiveSessionId,
  deleteSession,
} from "@/lib/storage";
import type { Session } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [apiKey, setKey] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setKey(getApiKey());
    setSessions(listSessions().sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  function saveKey(v: string) {
    setKey(v);
    setApiKey(v);
  }

  function startSession() {
    const trimmedRole = role.trim();
    const trimmedCompany = company.trim();
    if (!trimmedRole || !trimmedCompany) return;
    if (!apiKey.trim()) {
      alert("Add your Anthropic API key first — it's stored only in your browser.");
      return;
    }
    const s = newSession(trimmedRole, trimmedCompany);
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
        <h1 className="text-3xl font-semibold tracking-tight">PrepTech</h1>
        <p className="mt-2 text-zinc-400">
          Tell it the role and company. It builds you a tailored study plan, drills you with graded questions, and
          helps you iterate until you can answer them cleanly.
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

        <button
          onClick={startSession}
          className="mt-4 w-full rounded-md bg-emerald-500 px-4 py-2 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!role.trim() || !company.trim()}
        >
          Start drilling
        </button>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
        <h2 className="mb-2 text-lg font-medium">Anthropic API key</h2>
        <p className="mb-3 text-sm text-zinc-400">
          PrepTech is bring-your-own-key. Your key stays in your browser&apos;s localStorage and is sent to the
          Next.js server only to forward the request to Anthropic.{" "}
          <a
            className="underline hover:text-zinc-200"
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get a key
          </a>
          .
        </p>
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm outline-none focus:border-zinc-600"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
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
        Built with Next.js · Claude API · web search tool · localStorage. No data leaves your browser except the
        prompts you send to Anthropic.
      </footer>
    </main>
  );
}
