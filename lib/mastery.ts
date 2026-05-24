import type { Session, Turn } from "./types";
import type { CurriculumItem } from "./prompts";

export type Mastery = "none" | "red" | "amber" | "green";

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = 3;
const STRUGGLE_THRESHOLD = 7;
const STRONG_THRESHOLD = 8;
const STRONG_COUNT_FOR_GREEN = 3;
const PLAN_LENGTH_DAYS = 14;

function gradesForTopic(session: Session, title: string): Turn[] {
  const norm = title.trim().toLowerCase();
  return session.turns.filter(
    (t) => t.kind === "grade" && typeof t.score === "number" && (t.topic ?? "").trim().toLowerCase() === norm,
  );
}

export function computeMastery(session: Session, title: string): Mastery {
  const grades = gradesForTopic(session, title);
  if (grades.length === 0) return "none";
  const scores = grades.map((g) => g.score as number);
  const strongCount = scores.filter((s) => s >= STRONG_THRESHOLD).length;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (strongCount >= STRONG_COUNT_FOR_GREEN && avg >= STRONG_THRESHOLD) return "green";
  if (strongCount >= 1 || avg >= 5) return "amber";
  return "red";
}

export function lastDrilledAt(session: Session, title: string): number | null {
  const grades = gradesForTopic(session, title);
  if (grades.length === 0) return null;
  return Math.max(...grades.map((g) => g.createdAt));
}

export function lastScoreFor(session: Session, title: string): number | null {
  const grades = gradesForTopic(session, title);
  if (grades.length === 0) return null;
  const latest = grades.reduce((acc, g) => (g.createdAt > acc.createdAt ? g : acc), grades[0]);
  return latest.score ?? null;
}

export function isDueForReview(session: Session, title: string): boolean {
  const last = lastDrilledAt(session, title);
  if (last === null) return false;
  const score = lastScoreFor(session, title);
  if (score === null || score >= STRONG_THRESHOLD) return false;
  const daysSince = (Date.now() - last) / DAY_MS;
  return daysSince >= REVIEW_INTERVAL_DAYS && score < STRUGGLE_THRESHOLD;
}

export type Recommendation =
  | { kind: "revisit"; item: CurriculumItem; lastScore: number }
  | { kind: "next"; item: CurriculumItem }
  | { kind: "refresh"; item: CurriculumItem }
  | { kind: "all_done" };

export function recommendNextTopic(session: Session, items: CurriculumItem[]): Recommendation {
  if (items.length === 0) return { kind: "all_done" };

  const dueItems = items
    .filter((it) => isDueForReview(session, it.title))
    .map((it) => ({ item: it, last: lastDrilledAt(session, it.title) ?? 0, score: lastScoreFor(session, it.title) ?? 0 }))
    .sort((a, b) => a.last - b.last);
  if (dueItems.length > 0) {
    return { kind: "revisit", item: dueItems[0].item, lastScore: dueItems[0].score };
  }

  const nonMastered = items
    .map((it) => ({ item: it, mastery: computeMastery(session, it.title) }))
    .filter((x) => x.mastery !== "green");
  if (nonMastered.length > 0) {
    const ordering: Record<Mastery, number> = { red: 0, amber: 1, none: 2, green: 3 };
    nonMastered.sort((a, b) => ordering[a.mastery] - ordering[b.mastery]);
    return { kind: "next", item: nonMastered[0].item };
  }

  const oldest = items
    .map((it) => ({ item: it, last: lastDrilledAt(session, it.title) ?? 0 }))
    .sort((a, b) => a.last - b.last)[0];
  return { kind: "refresh", item: oldest.item };
}

export function masteryStats(session: Session, items: CurriculumItem[]): { mastered: number; total: number } {
  return {
    mastered: items.filter((it) => computeMastery(session, it.title) === "green").length,
    total: items.length,
  };
}

export function dayOfPlan(session: Session): { day: number; total: number } {
  const elapsed = (Date.now() - session.createdAt) / DAY_MS;
  const day = Math.max(1, Math.min(PLAN_LENGTH_DAYS, Math.floor(elapsed) + 1));
  return { day, total: PLAN_LENGTH_DAYS };
}

export function leetcodeUrl(title: string): string {
  const q = encodeURIComponent(title.replace(/[^a-zA-Z0-9 ]+/g, " ").trim());
  return `https://leetcode.com/problemset/?search=${q}`;
}

const WARMUP_MASTERED_SCORE = 8;

export function isWarmupMastered(item: { attempts: { score: number }[] }): boolean {
  if (item.attempts.length === 0) return false;
  const latest = item.attempts[item.attempts.length - 1];
  return latest.score >= WARMUP_MASTERED_SCORE;
}

export function warmupStats(session: { warmups?: { attempts: { score: number }[] }[] }): {
  mastered: number;
  total: number;
} {
  const warmups = session.warmups ?? [];
  return {
    mastered: warmups.filter(isWarmupMastered).length,
    total: warmups.length,
  };
}

export function nextWarmupItem<T extends { id: string; attempts: { score: number }[]; createdAt: number }>(
  warmups: T[] | undefined,
): T | null {
  if (!warmups || warmups.length === 0) return null;
  const unmastered = warmups.filter((w) => !isWarmupMastered(w));
  if (unmastered.length === 0) return null;
  const failedBefore = unmastered
    .filter((w) => w.attempts.length > 0)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (failedBefore.length > 0) return failedBefore[0];
  return unmastered.sort((a, b) => a.createdAt - b.createdAt)[0];
}

export function needsWarmupBatch(session: { warmups?: { attempts: { score: number }[] }[] }): boolean {
  const warmups = session.warmups ?? [];
  if (warmups.length === 0) return true;
  return warmups.every(isWarmupMastered);
}
