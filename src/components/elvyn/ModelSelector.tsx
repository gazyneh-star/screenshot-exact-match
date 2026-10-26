import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/app-store";

export function ModelSelector() {
  const { t, model, setModel } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0">
      <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-1.5 rounded-full px-3 py-2 text-[20px] font-medium hover:bg-surface">
        <span className="truncate">Elvyn</span>
        <span className="text-muted-foreground">{t.auto}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="sheet absolute start-0 top-full z-20 mt-2 w-72 rounded-3xl p-2">
            <p className="px-3 pb-1 pt-2 text-sm text-muted-foreground">{t.models}</p>
            <button
              onClick={() => { setModel("auto"); setOpen(false); }}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-start hover:bg-accent/60"
            >
              <span className="flex-1">
                <span className="block font-medium">{t.auto}</span>
                <span className="block text-sm text-muted-foreground">{t.autoDesc}</span>
              </span>
              {model === "auto" && <Check className="mt-1 h-4 w-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
