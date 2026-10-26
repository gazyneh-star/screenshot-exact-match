import { createFileRoute } from "@tanstack/react-router";
import { Menu, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-store";
import { Sidebar } from "@/components/elvyn/Sidebar";
import { Composer } from "@/components/elvyn/Composer";
import { ModelSelector } from "@/components/elvyn/ModelSelector";
import { ElvynLogo } from "@/components/elvyn/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elvyn — AI assistant" },
      { name: "description", content: "Elvyn is a premium AI assistant for chat, images, files and research." },
      { property: "og:title", content: "Elvyn — AI assistant" },
      { property: "og:description", content: "Chat, images, files and research in one calm assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { t, conversations, activeId, setActiveId } = useApp();
  const [open, setOpen] = useState(false);
  const active = conversations.find((c) => c.id === activeId);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [active?.messages.length]);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="canvas-glow relative flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4">
          <button aria-label="Menu" onClick={() => setOpen(true)} className="pill grid h-12 w-12 place-items-center lg:invisible">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 justify-start">
            <ModelSelector />
          </div>
          <button aria-label={t.newChat} onClick={() => setActiveId(null)} className="pill grid h-12 w-12 place-items-center hover:bg-accent">
            <SquarePen className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 pb-10 text-center">
              <ElvynLogo className="h-16 w-16" />
              <h1 className="max-w-sm text-[34px] font-medium leading-tight tracking-tight">{t.greeting}</h1>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5 py-6">
              {active.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start gap-3")}>
                  {m.role === "assistant" && <ElvynLogo className="mt-0.5 h-7 w-7 shrink-0" />}
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap text-[17px] leading-relaxed",
                      m.role === "user" ? "rounded-3xl bg-surface-raised px-4 py-2.5" : "text-muted-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-2">
          <Composer />
        </div>
      </main>
    </div>
  );
}
