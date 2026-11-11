import { llmConfig } from "@/core/config";
import type { Planner } from "@/core/ports";
import { createGeminiPlanner, type GeminiClientLike } from "./gemini-planner";

/** Sin `GEMINI_API_KEY` devuelve `fallback` tal cual (sin error ni red); con key, el planner Gemini. */
export function selectPlanner(opts: {
  env: Record<string, string | undefined>;
  fallback: Planner;
  client?: GeminiClientLike;
}): Planner {
  const apiKey = opts.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return opts.fallback;
  const model = opts.env.GEMINI_MODEL?.trim() || llmConfig.defaultModel;
  return createGeminiPlanner({ apiKey, model, client: opts.client, fallback: opts.fallback });
}
