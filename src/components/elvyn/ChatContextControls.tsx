import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Share2, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generateChatCode } from "@/lib/chat-sharing.functions";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-store";

export function ChatContextControls({ id, persona, onPersona, busy }: { id?: string | undefined; persona: string; onPersona: (value: string) => Promise<void>; busy: boolean }) {
  const { t } = useApp();
  const [panel, setPanel] = useState<"persona" | "share" | null>(null);
  const [draft, setDraft] = useState(persona);
  const [working, setWorking] = useState(false);
  const [shared, setShared] = useState<{ code: string; snapshotId: string } | null>(null);
  const generate = useServerFn(generateChatCode);
  const run = async (action: () => Promise<void>) => { setWorking(true); try { await action(); } catch (e) { toast.error(e instanceof Error ? e.message : t.aiError); } finally { setWorking(false); } };
  return <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="rounded-full" aria-label={t.persona} title={t.persona} disabled={busy} onClick={() => { setDraft(persona); setPanel("persona"); }}><SlidersHorizontal className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="rounded-full" aria-label={t.shareChat} title={t.shareChat} disabled={busy || !id} onClick={() => { setShared(null); setPanel("share"); }}><Share2 className="h-4 w-4" /></Button>
    <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}><DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
      <DialogTitle>{panel === "persona" ? t.persona : t.shareChat}</DialogTitle>
      <DialogDescription>{panel === "persona" ? t.personaHint : t.shareWarning}</DialogDescription>
      {panel === "persona" ? <><textarea aria-label={t.persona} value={draft} maxLength={4000} onChange={(e) => setDraft(e.target.value)} className="min-h-36 w-full rounded-lg border bg-background p-3" /><Button disabled={working} onClick={() => void run(async () => { await onPersona(draft.trim()); setPanel(null); })}>{t.save}</Button></> : shared ? <>
        <input readOnly aria-label={t.chatCode} value={shared.code} className="min-w-0 w-full rounded-lg border bg-background p-3 font-mono" />
        <div className="flex gap-2"><Button onClick={() => void run(async () => { await navigator.clipboard.writeText(shared.code); toast.success(t.copied); })}><Copy className="h-4 w-4" />{t.copy}</Button><Button variant="outline" disabled={working} onClick={() => void run(async () => { const result = await supabase.from("chat_snapshots").delete().eq("id", shared.snapshotId); if (result.error) throw result.error; setShared(null); })}><Trash2 className="h-4 w-4" />{t.revoke}</Button></div>
      </> : <Button disabled={working || !id} onClick={() => void run(async () => { if (id) setShared(await generate({ data: { conversationId: id } })); })}>{t.generateCode}</Button>}
    </DialogContent></Dialog>
  </div>;
}