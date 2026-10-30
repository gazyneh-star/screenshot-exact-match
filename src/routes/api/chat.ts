import { createFileRoute } from "@tanstack/react-router";
import { chatSchema } from "@/lib/chat-schema";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateRequest } = await import("@/lib/request-auth.server");
        const auth = await authenticateRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const parsed = chatSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid chat request", { status: 400 });
        const { messages, provider: selected, mode } = parsed.data;
        try {
          const { AIRequestError, checkAccess, recordStreamError } = await import("@/lib/ai-access.server");
          const hasMedia = messages.some((m) => m.attachments.length > 0);
          if (mode === "research" || hasMedia) {
            await checkAccess("lovable");
            const { createResponsesCall } = await import("@/lib/research.server");
            const { sdkImage } = await import("@/lib/media-parts");
            const formatted = [];
            for (const message of messages) {
              if (message.role === "assistant") { formatted.push({ role: "assistant" as const, content: message.content }); continue; }
              const content: import("ai").UserContent = [{ type: "text", text: message.content }];
              for (const attachment of message.attachments) {
                if (!attachment.path.startsWith(`${auth.userId}/`)) throw new AIRequestError(403, "File access denied");
                const { data, error } = await auth.supabase.storage.from("chat-media").createSignedUrl(attachment.path, 600);
                if (error || !data) throw new AIRequestError(400, "Could not open the attached file");
                if (attachment.type.startsWith("image/")) content.push(sdkImage(data.signedUrl));
                else if (attachment.type === "application/pdf") content.push({ type: "file", data: new URL(data.signedUrl), mediaType: attachment.type, filename: attachment.name });
                else {
                  const { data: file, error: fileError } = await auth.supabase.storage.from("chat-media").download(attachment.path);
                  if (fileError || !file) throw new AIRequestError(400, "Could not read the file");
                  content.push({ type: "text", text: `Attachment ${attachment.name}:\n${(await file.text()).slice(0, 20000)}` });
                }
              }
              formatted.push({ role: "user" as const, content });
            }
            const key = process.env["LOVABLE_API_KEY"];
            if (!key) throw new AIRequestError(401, "AI is not configured");
            const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, model: "openai/gpt-6-astra" }, formatted, "You are Elvyn. Answer in the user's language. Cite source URLs when researching.", mode === "research");
            const iterator = call.result.fullStream[Symbol.asyncIterator]();
            let first = await iterator.next();
            while (!first.done && first.value.type !== "error" && first.value.type !== "text-delta" && first.value.type !== "source") first = await iterator.next();
            if (!first.done && first.value.type === "error") {
              throw await recordStreamError(first.value.error, "lovable");
            }
            const encoder = new TextEncoder();
            const stream = new ReadableStream<Uint8Array>({ async start(controller) {
              try {
                while (!first.done) {
                  const part = first.value;
                  if (part.type === "text-delta") controller.enqueue(encoder.encode(part.text));
                  if (part.type === "source" && part.sourceType === "url") controller.enqueue(encoder.encode(`\n\n[${part.title || part.url}](${part.url})\n`));
                  if (part.type === "error") {
                    const error = await recordStreamError(part.error, "lovable");
                    controller.enqueue(encoder.encode(`\n\n${error.message}`));
                    controller.close(); return;
                  }
                  first = await iterator.next();
                }
                controller.close();
              } catch (error) { controller.error(error); }
            } });
            return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-elvyn-provider": "Elvyn built-in", "x-elvyn-model": "openai/gpt-6-astra" } });
          }
          const { routeChat, sseToText } = await import("@/lib/providers.server");
          const { provider, body: stream } = await routeChat(messages, request.signal, selected);
          return new Response(sseToText(stream), {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-cache",
              "x-elvyn-provider": provider.name,
              "x-elvyn-model": provider.model,
            },
          });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          const { AIRequestError } = await import("@/lib/ai-access.server");
          return new Response(e instanceof Error ? e.message : "Provider error", { status: e instanceof AIRequestError ? e.status : 502 });
        }
      },
    },
  },
});
