import { supabase } from "@/integrations/supabase/client";

export async function deleteConversation(id: string) {
  const { data, error } = await supabase.from("conversations").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.some((row) => row.id === id)) throw new Error("This conversation could not be deleted. Refresh and try again.");
}