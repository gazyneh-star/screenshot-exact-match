// Server-only multi-provider router. Every provider here speaks the
// OpenAI-compatible chat/completions streaming protocol.
import { AIRequestError, checkAccess, safeUpstreamError } from "./ai-access.server";
import { SPEED_CHAIN, SMART_CHAIN, SMART_EXHAUSTED, systemInstructions } from "./chat-policy";
export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

type Provider = {
  id: string;
  name: string;
  keys: string[];
  model: string;
  baseUrl: string;
  extra?: Record<string, unknown>;
};

const env = (k: string) => (process.env[k] ?? "").trim();
const list = (k: string) => env(k).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

export function getProviders(): Provider[] {
  const cfAcct = env("CLOUDFLARE_ACCOUNT_ID");
  const all: Provider[] = [
    { id: "gemini", name: "Google Gemini", keys: list("GEMINI_KEYS"), model: env("GEMINI_MODEL") || "gemini-3.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
    { id: "groq", name: "Groq", keys: list("GROQ_KEYS"), model: env("GROQ_MODEL") || "openai/gpt-oss-120b", baseUrl: "https://api.groq.com/openai/v1" },
    { id: "cerebras", name: "Cerebras", keys: list("CEREBRAS_KEYS"), model: env("CEREBRAS_MODEL"), baseUrl: env("CEREBRAS_BASE_URL") || "https://api.cerebras.ai/v1" },
    { id: "sambanova", name: "SambaNova", keys: list("SAMBANOVA_KEYS"), model: env("SAMBANOVA_MODEL") || "Meta-Llama-3.3-70B-Instruct", baseUrl: env("SAMBANOVA_BASE_URL") || "https://api.sambanova.ai/v1" },
    { id: "cloudflare", name: "Cloudflare Workers AI", keys: cfAcct ? list("CLOUDFLARE_API_TOKEN") : [], model: env("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.1-8b-instruct", baseUrl: `https://api.cloudflare.com/client/v4/accounts/${cfAcct}/ai/v1` },
    { id: "together", name: "Together AI", keys: list("TOGETHER_KEYS"), model: env("TOGETHER_MODEL") || "meta-llama/Llama-3.3-70B-Instruct-Turbo", baseUrl: env("TOGETHER_BASE_URL") || "https://api.together.xyz/v1" },
    { id: "deepseek", name: "DeepSeek", keys: list("DEEPSEEK_KEYS"), model: env("DEEPSEEK_MODEL") || "deepseek-chat", baseUrl: env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1" },
    { id: "openrouter", name: "OpenRouter", keys: list("OPENROUTER_KEYS"), model: env("OPENROUTER_MODEL") || "openrouter/auto", baseUrl: env("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1" },
    { id: "orcarouter", name: "OrcaRouter", keys: env("ORCAROUTER_BASE_URL") ? list("ORCAROUTER_KEYS") : [], model: env("ORCAROUTER_MODEL"), baseUrl: env("ORCAROUTER_BASE_URL") },
    { id: "teamorouter", name: "Teamorouter", keys: env("TEAMOROUTER_BASE_URL") ? list("TEAMOROUTER_KEYS") : [], model: env("TEAMOROUTER_MODEL"), baseUrl: env("TEAMOROUTER_BASE_URL") },
    { id: "tokenharbor", name: "Token Harbor", keys: env("TOKEN_HARBOR_BASE_URL") ? list("TOKEN_HARBOR_KEYS") : [], model: env("TOKEN_HARBOR_MODEL"), baseUrl: env("TOKEN_HARBOR_BASE_URL") },
    { id: "huggingface", name: "Hugging Face", keys: list("HF_TOKENS"), model: env("HF_MODEL") || "meta-llama/Llama-3.1-8B-Instruct", baseUrl: env("HF_BASE_URL") || "https://router.huggingface.co/v1" },
    { id: "pollinations", name: "Pollinations", keys: list("POLLINATIONS_API_KEY"), model: env("POLLINATIONS_TEXT_MODEL") || "openai", baseUrl: "https://text.pollinations.ai/openai" },
    // Built-in fallback so Elvyn answers even before any provider key is added.
    { id: "lovable", name: "Elvyn built-in", keys: list("LOVABLE_API_KEY"), model: "openai/gpt-6-astra", baseUrl: "https://ai.gateway.lovable.dev/v1", extra: { reasoning_effort: "low" } },
  ];
  return all.filter((p) => p.keys.length > 0 && p.model && p.baseUrl);
}

export function providerStatus() {
  const active = new Set(getProviders().map((p) => p.id));
  const names = ["gemini", "groq", "cerebras", "sambanova", "cloudflare", "together", "deepseek", "openrouter", "orcarouter", "teamorouter", "tokenharbor", "huggingface", "pollinations", "lovable"];
  return names.map((id) => ({ id, configured: active.has(id) }));
}

export function chainProviders(selected: string) {
  const all = getProviders();
  if (selected === "auto") return all.filter((p) => p.id !== "cerebras");
  const chain = selected === "speed" ? SPEED_CHAIN : selected === "smart" ? SMART_CHAIN : null;
  if (!chain) return all.filter((p) => p.id === selected);
  return chain.flatMap((id) => {
    const provider = all.find((p) => p.id === id);
    if (!provider) return [];
    if (selected === "speed" && id === "groq") return [{ ...provider, model: "llama-3.3-70b-versatile" }];
    if (selected === "smart" && id === "teamorouter") return [{ ...provider, model: "deepseek-v4-pro-free" }];
    // Retired Gemini/Cerebras models use the existing configured current model.
    // OpenRouter Smart must be explicitly configured to a DeepSeek/Qwen model.
    if (selected === "smart" && id === "openrouter" && !/deepseek|qwen/i.test(provider.model)) return [];
    return [provider];
  });
}

/** Tries providers in order; falls back only before any content has been sent. */
export async function routeChat(messages: ChatMsg[], signal: AbortSignal, selected = "auto", instructions = systemInstructions()) {
  const errors: string[] = [];
  const providers = chainProviders(selected);
  const hasChain = ["auto", "speed", "smart"].includes(selected);
  if (!providers.length) throw new AIRequestError(400, selected === "smart" ? SMART_EXHAUSTED : "This mode needs its provider API keys, current models and API addresses configured.");
  for (const p of providers) {
    await checkAccess(p.id);
    for (const key of p.keys.slice(0, 1)) {
      try {
        const res = await fetch(`${p.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: p.model, stream: true, messages: [{ role: "system", content: instructions }, ...messages], ...p.extra }),
        });
        if (res.ok && res.body) return { provider: p, body: res.body };
        const error = await safeUpstreamError(res, p.id);
        if (res.status !== 429 && res.status < 500) throw error;
        errors.push(`${p.name}: ${res.status}`);
        if (!hasChain) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        if (signal.aborted || e instanceof AIRequestError) throw e;
        errors.push(`${p.name}: network error`);
        if (!hasChain) throw new AIRequestError(502, `${p.name}: connection failed.`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  throw new AIRequestError(503, selected === "smart" ? SMART_EXHAUSTED : `All ${selected} nodes are currently busy. Please try again later. (${errors.join(", ")})`);
}

/** Converts an OpenAI-style SSE stream into a plain text stream. */
export function sseToText(body: ReadableStream<Uint8Array>) {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        buf += dec.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const data = l.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const payload = JSON.parse(data);
            if (payload.error) { ctl.error(new Error(payload.error.message || "AI stream failed")); return; }
            const delta = payload?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) ctl.enqueue(enc.encode(delta));
          } catch {
            /* partial or non-JSON line */
          }
        }
      },
    }),
  );
}
