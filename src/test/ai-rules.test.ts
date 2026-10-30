import { afterEach, describe, expect, it, vi } from "vitest";
import { streamImage } from "@/lib/stream-image";
import { routeChat, sseToText } from "@/lib/providers.server";
import { AIRequestError } from "@/lib/ai-access.server";

vi.mock("@/lib/ai-access.server", () => ({
  AIRequestError: class extends Error { constructor(public status: number, message: string) { super(message); } },
  checkAccess: vi.fn(async () => {}),
  safeUpstreamError: vi.fn(async (response: Response) => new AIRequestError(response.status, "Access denied")),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Provider behavior", () => {
  it("sends the explicitly selected provider without invoking another", async () => {
    vi.stubEnv("GEMINI_KEYS", "test-gemini"); vi.stubEnv("GROQ_KEYS", "test-groq");
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => new Response("data: [DONE]\n")); vi.stubGlobal("fetch", fetcher);
    const result = await routeChat([{ role: "user", content: "Hello" }], new AbortController().signal, "groq");
    expect(result.provider.id).toBe("groq");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("api.groq.com");
  });
  it("never falls back after a provider access denial", async () => {
    vi.stubEnv("GEMINI_KEYS", "test-gemini"); vi.stubEnv("GROQ_KEYS", "test-groq");
    const fetcher = vi.fn(async () => new Response("denied", { status: 403 })); vi.stubGlobal("fetch", fetcher);
    await expect(routeChat([{ role: "user", content: "Hello" }], new AbortController().signal)).rejects.toThrow("Access denied");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("preserves deltas arriving in split chunks", async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream({ start(c) { c.enqueue(enc.encode('data: {"choices":[{"delta":{"cont')); c.enqueue(enc.encode('ent":"Hello"}}]}\n\ndata: [DONE]\n')); c.close(); } });
    expect(await new Response(sseToText(stream)).text()).toBe("Hello");
  });
});

describe("Image stream recovery", () => {
  it("does not replay a terminal provider error", async () => {
    const fetcher = vi.fn(async () => new Response('event: error\ndata: {"type":"error","error":{"message":"Provider access denied"}}\n\n'));
    vi.stubGlobal("fetch", fetcher);
    await expect(streamImage("/api/generate-image", { prompt: "Cup" }, vi.fn())).rejects.toThrow("Provider access denied");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("does not accept a partial frame as a completed image", async () => {
    const fetcher = vi.fn(async () => new Response('event: image_generation.partial_image\ndata: {"b64_json":"preview"}\n\n'));
    vi.stubGlobal("fetch", fetcher);
    await expect(streamImage("/api/generate-image", { prompt: "Cup" }, vi.fn())).rejects.toThrow("without a completed event");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});