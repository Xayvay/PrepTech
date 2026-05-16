"use client";

import type { ApiRequest, ApiResponse } from "./types";
import { getApiKey } from "./storage";

export async function callClaude(req: ApiRequest): Promise<ApiResponse> {
  const key = getApiKey();
  if (!key) throw new Error("No API key set. Add your Anthropic API key on the home screen.");

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-anthropic-key": key },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }

  return (await res.json()) as ApiResponse;
}
