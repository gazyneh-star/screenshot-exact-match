import { z } from "zod";

export const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().min(1).max(1024),
  type: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]),
});
export type Attachment = z.infer<typeof attachmentSchema>;
export type SendMode = "chat" | "image" | "research";
export type SendInput = { text: string; mode: SendMode; files: File[] };
export const chatSchema = z.object({
  provider: z.string().max(40).default("auto"),
  responseLanguage: z.enum(["auto", "ru", "en", "ar"]).default("auto"),
  persona: z.string().max(4000).default(""),
  mode: z.enum(["chat", "research"]).default("chat"),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(20000),
    image_path: z.string().max(1024).nullable().optional(),
    attachments: z.array(attachmentSchema).max(4).default([]),
  })).min(1).max(30),
});