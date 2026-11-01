import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/app-store";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAvailableProviders } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export function ModelSelector() {
  const { t, model, setModel } = useApp();
  const [open, setOpen] = useState(false);
  const fetchProviders = useServerFn(getAvailableProviders);
  const providers = useQuery({ queryKey: ["available-providers"], queryFn: () => fetchProviders(), staleTime: 300000 });
  return (
    <div className="relative min-w-0">
      <Button variant="ghost" onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-1.5 rounded-full px-3 py-2 text-[20px] font-medium hover:bg-surface">
        <span className="truncate">Elvyn</span>
        <span className="max-w-32 truncate text-muted-foreground">{model === "auto" ? t.auto : model === "speed" ? t.speed : model === "smart" ? t.smart : providers.data?.find((p) => p.id === model)?.name || model}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="sheet absolute start-0 top-full z-20 mt-2 w-72 rounded-3xl p-2">
            <p className="px-3 pb-1 pt-2 text-sm text-muted-foreground">{t.models}</p>
            <Button variant="ghost"
              onClick={() => { setModel("auto"); setOpen(false); }}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-start hover:bg-accent/60"
            >
              <span className="flex-1">
                <span className="block font-medium">{t.auto}</span>
                <span className="block text-sm text-muted-foreground">{t.autoDesc}</span>
              </span>
              {model === "auto" && <Check className="mt-1 h-4 w-4" />}
            </Button>
            {(["speed", "smart"] as const).map((mode) => <Button key={mode} variant="ghost" onClick={() => { setModel(mode); setOpen(false); }} className="h-auto w-full justify-start rounded-2xl px-3 py-2.5"><span className="flex-1 text-start">{t[mode]}</span>{model === mode && <Check className="h-4 w-4" />}</Button>)}
            {providers.data?.map((p) => <Button key={p.id} variant="ghost" onClick={() => { setModel(p.id); setOpen(false); }} className="h-auto w-full justify-start rounded-2xl px-3 py-2.5 text-start">
              <span className="min-w-0 flex-1"><span className="block">{p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.model}</span></span>{model === p.id && <Check />}
            </Button>)}
          </div>
        </>
      )}
    </div>
  );
}
