import { Buffer } from "node:buffer";
import { createParser } from "eventsource-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { z } from "zod";
import { chatSchema, attachmentSchema } from "./chat-schema";
import { AIRequestError, checkAccess, safeUpstreamError } from "./ai-access.server";
import { getProviders } from "./providers.server";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type NativeContent = { role: "user" | "model"; parts: Part[] };
export function nativeFilePart(bytes: Uint8Array, mimeType: string): Part {
  const valid = mimeType === "image/png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    : mimeType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mimeType === "image/webp" ? Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
    : mimeType === "application/pdf" ? Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-" : false;
  if (!bytes.length || !valid) throw new AIRequestError(400, "The file's bytes do not match its declared image or PDF format.");
  return { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } };
}

export async function prepareNativeContents(messages: z.infer<typeof chatSchema>["messages"], supabase: SupabaseClient<Database>, userId: string) {
  const contents: NativeContent[] = [];
  // Materialize stored bytes, never client-supplied arbitrary URLs or guessed descriptions.
  for (const message of messages) {
    const parts: Part[] = [{ text: message.content || (message.image_path ? "Previously generated image:" : "Attached files:") }];
    const attachments = [...message.attachments];
    if (message.image_path) attachments.push(attachmentSchema.parse({ path: message.image_path, type: /\.jpe?g$/i.test(message.image_path) ? "image/jpeg" : /\.webp$/i.test(message.image_path) ? "image/webp" : "image/png", name: "generated-image" }));
    for (const file of attachments) {
      if (!file.path.startsWith(`${userId}/`)) throw new AIRequestError(403, "File access denied");
      const { data, error } = await supabase.storage.from("chat-media").download(file.path);
      if (error || !data) throw new AIRequestError(400, "Could not read the attached image or file.");
      if (file.type === "text/plain") {
        const text = await data.text();
        if (!text.trim()) throw new AIRequestError(400, "The attached text file is empty.");
        parts.push({ text: `Untrusted file ${file.name}:\n${text}` });
      } else parts.push(nativeFilePart(new Uint8Array(await data.arrayBuffer()), file.type));
    }
    contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }
  if (new TextEncoder().encode(JSON.stringify(contents)).length > 19_000_000) throw new AIRequestError(400, "These files exceed Gemini's 20 MB inline request limit. Please attach smaller files or start a new chat.");
  return contents;
}

/** Live Gemini vision/search preprocessing. No Lovable fallback or invented evidence. */
export async function groundContext(contents: NativeContent[], instructions: string, research: boolean, signal: AbortSignal) {
  const provider = getProviders().find((p) => p.id === "gemini");
  if (!provider?.keys[0]) throw new AIRequestError(400, "Gemini must be configured for native file understanding and live search.");
  await checkAccess("gemini");
  const requestBody = {
    contents,
    systemInstruction: { parts: [{ text: `${instructions}\nAnalyze the actual supplied image/file bytes. Do not infer image appearance from its prompt. Produce a faithful grounding report for the next assistant, retaining facts, uncertainty and source URLs. ${research ? "Search the web for the current query using Google Search. Include fresh evidence, event/publication timestamps and citations. Never call old results live scores." : ""}` }] },
    ...(research ? { tools: [{ google_search: {} }] } : {}),
  };
  if (new TextEncoder().encode(JSON.stringify(requestBody)).length >= 20_000_000) throw new AIRequestError(400, "Files and prompt exceed Gemini's 20 MB inline request limit.");
  let upstream: Response | undefined;
  // Bounded retries only for transient status codes. Denials, credits and retired models are terminal.
  for (let attempt = 0; attempt < 2; attempt++) {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:streamGenerateContent?alt=sse`, {
      method: "POST", signal, headers: { "content-type": "application/json", "x-goog-api-key": provider.keys[0] }, body: JSON.stringify(requestBody),
    });
    if (upstream.ok) break;
    if (attempt === 0 && (upstream.status === 429 || upstream.status >= 500)) {
      const delay = Number(upstream.headers.get("retry-after"));
      await upstream.body?.cancel();
      if (Number.isFinite(delay) && delay > 10) throw new AIRequestError(429, "Gemini is rate limited. Please wait before starting a fresh request.");
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(delay) && delay > 0 ? delay * 1000 : 1200));
      continue;
    }
    throw await safeUpstreamError(upstream, "gemini");
  }
  if (!upstream?.body) throw new AIRequestError(502, "Gemini returned no grounding stream.");
  let text = "";
  let terminal: string | undefined;
  const sources = new Set<string>();
  const parser = createParser({ onEvent(event) {
    const payload = JSON.parse(event.data) as { error?: { message?: string }; promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] };
    if (payload.error) terminal = payload.error.message || "Gemini grounding failed.";
    if (payload.promptFeedback?.blockReason) terminal = `Gemini declined this request: ${payload.promptFeedback.blockReason}`;
    for (const candidate of payload.candidates ?? []) {
      if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST"].includes(candidate.finishReason || "")) terminal = "Gemini declined this request.";
      for (const part of candidate.content?.parts ?? []) text += part.text || "";
      for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) if (chunk.web?.uri) sources.add(chunk.web.uri);
    }
  } });
  const reader = upstream.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    for (;;) { const next = await reader.read(); if (next.done) break; parser.feed(next.value); if (terminal) break; }
  } finally { await reader.cancel().catch(() => {}); }
  if (terminal) throw new AIRequestError(422, terminal);
  if (!text.trim()) throw new AIRequestError(502, "Gemini returned no image/file understanding or search evidence.");
  if (research && sources.size === 0) throw new AIRequestError(422, "Live search returned no verifiable sources. Please try a fresh search; current facts have not been verified.");
  return `${text}\n\n${research ? `Live search fetched at ${new Date().toISOString()}.\nSources:\n${[...sources].join("\n")}` : ""}`;
}