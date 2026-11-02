import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Buffer } from "node:buffer";

export const Route = createFileRoute("/api/generate-image")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticateRequest } = await import("@/lib/request-auth.server");
    if (!await authenticateRequest(request)) return new Response("Unauthorized", { status: 401 });
    const parsed = z.object({ prompt: z.string().trim().min(1).max(10000), provider: z.enum(["lovable", "pollinations"]).default("lovable"), stream: z.boolean().default(true) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response("Enter an image description", { status: 400 });
    const { AIRequestError, checkAccess, safeUpstreamError } = await import("@/lib/ai-access.server");
    try {
      if (parsed.data.provider === "pollinations") {
        await checkAccess("pollinations");
        const key = process.env["POLLINATIONS_API_KEY"]?.trim();
        const model = process.env["POLLINATIONS_IMAGE_MODEL"]?.trim();
        if (!key || !model) throw new AIRequestError(400, "Pollinations image generation needs its API key and current image model configured.");
        const imageUrl = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(parsed.data.prompt)}`);
        imageUrl.searchParams.set("model", model);
        const image = await fetch(imageUrl, { headers: { authorization: `Bearer ${key}` } });
        if (!image.ok) throw await safeUpstreamError(image, "pollinations");
        const mime = image.headers.get("content-type")?.split(";")[0] || "";
        if (!mime.startsWith("image/")) throw new AIRequestError(502, "Pollinations returned no image.");
        const bytes = new Uint8Array(await image.arrayBuffer());
        const { nativeFilePart } = await import("@/lib/grounding.server");
        nativeFilePart(bytes, mime);
        const b64 = Buffer.from(bytes).toString("base64");
        const payload = { b64_json: b64, mime_type: mime };
        return new Response(parsed.data.stream ? `event: image_generation.completed\ndata: ${JSON.stringify(payload)}\n\n` : JSON.stringify({ data: [payload] }), { headers: { "Content-Type": parsed.data.stream ? "text/event-stream" : "application/json", "Cache-Control": "no-store" } });
      }
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