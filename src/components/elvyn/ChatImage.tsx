import { useEffect, useRef, useState } from "react";
import { Download, Maximize2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { loadChatMedia, downloadChatMedia } from "@/lib/chat-media";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export function ChatImage({ path, source, name, final = true }: { path?: string | null | undefined; source?: string | undefined; name: string; final?: boolean }) {
  const { t } = useApp();
  const [url, setUrl] = useState(source);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  const objectUrl = useRef<string>();
  useEffect(() => {
    let active = true;
    setError(undefined);
    if (!path) { setUrl(source); return; }
    setLoading(true);
    void loadChatMedia(path).then((blob) => {
      if (!active) return;
      const next = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = next; setUrl(next);
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : t.imageUnavailable); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = undefined; } };
  }, [path, source, version, t.imageUnavailable]);
  const download = async () => {
    setDownloading(true);
    try { await downloadChatMedia(name, path, url); } catch (e) { toast.error(e instanceof Error ? e.message : t.imageUnavailable); } finally { setDownloading(false); }
  };
  return <div className="mt-2 min-w-0">
    {url && !error && <Button variant="ghost" className="h-auto w-full overflow-hidden rounded-lg p-0" disabled={!final} aria-label={t.openImage} title={t.openImage} onClick={() => setOpen(true)}><img src={url} alt={name} onError={() => setError(t.imageUnavailable)} className={cn("max-h-96 w-full object-contain transition-[filter]", final ? "blur-0" : "blur-2xl")} /></Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {final && <><Button variant="ghost" size="sm" disabled={loading || !url || Boolean(error)} onClick={() => setOpen(true)}><Maximize2 className="h-4 w-4" />{t.openImage}</Button><Button variant="ghost" size="sm" disabled={downloading || loading} onClick={() => void download()}><Download className="h-4 w-4" />{t.download}</Button></>}
      {error && path && <Button variant="ghost" size="sm" onClick={() => setVersion((v) => v + 1)}><RefreshCw className="h-4 w-4" />{t.retry}</Button>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-lg" aria-describedby={undefined}>
      <DialogTitle className="truncate pe-6 text-base">{name}</DialogTitle>
      {url && <img src={url} alt={name} className="max-h-[70dvh] w-full object-contain" />}
      <Button variant="outline" disabled={downloading} onClick={() => void download()}><Download className="h-4 w-4" />{t.download}</Button>
    </DialogContent></Dialog>
  </div>;
}