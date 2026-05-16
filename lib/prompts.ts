import type { Session, ApiMessage } from "./types";

export function systemPrompt(role: string, company: string): string {
  return [
    `You are PrepTech, an interview coach helping the candidate prepare for a "${role}" role at ${company}.`,
    "Use the web_search tool to ground your prep in current, real information: the company's recent news, engineering blog, products, tech stack, leadership, and reported interview themes for this role.",
    "Be concrete and specific to this role+company. Avoid generic advice. Prefer evidence from real sources over assumptions.",
    "When asked to ask a question, ask exactly one focused question — technical, behavioral, or role-specific — that someone interviewing for this role at this company might realistically face. Do not answer it yourself.",
    'When asked to grade an answer, return strict JSON on a single line: {"score": <0-10 integer>, "feedback": "<2-4 sentence critique with what was strong, what was missing, and one concrete improvement>", "follow_up": "<one sharper follow-up question>"}. No prose outside the JSON.',
    "When asked for a curriculum, return a short, numbered study plan (5-8 items) tailored to this role+company. Reference specific topics, frameworks, or sources you found.",
  ].join("\n\n");
}

export function curriculumMessages(): ApiMessage[] {
  return [
    {
      role: "user",
      content:
        "Build me a tailored study plan. Search the web for what this company actually cares about for this role, then give me a 5-8 item numbered curriculum. Each item: topic, one-line why-it-matters, and (where applicable) a specific resource.",
    },
  ];
}

export function questionMessages(session: Session): ApiMessage[] {
  const history = session.turns
    .filter((t) => t.kind === "question" || t.kind === "answer" || t.kind === "grade")
    .map((t) => ({ role: t.role, content: t.content }));
  return [
    ...history,
    {
      role: "user" as const,
      content:
        history.length === 0
          ? "Start the drill. Ask me the first interview question. One question, no preamble."
          : "Ask the next question. Vary the topic from the previous one if possible. One question, no preamble.",
    },
  ];
}

export function gradeMessages(session: Session, answer: string): ApiMessage[] {
  const lastQuestion = [...session.turns].reverse().find((t) => t.kind === "question");
  return [
    {
      role: "user",
      content: [
        `Question: ${lastQuestion?.content ?? "(unknown question)"}`,
        `My answer: ${answer}`,
        "",
        'Grade my answer. Return ONLY the JSON object: {"score": int 0-10, "feedback": "...", "follow_up": "..."}',
      ].join("\n"),
    },
  ];
}

export type Grade = { score: number; feedback: string; follow_up: string };

export function parseGrade(text: string): Grade | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (typeof obj.score !== "number") return null;
    return {
      score: Math.max(0, Math.min(10, Math.round(obj.score))),
      feedback: String(obj.feedback ?? ""),
      follow_up: String(obj.follow_up ?? ""),
    };
  } catch {
    return null;
  }
}
