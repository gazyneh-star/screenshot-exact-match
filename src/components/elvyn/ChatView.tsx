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
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamImage } from "@/lib/stream-image";
import { attachmentSchema, type Attachment, type SendInput } from "@/lib/chat-schema";
import { cn } from "@/lib/utils";
import { AttachmentView } from "./AttachmentView";
import { ChatContextControls } from "./ChatContextControls";
import { ChatImage } from "./ChatImage";
import { DeleteChatButton } from "./DeleteChatButton";

export function ChatView({ id }: { id?: string }) {
  const { t, refresh, model, user, responseLanguage } = useApp();
  const [persona, setPersona] = useState("");
  const [contextReady, setContextReady] = useState(!id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const activeId = useRef(id);
  activeId.current = id;
  const endRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipLoad = useRef<string | null>(null);

  useEffect(() => {
    if (!id) { setMessages([]); setPersona(""); setContextReady(true); skipLoad.current = null; return; }
    if (skipLoad.current === id) return;
    let active = true;
    setContextReady(false);
    setMessages([]);
    const personaLoad = supabase.from("conversations").select("persona").eq("id", id).single();
    supabase.from("messages").select("id,role,content,provider,attachments,image_path").eq("conversation_id", id).order("created_at").then(async ({ data, error }) => {
      if (!active) return;
      if (error) { toast.error(error.message); return; }
      const loaded = await Promise.all((data ?? []).map(async (m) => {
        const attachments = attachmentSchema.array().safeParse(m.attachments);
        const image = m.image_path ? await supabase.storage.from("chat-media").createSignedUrl(m.image_path, 3600) : null;
        return { ...m, role: m.role === "user" ? "user" as const : "assistant" as const, attachments: attachments.success ? attachments.data : [], imageSrc: image?.data?.signedUrl, imageFinal: true };
      }));
      const chat = await personaLoad;
      if (active) { if (chat.error || !chat.data) { toast.error(chat.error?.message || "Conversation not found"); return; } setPersona(chat.data.persona); setMessages(loaded); setContextReady(true); }
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (scrolling.current) endRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  const send = async ({ text, mode, files }: SendInput) => {
    if (busyRef.current || !user) return;
    busyRef.current = true;
    setBusy(true);
    let convId = id;
    const draftId = crypto.randomUUID();
    let persistedUser = false;
    try {
      if (!convId) {
        const { data, error } = await supabase.from("conversations").insert({ title: text.slice(0, 60), persona }).select("id").single();
        if (error) throw error;
        convId = data.id;
        skipLoad.current = convId;
      }
      const cid = convId;
      if (!cid) throw new Error("Could not create the conversation");
      const attachments: Attachment[] = [];
      for (const file of files) {
        const type = file.type.startsWith("image/") ? file.type : file.type === "application/pdf" ? file.type : "text/plain";
        const path = `${user.id}/${cid}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const validated = attachmentSchema.parse({ name: file.name, type, path });
        const { error } = await supabase.storage.from("chat-media").upload(path, file, { contentType: type });
        if (error) throw error;
        attachments.push(validated);
      }
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, attachments };
      const history = [...messages, userMsg];
      scrolling.current = true;
      setMessages([...history, { id: draftId, role: "assistant", content: "" }]);
      const { error } = await supabase.from("messages").insert({ conversation_id: cid, role: "user", content: text, attachments });
      if (error) throw error;
      persistedUser = true;
      void refresh();
      const { data: session } = await supabase.auth.getSession();
      const headers = { authorization: `Bearer ${session.session?.access_token ?? ""}` };
      let full = "";
      let provider: string | null = null;
      let chosenModel: string | null = null;
      let imagePath: string | null = null;
      if (mode === "image") {
        let finalImage = "";
        await streamImage("/api/generate-image", { prompt: text, provider: model === "pollinations" ? "pollinations" : "lovable" }, (imageSrc, imageFinal) => {
          if (imageFinal) finalImage = imageSrc;
          setMessages((ms) => ms.map((m) => m.id === draftId ? { ...m, imageSrc, imageFinal } : m));
        }, undefined, headers);
        if (!finalImage) throw new Error(t.aiError);
        const blob = await (await fetch(finalImage)).blob();
        const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
        imagePath = `${user.id}/${cid}/${draftId}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("chat-media").upload(imagePath, blob, { contentType: blob.type || "image/png" });
        if (uploadError) throw uploadError;
        setMessages((ms) => ms.map((m) => m.id === draftId ? { ...m, image_path: imagePath } : m));
        chosenModel = model === "pollinations" ? null : "openai/gpt-image-2.5-sunburst";
        provider = model === "pollinations" ? "Pollinations" : "Elvyn built-in";
      } else {
        const res = await fetch("/api/chat", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ provider: model, mode, persona, responseLanguage, messages: history.filter((m) => m.content || m.attachments?.length || m.image_path).slice(-30).map(({ role, content, attachments, image_path }) => ({ role, content, image_path, attachments: attachments || [] })) }) });
        if (!res.ok || !res.body) { const reason = await res.text(); throw new Error(mode === "research" && res.status === 429 ? `${t.searchQuota}\n\n${reason}` : reason || t.aiError); }
        provider = res.headers.get("x-elvyn-provider"); chosenModel = res.headers.get("x-elvyn-model");
        const reader = res.body.getReader(); const decoder = new TextDecoder();
        let lastPaint = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          if (performance.now() - lastPaint >= 70) {
            const visible = full;
            setMessages((ms) => ms.map((m) => m.id === draftId ? { ...m, content: visible, provider } : m));
            lastPaint = performance.now();
          }
        }
        full += decoder.decode();
        if (!full.trim()) throw new Error("The provider returned no answer.");
        setMessages((ms) => ms.map((m) => m.id === draftId ? { ...m, content: full, provider } : m));
      }
      const { error: saveError } = await supabase.from("messages").insert({ conversation_id: cid, role: "assistant", content: full, provider, model: chosenModel, image_path: imagePath });
      if (saveError) throw saveError;
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", cid);
      await refresh();
      if (id !== cid && activeId.current === id) { skipLoad.current = cid; await navigate({ to: "/chat/$id", params: { id: cid } }); }
    } catch (error) {
      const message = error instanceof Error ? error.message : t.aiError;
      toast.error(message);
      setMessages((ms) => ms.map((m) => m.id === draftId ? { ...m, error: message, imageSrc: undefined } : m));
      if (persistedUser && convId && id !== convId && activeId.current === id) { skipLoad.current = convId; await navigate({ to: "/chat/$id", params: { id: convId } }); }
      if (!persistedUser) throw error;
    } finally { busyRef.current = false; setBusy(false); }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} {...(id ? { activeId: id } : {})} />
      <main className="canvas-glow relative flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4">
          <Button variant="ghost" aria-label="Menu" onClick={() => setOpen(true)} className="pill grid h-12 w-12 shrink-0 place-items-center rounded-full lg:invisible">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 justify-start">
            <ModelSelector />
          </div>
          <Button variant="ghost" aria-label={t.newChat} disabled={busy} onClick={() => { if (!id) { setMessages([]); setPersona(""); } void navigate({ to: "/chat" }); }} className="pill grid h-12 w-12 shrink-0 place-items-center rounded-full hover:bg-accent">
            <SquarePen className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex shrink-0 items-center justify-end px-4"><ChatContextControls key={id || "new"} id={id} persona={persona} busy={busy || !contextReady} onPersona={async (value) => { if (id) { const result = await supabase.from("conversations").update({ persona: value }).eq("id", id); if (result.error) throw result.error; } setPersona(value); }} />{id && <DeleteChatButton id={id} disabled={busy} onDeleted={() => { void navigate({ to: "/chat" }); }} />}</div>

        <div ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (el) scrolling.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4">
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
                      "min-w-0 max-w-[85%] break-words text-[17px] leading-relaxed",
                      m.role === "user" ? "rounded-3xl bg-surface-raised px-4 py-2.5" : "text-foreground",
                    )}
                  >
                    {m.content && (m.role === "user" ? <span className="whitespace-pre-wrap">{m.content}</span> : <div className="[&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_img]:max-w-full [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-3 [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:ps-5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>)}
                    {m.attachments?.map((a) => <AttachmentView key={a.path} attachment={a} />)}
                    {(m.imageSrc || m.image_path) && <ChatImage path={m.image_path} source={m.imageSrc} name={m.image_path?.split("/").pop() || "elvyn-image.png"} final={Boolean(m.imageFinal)} />}
                    {m.error && <p role="alert" className="mt-2 text-destructive">{m.error}</p>}
                    {!m.content && !m.imageSrc && !m.error && busy && <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-2">
          <Composer onSend={send} busy={busy || !contextReady} />
        </div>
      </main>
    </div>
  );
}
