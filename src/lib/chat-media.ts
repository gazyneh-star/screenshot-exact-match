import { supabase } from "@/integrations/supabase/client";

/** Read private storage afresh so expired preview links never determine downloads. */
export async function loadChatMedia(path?: string | null, source?: string): Promise<Blob> {
  if (path) {
    const { data, error } = await supabase.storage.from("chat-media").download(path);
    if (error || !data) throw new Error(error?.message || "Could not open this file.");
    return data;
  }
  if (!source) throw new Error("This image is unavailable.");
  const response = await fetch(source);
  if (!response.ok) throw new Error("Could not open this image.");
  return response.blob();
}

export async function downloadChatMedia(name: string, path?: string | null, source?: string) {
  const blob = await loadChatMedia(path, source);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the URL alive until the browser has started reading the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}