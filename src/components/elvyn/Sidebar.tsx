import { Link, useNavigate } from "@tanstack/react-router";
import { Search, SquarePen, Settings, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/app-store";
import { ElvynLogo } from "./Logo";
import { cn } from "@/lib/utils";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, conversations, activeId, setActiveId, rename, remove } = useApp();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const list = conversations.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  const go = (id: string | null) => {
    setActiveId(id);
    navigate({ to: "/" });
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-30 bg-background/60 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex w-[82%] max-w-[320px] flex-col bg-background px-4 pb-5 pt-5 transition-transform duration-300 lg:static lg:w-[288px] lg:translate-x-0 lg:border-e",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 ps-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <ElvynLogo className="h-8 w-8 shrink-0" />
            <span className="truncate text-[26px] font-semibold tracking-tight">Elvyn</span>
          </div>
          <button
            aria-label={t.search}
            onClick={() => setSearching((s) => !s)}
            className="pill grid h-11 w-11 shrink-0 place-items-center transition-colors hover:bg-accent"
          >
            {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>

        {searching && (
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="pill mt-4 h-11 px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
        )}

        <div className="mx-2 mt-5 border-t" />
        <p className="px-2 pb-1 pt-4 text-sm text-muted-foreground">{t.recent}</p>

        <nav className="-mx-1 flex-1 overflow-y-auto">
          {list.length === 0 && <p className="px-3 py-3 text-[15px] text-muted-foreground">{t.noChats}</p>}
          {list.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-2xl px-3 py-1",
                c.id === activeId ? "bg-surface" : "hover:bg-surface/60",
              )}
            >
              <button onClick={() => go(c.id)} className="min-w-0 flex-1 truncate py-2.5 text-start text-[17px]">
                {c.title}
              </button>
              <button
                aria-label={t.rename}
                onClick={() => {
                  const n = prompt(t.rename, c.title);
                  if (n?.trim()) rename(c.id, n.trim());
                }}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                aria-label={t.delete}
                onClick={() => remove(c.id)}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => go(null)}
            className="flex h-14 items-center gap-2.5 rounded-full bg-brand px-6 text-lg font-semibold text-brand-foreground shadow-[0_0_30px_-6px_var(--glow)] transition-transform active:scale-95"
          >
            <SquarePen className="h-5 w-5" />
            {t.newChat}
          </button>
          <Link
            to="/settings"
            onClick={onClose}
            aria-label={t.settings}
            className="pill grid h-14 w-14 place-items-center transition-colors hover:bg-accent"
          >
            <Settings className="h-6 w-6" />
          </Link>
        </div>
      </aside>
    </>
  );
}
