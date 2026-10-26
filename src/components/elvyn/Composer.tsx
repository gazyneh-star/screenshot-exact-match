import { ArrowUp, Plus, Image as ImageIcon, Camera, Paperclip, Globe, Palette } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export function Composer() {
  const { t, send } = useApp();
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    send(v);
    setText("");
    ref.current?.focus();
  };
  const later = () => {
    setSheet(false);
    toast(t.soon);
  };

  return (
    <>
      <div
        onClick={() => setSheet(false)}
        className={cn("fixed inset-0 z-30 bg-background/50 transition-opacity", sheet ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <div
        className={cn(
          "sheet fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-[2rem] p-4 pb-6 transition-transform duration-300",
          sheet ? "translate-y-0" : "translate-y-[110%]",
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/40" />
        <div className="grid grid-cols-3 gap-2.5">
          {[
            [ImageIcon, t.attachPhoto],
            [Camera, t.attachCamera],
            [Paperclip, t.attachFiles],
          ].map(([Icon, label]) => {
            const I = Icon as typeof ImageIcon;
            return (
              <button key={label as string} onClick={later} className="flex flex-col items-center gap-2 rounded-3xl bg-accent/70 py-5 text-[17px] font-medium hover:bg-accent">
                <I className="h-6 w-6" />
                {label as string}
              </button>
            );
          })}
        </div>
        {[
          [Palette, t.createImage, t.createImageDesc],
          [Globe, t.research, t.researchDesc],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof Palette;
          return (
            <button key={title as string} onClick={later} className="flex w-full items-start gap-4 rounded-2xl px-3 py-3.5 text-start hover:bg-accent/50">
              <I className="mt-1 h-5 w-5 shrink-0" />
              <span>
                <span className="block text-[18px] font-medium">{title as string}</span>
                <span className="block text-[15px] text-muted-foreground">{desc as string}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[2rem] border bg-surface px-3 py-2.5 shadow-[0_10px_40px_-10px_var(--glow)]">
        <button aria-label="Add" onClick={() => setSheet(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-accent">
          <Plus className="h-6 w-6" />
        </button>
        <textarea
          ref={ref}
          autoFocus
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t.placeholder}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[17px] outline-none placeholder:text-muted-foreground"
        />
        <button
          aria-label="Send"
          onClick={submit}
          disabled={!text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground transition-opacity disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}
