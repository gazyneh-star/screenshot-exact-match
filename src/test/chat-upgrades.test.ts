import { afterEach, describe, expect, it, vi } from "vitest";
import { chainProviders, routeChat } from "@/lib/providers.server";
import { SPEED_CHAIN, SMART_CHAIN, SMART_EXHAUSTED, systemInstructions } from "@/lib/chat-policy";
import { nativeFilePart } from "@/lib/grounding.server";
import { Buffer } from "node:buffer";

vi.mock("@/lib/ai-access.server", () => ({
  AIRequestError: class extends Error { constructor(public status: number, message: string) { super(message); } },
  checkAccess: vi.fn(async () => {}),
  safeUpstreamError: vi.fn(async (res: Response) => Object.assign(new Error("denied"), { status: res.status })),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function configured() {
  for (const name of ["GROQ_KEYS", "CEREBRAS_KEYS", "SAMBANOVA_KEYS", "CLOUDFLARE_API_TOKEN", "GEMINI_KEYS", "TEAMOROUTER_KEYS", "OPENROUTER_KEYS", "TOKEN_HARBOR_KEYS"]) vi.stubEnv(name, "fixture");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "fixture"); vi.stubEnv("CEREBRAS_MODEL", "current-configured-model");
  vi.stubEnv("GEMINI_MODEL", "gemini-current-configured");
  vi.stubEnv("TEAMOROUTER_BASE_URL", "https://teamo.example/v1"); vi.stubEnv("TEAMOROUTER_MODEL", "existing");
  vi.stubEnv("OPENROUTER_MODEL", "deepseek/configured");
  vi.stubEnv("TOKEN_HARBOR_BASE_URL", "https://harbor.example/v1"); vi.stubEnv("TOKEN_HARBOR_MODEL", "existing");
}
describe("Elvyn mode rules", () => {
  it("orders Speed Groq -> Cerebras -> SambaNova -> Cloudflare with the requested Groq model", () => {
    configured(); expect(SPEED_CHAIN).toEqual(["groq", "cerebras", "sambanova", "cloudflare"]);
    expect(chainProviders("speed").map((p) => p.id)).toEqual([...SPEED_CHAIN]);
    expect(chainProviders("speed")[0]?.model).toBe("llama-3.3-70b-versatile");
    expect(chainProviders("speed")[1]?.model).toBe("current-configured-model");
  });
  it("orders Smart Gemini -> TeamoRouter -> OpenRouter -> Token Harbor, preserving approved current Gemini", () => {
    configured(); expect(SMART_CHAIN).toEqual(["gemini", "teamorouter", "openrouter", "tokenharbor"]);
    expect(chainProviders("smart").map((p) => p.id)).toEqual([...SMART_CHAIN]);
    expect(chainProviders("smart")[0]?.model).toBe("gemini-current-configured");
    expect(chainProviders("smart")[1]?.model).toBe("deepseek-v4-pro-free");
  });
  it("does not inject Cerebras into the existing Auto order", () => { configured(); expect(chainProviders("auto").map((p) => p.id)).not.toContain("cerebras"); });
  it("loops through all Speed nodes on transient failure", async () => {
    configured(); vi.useFakeTimers(); const fetcher = vi.fn(async () => new Response("busy", { status: 503 })); vi.stubGlobal("fetch", fetcher);
    const rejection = expect(routeChat([{ role: "user", content: "hi" }], new AbortController().signal, "speed")).rejects.toThrow("All speed nodes");
    await vi.runAllTimersAsync(); await rejection; expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("returns the specified Smart exhaustion error", async () => {
    configured(); vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));
    const rejection = expect(routeChat([], new AbortController().signal, "smart")).rejects.toThrow(SMART_EXHAUSTED);
    await vi.runAllTimersAsync(); await rejection;
  });
});
describe("Native visual input", () => {
  it("passes PNG bytes as native base64, not a URL", () => {
    const bytes = new Uint8Array([137,80,78,71,13,10,26,10]);
    expect(nativeFilePart(bytes,"image/png")).toEqual({ inlineData: { mimeType: "image/png", data: Buffer.from(bytes).toString("base64") } });
  });
  it("rejects mislabeled uploaded files", () => { expect(() => nativeFilePart(new TextEncoder().encode("not an image"),"image/png")).toThrow("do not match"); });
});
describe("Response instructions", () => {
  for (const [code, language] of [["ru", "Russian"], ["en", "English"], ["ar", "Arabic"]] as const) it(`forces ${language} independent of persona language`, () => {
    expect(systemInstructions(code,"Respond in French")).toContain(`Respond only in ${language}`);
  });
  it("preserves Automatic matching and exact supplied current time", () => { const value = systemInstructions("auto","",new Date("2026-10-31T12:06:00Z")); expect(value).toContain("Match the user's language."); expect(value).toContain("2026-10-31T12:06:00.000Z"); });
});