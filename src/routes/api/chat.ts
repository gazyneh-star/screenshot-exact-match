import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { routeChat, sseToText, type ChatMsg } from "@/lib/providers.server";

async function verify(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await sb.auth.getClaims(token);
  return error || !data?.claims?.sub ? null : data.claims.sub;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verify(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as { messages?: ChatMsg[] } | null;
        const messages = (body?.messages ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-30)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }));
        if (!messages.length) return new Response("No messages", { status: 400 });
        try {
          const { provider, body: stream } = await routeChat(messages, request.signal);
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
          return new Response(e instanceof Error ? e.message : "Provider error", { status: 502 });
        }
      },
    },
  },
});
