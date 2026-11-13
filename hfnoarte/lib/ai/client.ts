// One small client for any OpenAI-compatible chat API. That covers free
// options (Google Gemini's free tier, Groq's free tier) as well as OpenAI.
// Runs on the server only — keys are never sent to the browser.
import "server-only";

export interface AiConfig { baseUrl: string; apiKey: string; model: string; provider: string }

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export function aiConfig(): AiConfig | null {
  const provider = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY && !process.env.AI_API_KEY ? "openai" : "gemini")).toLowerCase();
  const apiKey = process.env.AI_API_KEY || (provider === "openai" ? process.env.OPENAI_API_KEY : undefined);
  if (!apiKey) return null;
  const preset = PRESETS[provider] ?? PRESETS.gemini;
  return {
    provider,
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || preset.baseUrl).replace(/\/$/, ""),
    model: process.env.AI_MODEL || preset.model,
  };
}

export const aiAvailable = () => aiConfig() !== null;

export class AiError extends Error {}

/** Ask for a JSON object. Throws AiError on any failure so callers can fall back. */
export async function chatJson<T>(system: string, user: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<T> {
  const cfg = aiConfig();
  if (!cfg) throw new AiError("AI is not configured");
  const body = {
    model: cfg.model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${system}\n\nRespond with a single JSON object only.` },
      { role: "user", content: user },
    ],
  };
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new AiError(`AI request failed: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new AiError(`AI provider returned ${res.status}${res.status === 429 ? " (free-tier rate limit)" : ""}: ${detail}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseJson<T>(content);
}

export function parseJson<T>(content: string): T {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) as T; } catch { /* fall through */ }
    }
    throw new AiError("AI response was not valid JSON");
  }
}
