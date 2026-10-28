import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/generate-image")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticateRequest } = await import("@/lib/request-auth.server");
    if (!await authenticateRequest(request)) return new Response("Unauthorized", { status: 401 });
    const parsed = z.object({ prompt: z.string().trim().min(1).max(10000), stream: z.boolean().default(true) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response("Enter an image description", { status: 400 });
    const { AIRequestError, checkAccess, safeUpstreamError } = await import("@/lib/ai-access.server");
    try {
      await checkAccess("image");
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) return new Response("AI is not configured", { status: 401 });
      const { generateImage, imageSettings } = await import("@/lib/image-gateway.server");
      const upstream = await generateImage({ ...imageSettings, apiKey }, parsed.data.prompt, parsed.data.stream);
      if (!upstream.ok) throw await safeUpstreamError(upstream, "image");
      return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream", "Cache-Control": "no-store" } });
    } catch (error) {
      return new Response(error instanceof Error ? error.message : "Image generation failed", { status: error instanceof AIRequestError ? error.status : 502 });
    }
  },
} } });