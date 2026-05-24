import { NextRequest, NextResponse } from "next/server";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { ApiRequest, ApiResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

function flattenHistory(messages: ApiRequest["messages"]): string {
  if (messages.length === 1) return messages[0].content;
  const prior = messages.slice(0, -1);
  const last = messages[messages.length - 1];
  const transcript = prior
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return [
    "Conversation so far:",
    transcript,
    "",
    "Current request:",
    last.content,
  ].join("\n");
}

export async function POST(req: NextRequest) {
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

  // Strip ANTHROPIC_API_KEY so the SDK uses the local `claude` OAuth login
  // (Max subscription) instead of falling back to API-key billing.
  const subprocessEnv: Record<string, string | undefined> = { ...process.env };
  delete subprocessEnv.ANTHROPIC_API_KEY;
  delete subprocessEnv.ANTHROPIC_AUTH_TOKEN;

  const options: Options = {
    systemPrompt: system,
    model: MODEL,
    tools: useWebSearch ? ["WebSearch"] : [],
    allowedTools: useWebSearch ? ["WebSearch"] : [],
    permissionMode: "bypassPermissions",
    maxTurns: useWebSearch ? 8 : 2,
    env: subprocessEnv,
  };

  try {
    const q = query({ prompt: flattenHistory(messages), options });
    let finalText = "";
    for await (const msg of q) {
      if (msg.type === "result" && msg.subtype === "success") {
        finalText = msg.result;
        break;
      }
    }
    if (!finalText) {
      return NextResponse.json({ error: "No response from model" }, { status: 502 });
    }
    const response: ApiResponse = { text: finalText.trim() };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
