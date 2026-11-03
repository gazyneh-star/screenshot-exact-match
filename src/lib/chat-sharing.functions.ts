import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachmentSchema } from "./chat-schema";

export const snapshotSchema = z.object({ title: z.string().max(200), persona: z.string().max(4000), messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string(), provider: z.string().nullable(), model: z.string().nullable(), attachments: z.array(attachmentSchema), image_path: z.string().nullable(), position: z.number().int() })) });
export async function codeHash(code: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const generateChatCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ conversationId: z.string().uuid() })).handler(async ({ data, context }) => {
  const chat = await context.supabase.from("conversations").select("title,persona").eq("id", data.conversationId).eq("user_id", context.userId).single();
  if (chat.error || !chat.data) throw new Error("Conversation not found.");
  const messages = await context.supabase.from("messages").select("role,content,provider,model,attachments,image_path").eq("conversation_id", data.conversationId).order("created_at").order("id");
  if (messages.error) throw new Error(messages.error.message);
  const snapshot = snapshotSchema.parse({ ...chat.data, messages: (messages.data ?? []).map((m, position) => ({ ...m, position })) });
  const code = Array.from(crypto.getRandomValues(new Uint8Array(24)), (v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  const saved = await context.supabase.from("chat_snapshots").insert({ conversation_id: data.conversationId, code_hash: await codeHash(code), context: snapshot }).select("id").single();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || "Could not share this chat.");
  return { code, snapshotId: saved.data.id };
});
export const forkChatCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ code: z.string().trim().regex(/^[a-fA-F0-9]{48}$/) })).handler(async ({ data, context }) => {
  // Capability lookup is the sole privileged read: an unguessable code grants this frozen snapshot only.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const source = await supabaseAdmin.from("chat_snapshots").select("context,user_id").eq("code_hash", await codeHash(data.code.toUpperCase())).single();
  if (source.error || !source.data) throw new Error("This chat code is invalid or has been revoked.");
  const sourceOwner = source.data.user_id;
  const payload = snapshotSchema.parse(source.data.context);
  const destination = crypto.randomUUID();
  const uploaded: string[] = [];
  const pathMap = new Map<string, string>();
  const copyFile = async (path: string, type: string) => {
    const existing = pathMap.get(path); if (existing) return existing;
    if (!path.startsWith(`${sourceOwner}/`)) throw new Error("Invalid shared file owner.");
    const file = await supabaseAdmin.storage.from("chat-media").download(path);
    if (file.error || !file.data) throw new Error("A shared file is unavailable; no partial chat was created.");
    const target = `${context.userId}/${destination}/${crypto.randomUUID()}/${path.split("/").pop() || "file"}`;
    const result = await context.supabase.storage.from("chat-media").upload(target, file.data, { contentType: type });
    if (result.error) throw new Error(result.error.message);
    uploaded.push(target); pathMap.set(path, target); return target;
  };
  try {
    for (const message of payload.messages) {
      for (const attachment of message.attachments) attachment.path = await copyFile(attachment.path, attachment.type);
      if (message.image_path) message.image_path = await copyFile(message.image_path, /\.jpe?g$/i.test(message.image_path) ? "image/jpeg" : /\.webp$/i.test(message.image_path) ? "image/webp" : "image/png");
    }
    const imported = await context.supabase.rpc("import_chat_snapshot", { payload });
    if (imported.error || !imported.data) throw new Error(imported.error?.message || "Could not fork this chat.");
    return { conversationId: imported.data };
  } catch (error) {
    if (uploaded.length) await context.supabase.storage.from("chat-media").remove(uploaded);
    throw error;
  }
});