import { Paperclip } from "lucide-react";
import type { Attachment } from "@/lib/chat-schema";
import { ChatImage } from "./ChatImage";
import { Button } from "@/components/ui/button";
import { downloadChatMedia } from "@/lib/chat-media";
import { toast } from "sonner";

export function AttachmentView({ attachment }: { attachment: Attachment }) {
  return <div className="mt-2">
    {attachment.type.startsWith("image/") ? <ChatImage path={attachment.path} name={attachment.name} /> : <Button variant="link" className="h-auto max-w-full whitespace-normal text-start" onClick={() => void downloadChatMedia(attachment.name, attachment.path).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not download file"))}><Paperclip className="h-4 w-4 shrink-0" /><span className="break-all">{attachment.name}</span></Button>}
  </div>;
}