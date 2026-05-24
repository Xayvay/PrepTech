export type Role = "user" | "assistant";

export type Turn = {
  id: string;
  role: Role;
  content: string;
  kind?: "curriculum" | "question" | "answer" | "grade" | "note";
  score?: number;
  topic?: string;
  source?: { description: string; url?: string };
  concept_tags?: string[];
  createdAt: number;
};

export type InterviewType = "coding" | "system_design" | "behavioral" | "domain";

export type BankEntry = {
  id: string;
  content: string;
  source?: { description: string; url?: string };
  concept_tags?: string[];
  schemaVersion?: number;
  used: boolean;
  usedAt?: number;
  createdAt?: number;
};

export type WarmupAttempt = {
  score: number;
  answer: string;
  feedback?: string;
  at: number;
};

export type WarmupTeach = {
  why_it_matters: string;
  how_to_use: string;
  syntax: string;
  language?: string;
  gotcha?: string;
};

export type WarmupItem = {
  id: string;
  content: string;
  expected_signal: string;
  kind: "syntax" | "concept" | "gotcha";
  language?: string;
  topic?: string;
  teach?: WarmupTeach;
  attempts: WarmupAttempt[];
  masteredAt?: number;
  createdAt: number;
};

export type CheatSheetEntry = {
  id: string;
  topic: string;
  concept: string;
  when_to_use: string;
  syntax: string;
  language?: string;
  gotcha?: string;
  user_note?: string;
};

export type Session = {
  id: string;
  role: string;
  company: string;
  languages?: string;
  interviewTypes?: InterviewType[];
  seniority?: string;
  motivation?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
  scores: number[];
  questionBanks?: Record<string, BankEntry[]>;
  seenQuestions?: Record<string, string[]>;
  cheatSheet?: CheatSheetEntry[];
  warmups?: WarmupItem[];
};

export type ApiMessage = {
  role: Role;
  content: string;
};

export type ApiRequest = {
  system: string;
  messages: ApiMessage[];
  useWebSearch?: boolean;
};

export type ApiResponse = {
  text: string;
  citations?: { url: string; title?: string }[];
};
