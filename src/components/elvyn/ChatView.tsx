import { useNavigate } from "@tanstack/react-router";
import { Menu, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp, type Msg } from "@/lib/app-store";
import { Sidebar } from "./Sidebar";
import { Composer } from "./Composer";
import { ModelSelector } from "./ModelSelector";
import { ElvynLogo } from "./Logo";
import { cn } from "@/lib/utils";

export function ChatView({ id }: { id?: string }) {
  const { t, refresh } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const skipLoad = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return setMessages([]);
    if (skipLoad.current === id) return; // just created here; state already current
    supabase
      .from("messages")
      .select("id,role,content,provider")
      .eq("conversation_id", id)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setMessages((data ?? []) as Msg[]);
      });
  }, [id]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const send = async (text: string) => {
    if (busy) return;
    setBusy(true);
    let convId: string | undefined = id;
    try {
      if (!convId) {
        const { data, error } = await supabase.from("conversations").insert({ title: text.slice(0, 60) }).select("id").single();
        if (error) throw error;
        convId = data.id;
        skipLoad.current = convId;
        navigate({ to: "/chat/$id", params: { id: convId } });
      }
      const cid: string = convId!;
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
      const history = [...messages, userMsg];
      const draftId = crypto.randomUUID();
      setMessages([...history, { id: draftId, role: "assistant", content: "" }]);
      const { error: e1 } = await supabase.from("messages").insert({ conversation_id: cid, role: "user", content: text });
      if (e1) throw e1;

      const { data: s } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || t.aiError);
      const provider = res.headers.get("x-elvyn-provider");
      const model = res.headers.get("x-elvyn-model");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMessages((ms) => ms.map((m) => (m.id === draftId ? { ...m, content: full, provider } : m)));
      }
      const { error: e2 } = await supabase.from("messages").insert({ conversation_id: cid, role: "assistant", content: full, provider, model });
      if (e2) throw e2;
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", cid);
      void refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.aiError;
      toast.error(`${t.aiError}: ${msg}`);
      setMessages((ms) => ms.filter((m) => !(m.role === "assistant" && !m.content)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} {...(id ? { activeId: id } : {})} />
      <main className="canvas-glow relative flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4">
          <button aria-label="Menu" onClick={() => setOpen(true)} className="pill grid h-12 w-12 place-items-center lg:invisible">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 justify-start">
            <ModelSelector />
          </div>
          <button aria-label={t.newChat} onClick={() => navigate({ to: "/chat" })} className="pill grid h-12 w-12 place-items-center hover:bg-accent">
            <SquarePen className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 pb-10 text-center">
              <ElvynLogo className="h-16 w-16" />
              <h1 className="max-w-sm text-[34px] font-medium leading-tight tracking-tight">{t.greeting}</h1>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5 py-6">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start gap-3")}>
                  {m.role === "assistant" && <ElvynLogo className="mt-0.5 h-7 w-7 shrink-0" />}
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap text-[17px] leading-relaxed",
                      m.role === "user" ? "rounded-3xl bg-surface-raised px-4 py-2.5" : "text-foreground",
                    )}
                  >
                    {m.content || <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand" />}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-2">
          <Composer onSend={send} busy={busy} />
        </div>
      </main>
    </div>
  );
}
