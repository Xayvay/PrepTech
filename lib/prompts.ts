import type { Session, ApiMessage, InterviewType } from "./types";

const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  coding: "coding",
  system_design: "system design",
  behavioral: "behavioral",
  domain: "domain / role-specific",
};

export function systemPrompt(session: Pick<Session, "role" | "company" | "languages" | "interviewTypes" | "seniority" | "motivation" | "notes">): string {
  const candidateContext: string[] = [];
  if (session.seniority) candidateContext.push(`Seniority: ${session.seniority}.`);
  if (session.languages) candidateContext.push(`Preferred programming language(s): ${session.languages}.`);
  if (session.interviewTypes && session.interviewTypes.length > 0) {
    const labels = session.interviewTypes.map((t) => INTERVIEW_TYPE_LABELS[t]).join(", ");
    candidateContext.push(`Interview round types to focus on: ${labels}.`);
  }
  if (session.notes) candidateContext.push(`Additional notes from the candidate: ${session.notes}`);

  const motivationBlock = session.motivation
    ? [
        `What the candidate said landing this role would change for them: "${session.motivation}"`,
        "You will reference this — by paraphrase, not by quoting verbatim — in the 'nudge' field of every grade. The point is to remind them why this work matters when it gets hard. Don't be saccharine. Be the friend who tells the truth because they know what's at stake.",
      ].join(" ")
    : null;

  return [
    `You are PrepTech, an interview coach helping the candidate prepare for a "${session.role}" role at ${session.company}.`,
    ...(candidateContext.length > 0 ? [candidateContext.join(" ")] : []),
    ...(motivationBlock ? [motivationBlock] : []),
    "Voice: tough but on their side. Honest about gaps without being cold. Credit real strengths so they know you're not flattering. When something is weak, name it specifically — vague feedback feels like a brush-off and it is. Avoid generic 'study more' advice. Treat the candidate like an adult who can hear the truth.",
    "Use the web_search tool to ground your prep in current, real information: the company's recent news, engineering blog, products, tech stack, leadership, and reported interview themes for this role. When recommending resources in grades, search for a real, current article/video/talk and include the actual URL. Never invent links.",
    "Be concrete and specific to this role+company. Avoid generic advice. Prefer evidence from real sources over assumptions.",
    "When asked to ask a question, ask exactly one focused question — technical, behavioral, or role-specific — that someone interviewing for this role at this company might realistically face. Do not answer it yourself.",
    [
      "When asked to grade an answer, return ONLY a JSON object (no prose outside it, no code fence) with this shape:",
      "{",
      '  "score": <integer 0-10>,',
      "  \"strengths\": [\"1-2 specific things they actually got right — name the concept, not 'good attempt'\"],",
      '  "gaps": ["1-3 specific things they missed or got wrong — named, concrete, not vague"],',
      '  "improvements": [',
      '    {',
      '      "skill": "<the specific skill or concept to build>",',
      "      \"how\": \"<the concrete next step — 2-3 sentences, actionable today, not 'read a book'>\",",
      '      "resource": { "title": "<real title>", "url": "<real URL you found via web search>" }',
      '    }',
      '  ],',
      '  "follow_up": "<one sharper follow-up question that targets the biggest gap>",',
      '  "nudge": "<one sentence that ties this grade back to what the candidate said landing this role would change for them. Specific, not platitudes. Skip if no motivation was provided.>"',
      "}",
      "Aim for 1-3 improvements, each with a real searched resource. If you genuinely can't find a credible resource for an item, set resource to null rather than fabricating.",
    ].join("\n"),
    [
      "When asked for a curriculum, return a short, numbered study plan (5-8 items) tailored to this role+company. Reference specific topics, frameworks, or sources you found.",
      "ALWAYS include at least one item titled around AI-augmented engineering, covering all three of:",
      "  (a) How this specific company uses AI in their stack, products, or workflow (web-search for current evidence — e.g., AI features they've launched, AI infra they've built, AI-related job listings).",
      "  (b) Which AI tools the candidate is expected to be fluent in for this role (Cursor, Claude Code, Copilot, ChatGPT, internal company tools if any) — be specific about what the company has stated publicly.",
      "  (c) How to demonstrate AI-augmented engineering judgment in interviews: when to reach for AI vs not, evaluating AI-generated code for correctness/security, articulating an AI-assisted workflow, and showing taste about where AI helps a team vs creates noise.",
      "This item is not optional — modern engineering interviews increasingly probe AI fluency directly. If the company has gone publicly AI-first (e.g., Duolingo, Shopify), expand this into two items.",
    ].join("\n"),
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

export function questionMessages(session: Session, focusedTopic?: string): ApiMessage[] {
  const history = session.turns
    .filter((t) => t.kind === "question" || t.kind === "answer" || t.kind === "grade")
    .map((t) => ({ role: t.role, content: t.content }));
  const focusLine = focusedTopic
    ? ` Focus this question specifically on: "${focusedTopic}". Stay on this topic.`
    : "";
  return [
    ...history,
    {
      role: "user" as const,
      content:
        history.length === 0
          ? `Start the drill. Ask me the first interview question.${focusLine} One question, no preamble.`
          : `Ask the next question.${focusLine || " Vary the topic from the previous one if possible."} One question, no preamble.`,
    },
  ];
}

const BANK_SIZE = 6;
export const BANK_SCHEMA_VERSION = 2;

export function questionBankMessages(
  session: Pick<Session, "role" | "company">,
  topicTitle: string,
  alreadySeen: string[],
): ApiMessage[] {
  const seenBlock =
    alreadySeen.length > 0
      ? `\n\nThe candidate has already seen these questions on this topic — return ${BANK_SIZE} genuinely different ones:\n${alreadySeen
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}`
      : "";
  return [
    {
      role: "user",
      content:
        `Build a bank of ${BANK_SIZE} real interview questions on the topic "${topicTitle}" for someone interviewing for a "${session.role}" role at ${session.company}.\n\n` +
        `Use web_search aggressively: prioritize questions reported by actual candidates (Glassdoor, blind.io, Reddit r/cscareerquestions, r/leetcode, candidate blog posts, ${session.company}'s own engineering blog if they describe their interview process). Avoid inventing generic questions — find what people have actually been asked.\n\n` +
        `Return ONLY a JSON array (no prose outside it, no code fence) of exactly ${BANK_SIZE} objects with this shape:\n` +
        "[\n" +
        '  {\n' +
        '    "content": "<the question text, interview-ready, no preamble>",\n' +
        '    "source": { "description": "<short attribution e.g. \'Reported by candidate on Glassdoor, 2024\'>", "url": "<source URL>" },\n' +
        '    "concept_tags": ["<1-3 short concept names that answering this question would require — e.g. \\"GCD\\", \\"async/await\\", \\"Futures\\", \\"actor\\", \\"DispatchQueue\\". Use names of APIs / patterns / tools, not vague topics.>"]\n' +
        "  }\n" +
        "]\n\n" +
        `If you genuinely cannot find a real reported question for a slot, you may include a model-crafted one but mark it: { "description": "Model-crafted from public ${session.company} engineering content" } with no url. Aim for at least 4 of 6 to be sourced from real candidate reports. Always include concept_tags (omit only if the question is purely behavioral with no technical concept to name).` +
        seenBlock,
    },
  ];
}

export function cheatSheetMessages(
  session: Pick<Session, "role" | "company" | "languages">,
  curriculum: Curriculum,
): ApiMessage[] {
  const topicList = curriculum.items.map((it) => `${it.number}. ${it.title}`).join("\n");
  return [
    {
      role: "user",
      content:
        `Build a stack-specific syntax cheat sheet for a candidate preparing for a "${session.role}" role at ${session.company}.` +
        (session.languages ? ` Their primary language(s): ${session.languages}.` : "") +
        `\n\nCurriculum topics (use these exact titles in the "topic" field of each entry):\n${topicList}\n\n` +
        `For each technical topic, produce 2-4 concept entries. A concept is a specific API, pattern, or tool the candidate would reach for. ` +
        `Examples: "GCD" / "async/await" / "Combine" for Swift threading; "Futures with map/flatMap" / "ZIO" / "Cats Effect IO" for Scala concurrency.\n\n` +
        `Skip topics that are purely behavioral or strategic (e.g., "Cross-Functional Co-Leadership"). For those, return zero entries.\n\n` +
        `Use web_search to confirm current best practices and ${session.company}'s actual stack where it matters.\n\n` +
        `Return ONLY a JSON array (no prose outside it, no code fence) where each entry has this shape:\n` +
        "[\n" +
        '  {\n' +
        '    "topic": "<exact curriculum item title>",\n' +
        '    "concept": "<short API/pattern name, e.g., \\"GCD\\" or \\"async/await\\">",\n' +
        '    "when_to_use": "<1-2 sentences on WHEN to reach for this vs the alternatives>",\n' +
        '    "syntax": "<idiomatic code snippet, 3-12 lines, showing the API>",\n' +
        '    "language": "<lowercase language hint, e.g., swift, python, scala, typescript>",\n' +
        '    "gotcha": "<optional, the single most common mistake people make with this>"\n' +
        "  }\n" +
        "]\n\n" +
        `Keep snippets idiomatic and current. If the company has publicly stated they prefer one approach (e.g., Duolingo uses Scala + Finatra), favor that style.`,
    },
  ];
}

export type RawCheatSheetEntry = {
  topic: string;
  concept: string;
  when_to_use: string;
  syntax: string;
  language?: string;
  gotcha?: string;
};

export function parseCheatSheet(text: string): RawCheatSheetEntry[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    const out: RawCheatSheetEntry[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const topic = typeof r.topic === "string" ? r.topic.trim() : "";
      const concept = typeof r.concept === "string" ? r.concept.trim() : "";
      const when_to_use = typeof r.when_to_use === "string" ? r.when_to_use.trim() : "";
      const syntax = typeof r.syntax === "string" ? r.syntax : "";
      if (!topic || !concept || !syntax) continue;
      const language = typeof r.language === "string" ? r.language.trim().toLowerCase() : undefined;
      const gotcha = typeof r.gotcha === "string" && r.gotcha.trim() ? r.gotcha.trim() : undefined;
      out.push({ topic, concept, when_to_use, syntax, language, gotcha });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export type RawBankEntry = {
  content: string;
  source?: { description: string; url?: string };
  concept_tags?: string[];
};

export function parseQuestionBank(text: string): RawBankEntry[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    const out: RawBankEntry[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const content = typeof r.content === "string" ? r.content.trim() : "";
      if (!content) continue;
      let source: RawBankEntry["source"];
      if (r.source && typeof r.source === "object") {
        const s = r.source as Record<string, unknown>;
        const description = typeof s.description === "string" ? s.description.trim() : "";
        const url = typeof s.url === "string" && /^https?:\/\//.test(s.url) ? s.url : undefined;
        if (description) source = { description, url };
      }
      let concept_tags: string[] | undefined;
      if (Array.isArray(r.concept_tags)) {
        const tags = r.concept_tags
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim());
        if (tags.length > 0) concept_tags = tags;
      }
      out.push({ content, source, concept_tags });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

const CODING_KEYWORDS = [
  "coding",
  "algorithm",
  "leetcode",
  "implement",
  "code review",
  "data structure",
  "system design",
  "programming",
  "scala",
  "python",
  "swift",
  "typescript",
  "javascript",
  "kotlin",
  "java ",
  "rust",
  "go ",
  "backend",
  "api design",
  "database",
];

export function isCodingTopic(item: { title: string; body: string }): boolean {
  const haystack = `${item.title} ${item.body}`.toLowerCase();
  return CODING_KEYWORDS.some((k) => haystack.includes(k));
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

export type CurriculumItem = {
  number: number;
  title: string;
  body: string;
  resource?: string;
};

export type Curriculum = {
  items: CurriculumItem[];
  sources: { title: string; url: string }[];
};

export function parseCurriculum(text: string): Curriculum | null {
  let mainText = text;
  const sources: { title: string; url: string }[] = [];

  const sourcesMatch = text.match(/\*\*Sources:?\*\*\s*\n([\s\S]+?)$/i);
  if (sourcesMatch && typeof sourcesMatch.index === "number") {
    mainText = text.slice(0, sourcesMatch.index);
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(sourcesMatch[1])) !== null) {
      sources.push({ title: lm[1], url: lm[2] });
    }
  }

  const itemRe = /\*\*(\d+)\.\s+([^*\n]+?)\*\*/g;
  const heads: { number: number; title: string; start: number; headerEnd: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = itemRe.exec(mainText)) !== null) {
    heads.push({
      number: parseInt(hm[1], 10),
      title: hm[2].trim(),
      start: hm.index,
      headerEnd: hm.index + hm[0].length,
    });
  }
  if (heads.length < 2) return null;

  const items: CurriculumItem[] = heads.map((h, i) => {
    const next = heads[i + 1];
    const block = mainText.slice(h.headerEnd, next?.start ?? mainText.length).trim();
    const resourceRe = /(?:^|\n)\s*(?:→|->|>)\s*\*\*Resource[^:]*:\*\*\s*/i;
    const rm = block.match(resourceRe);
    if (rm && typeof rm.index === "number") {
      const body = block.slice(0, rm.index).trim();
      const resource = block.slice(rm.index + rm[0].length).trim();
      return { number: h.number, title: h.title, body, resource };
    }
    return { number: h.number, title: h.title, body: block };
  });

  return { items, sources };
}

export type GradeImprovement = {
  skill: string;
  how: string;
  resource: { title: string; url: string } | null;
};

export type Grade = {
  score: number;
  strengths: string[];
  gaps: string[];
  improvements: GradeImprovement[];
  follow_up: string;
  nudge: string;
};

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

function coerceImprovements(v: unknown): GradeImprovement[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw): GradeImprovement | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const skill = typeof r.skill === "string" ? r.skill.trim() : "";
      const how = typeof r.how === "string" ? r.how.trim() : "";
      if (!skill && !how) return null;
      let resource: GradeImprovement["resource"] = null;
      if (r.resource && typeof r.resource === "object") {
        const res = r.resource as Record<string, unknown>;
        const title = typeof res.title === "string" ? res.title.trim() : "";
        const url = typeof res.url === "string" ? res.url.trim() : "";
        if (title && url && /^https?:\/\//.test(url)) resource = { title, url };
      }
      return { skill, how, resource };
    })
    .filter((x): x is GradeImprovement => x !== null);
}

export function parseGrade(text: string): Grade | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (typeof obj.score !== "number") return null;
    return {
      score: Math.max(0, Math.min(10, Math.round(obj.score))),
      strengths: coerceStringArray(obj.strengths),
      gaps: coerceStringArray(obj.gaps),
      improvements: coerceImprovements(obj.improvements),
      follow_up: typeof obj.follow_up === "string" ? obj.follow_up : "",
      nudge: typeof obj.nudge === "string" ? obj.nudge : "",
    };
  } catch {
    return null;
  }
}
