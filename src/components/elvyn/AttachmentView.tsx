import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/lib/chat-schema";

export function AttachmentView({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    supabase.storage.from("chat-media").createSignedUrl(attachment.path, 3600).then(({ data }) => {
      if (active && data) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [attachment.path]);
  return <div className="mt-2">
    {url && attachment.type.startsWith("image/") && <img src={url} alt={attachment.name} className="mb-2 max-h-56 max-w-full rounded-lg object-contain" />}
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground"><Paperclip className="h-4 w-4 shrink-0" /><span className="break-all">{attachment.name}</span></a>
  </div>;
}