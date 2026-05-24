"use client";

import type { Session, Turn } from "./types";

const KEY_SESSIONS = "preptech.sessions";
const KEY_ACTIVE = "preptech.activeSessionId";

export function listSessions(): Session[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY_SESSIONS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]) {
  window.localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
}

export function getSession(id: string): Session | undefined {
  return listSessions().find((s) => s.id === id);
}

export function upsertSession(session: Session) {
  const all = listSessions();
  const idx = all.findIndex((s) => s.id === session.id);
  const next = { ...session, updatedAt: Date.now() };
  if (idx === -1) all.push(next);
  else all[idx] = next;
  saveSessions(all);
}

export function deleteSession(id: string) {
  saveSessions(listSessions().filter((s) => s.id !== id));
}

export function getActiveSessionId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY_ACTIVE) ?? "";
}

export function setActiveSessionId(id: string) {
  window.localStorage.setItem(KEY_ACTIVE, id);
}

export function newSession(
  role: string,
  company: string,
  extras?: Pick<Session, "languages" | "interviewTypes" | "seniority" | "motivation" | "notes">,
): Session {
  return {
    id: crypto.randomUUID(),
    role,
    company,
    ...(extras?.languages ? { languages: extras.languages } : {}),
    ...(extras?.interviewTypes && extras.interviewTypes.length > 0
      ? { interviewTypes: extras.interviewTypes }
      : {}),
    ...(extras?.seniority ? { seniority: extras.seniority } : {}),
    ...(extras?.motivation ? { motivation: extras.motivation } : {}),
    ...(extras?.notes ? { notes: extras.notes } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turns: [],
    scores: [],
  };
}

export function newTurn(
  role: Turn["role"],
  content: string,
  kind?: Turn["kind"],
  score?: number,
  topic?: string,
): Turn {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    kind,
    score,
    topic,
    createdAt: Date.now(),
  };
}
