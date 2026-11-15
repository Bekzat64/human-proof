import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * One place that decides which LLM the app talks to.
 *
 *   LLM_PROVIDER   anthropic (default) | google | openai
 *   COPILOT_MODEL  overrides the provider's fast default
 *   GRADER_MODEL   overrides the provider's strong default
 *
 * Nothing here is required: with no key for the selected provider the app
 * runs on its deterministic fallbacks (offline copilot, heuristic rubric) and
 * switches to the model by itself once a key is added.
 */

export type LlmProvider = "anthropic" | "google" | "openai";
export type LlmRole = "copilot" | "grader";

const PROVIDERS: Record<
  LlmProvider,
  { keyEnv: string; defaults: Record<LlmRole, string>; model: (id: string) => LanguageModel }
> = {
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    defaults: { copilot: "claude-haiku-5-5", grader: "claude-sonnet-5-5" },
    // Endpoints are pinned so a stray *_BASE_URL in the environment can never
    // redirect requests (and the API key) somewhere else.
    model: (id) => createAnthropic({ baseURL: "https://api.anthropic.com/v1" })(id),
  },
  google: {
    keyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaults: { copilot: "gemini-flash-lite-latest", grader: "gemini-flash-lite-latest" },
    model: (id) =>
      createGoogleGenerativeAI({ baseURL: "https://generativelanguage.googleapis.com/v1beta" })(id),
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    defaults: { copilot: "gpt-6-luna", grader: "gpt-6.1-sol" },
    model: (id) => createOpenAI({ baseURL: "https://api.openai.com/v1" })(id),
  },
};

const MODEL_ENV: Record<LlmRole, string> = { copilot: "COPILOT_MODEL", grader: "GRADER_MODEL" };

export function llmProvider(): LlmProvider {
  const value = process.env.LLM_PROVIDER?.trim().toLowerCase();
  return value === "google" || value === "openai" ? value : "anthropic";
}

/** Is there an API key for the selected provider? */
export function isLlmAvailable(): boolean {
  return Boolean(process.env[PROVIDERS[llmProvider()].keyEnv]?.trim());
}

export function modelId(role: LlmRole): string {
  return process.env[MODEL_ENV[role]]?.trim() || PROVIDERS[llmProvider()].defaults[role];
}

export function getModel(role: LlmRole): LanguageModel {
  return PROVIDERS[llmProvider()].model(modelId(role));
}

/**
 * Current Anthropic models reject non-default sampling parameters, so
 * `temperature: 0` is only sent to providers that accept it.
 */
export function deterministicSampling(): { temperature?: number } {
  return llmProvider() === "anthropic" ? {} : { temperature: 0 };
}
