import { ArrowUp, Plus, Image as ImageIcon, Camera, Paperclip, Globe, Palette, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SendInput, SendMode } from "@/lib/chat-schema";

export function Composer({ onSend, busy }: { onSend: (input: SendInput) => Promise<void>; busy?: boolean }) {
  const { t } = useApp();
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<SendMode>("chat");
  const [files, setFiles] = useState<File[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);
  const submit = async () => {
    const v = text.trim();
    if (!v || busy) return;
    const input = { text: v, mode, files };
    setText(""); setFiles([]);
    try { await onSend(input); } catch { setText(v); setFiles(input.files); }
    ref.current?.focus();
  };
  const attach = (selected: FileList | null) => {
    if (!selected) return;
    const next = Array.from(selected);
    if (next.some((f) => f.size > 20 * 1024 * 1024 || f.size === 0)) { toast.error(t.fileLimit); return; }
    if (files.length + next.length > 4) { toast.error(t.attachmentLimit); return; }
    setFiles([...files, ...next]); setSheet(false); setMode("chat");
  };
  const pick = (input: React.RefObject<HTMLInputElement | null>) => { setSheet(false); input.current?.click(); };
  return <>
    <input ref={photo} aria-label={t.attachPhoto} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
    <input ref={camera} aria-label={t.attachCamera} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
    <input ref={documents} aria-label={t.attachFiles} hidden type="file" accept=".pdf,.txt,.md,.csv,.json" multiple onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
    {sheet && <><div onClick={() => setSheet(false)} className="fixed inset-0 z-30 bg-background/50" />
      <div role="dialog" aria-label={t.tools} className="sheet fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-[2rem] p-4 pb-6">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/40" />
        <div className="grid grid-cols-3 gap-2.5">
          {[[ImageIcon, t.attachPhoto, photo], [Camera, t.attachCamera, camera], [Paperclip, t.attachFiles, documents]].map(([Icon, label, input]) => {
            const I = Icon as typeof ImageIcon;
            return <Button variant="ghost" key={label as string} onClick={() => pick(input as React.RefObject<HTMLInputElement | null>)} className="h-auto flex-col gap-2 rounded-3xl bg-accent/70 py-5 text-[17px]"><I />{label as string}</Button>;
          })}
        </div>
        {[[Palette, t.createImage, "image"], [Globe, t.research, "research"]].map(([Icon, label, value]) => {
          const I = Icon as typeof Palette;
          return <Button variant="ghost" key={value as string} onClick={() => { setMode(value as SendMode); setFiles([]); setSheet(false); ref.current?.focus(); }} className="mt-2 h-auto w-full justify-start rounded-2xl px-3 py-3.5 text-[18px]"><I />{label as string}</Button>;
        })}
      </div></>}
    <div className="mx-auto w-full max-w-3xl rounded-[2rem] border bg-surface px-3 py-2.5">
      {(mode !== "chat" || files.length > 0) && <div className="flex flex-wrap gap-2 px-2 pb-2">
        {mode !== "chat" && <Button variant="secondary" size="sm" onClick={() => setMode("chat")} className="rounded-full">{mode === "image" ? <Palette /> : <Globe />}{mode === "image" ? t.createImage : t.research}<X /></Button>}
        {files.map((f, i) => <Button key={i} variant="secondary" size="sm" onClick={() => setFiles(files.filter((_, index) => i !== index))} className="max-w-full rounded-full"><Paperclip /><span className="truncate">{f.name}</span><X /></Button>)}
      </div>}
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" aria-label="Add" disabled={busy} onClick={() => setSheet(true)} className="h-11 w-11 shrink-0 rounded-full"><Plus /></Button>
        <textarea ref={ref} rows={1} value={text} maxLength={10000} onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }} placeholder={mode === "image" ? t.imagePrompt : t.placeholder} className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[17px] outline-none placeholder:text-muted-foreground" />
        <Button size="icon" aria-label="Send" onClick={() => void submit()} disabled={!text.trim() || busy} className="h-11 w-11 shrink-0 rounded-full bg-brand text-brand-foreground"><ArrowUp /></Button>
      </div>
    </div>
  </>;
}
