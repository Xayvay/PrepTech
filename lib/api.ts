"use client";

import type { ApiRequest, ApiResponse } from "./types";

export async function callClaude(req: ApiRequest): Promise<ApiResponse> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }

  return (await res.json()) as ApiResponse;
}
