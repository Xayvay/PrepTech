export type Role = "user" | "assistant";

export type Turn = {
  id: string;
  role: Role;
  content: string;
  kind?: "curriculum" | "question" | "answer" | "grade" | "note";
  score?: number;
  createdAt: number;
};

export type Session = {
  id: string;
  role: string;
  company: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
  scores: number[];
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
