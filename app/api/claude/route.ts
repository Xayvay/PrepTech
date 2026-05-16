import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ApiRequest, ApiResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-anthropic-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-anthropic-key header" }, { status: 401 });
  }

  let body: ApiRequest;
  try {
    body = (await req.json()) as ApiRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { system, messages, useWebSearch } = body;
  if (!system || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing system or messages" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const tools = useWebSearch
    ? [
        {
          type: "web_search_20250305" as const,
          name: "web_search",
          max_uses: 5,
        },
      ]
    : undefined;

  try {
    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      // @ts-expect-error — server-side web_search tool is accepted by the API
      tools,
    });

    const text = result.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const citations: { url: string; title?: string }[] = [];
    for (const block of result.content) {
      // @ts-expect-error — citation shape on text blocks from web search
      const c = block.citations as Array<{ url?: string; title?: string }> | undefined;
      if (Array.isArray(c)) {
        for (const cit of c) {
          if (cit.url) citations.push({ url: cit.url, title: cit.title });
        }
      }
    }

    const response: ApiResponse = { text, citations: citations.length ? citations : undefined };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
