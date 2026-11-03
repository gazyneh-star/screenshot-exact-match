import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-store";

export function DeleteChatButton({ id, onDeleted, disabled = false }: { id: string; onDeleted: () => void; disabled?: boolean }) {
  const { t, remove } = useApp();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return <>
    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive" disabled={disabled} aria-label={t.deleteChat} title={t.deleteChat} onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" /></Button>
    <Dialog open={open} onOpenChange={(value) => { if (!deleting) setOpen(value); }}><DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg"><DialogTitle>{t.deleteChat}</DialogTitle><DialogDescription>{t.confirmDeleteChat}</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => setOpen(false)}>{t.cancel}</Button><Button variant="destructive" disabled={deleting} onClick={async () => { setDeleting(true); try { if (await remove(id)) { setOpen(false); onDeleted(); } } finally { setDeleting(false); } }}>{t.delete}</Button></div></DialogContent></Dialog>
  </>;
}