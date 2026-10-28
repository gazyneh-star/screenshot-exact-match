export class AIRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function checkAccess(scope: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("ai_access_state").select("reason,status").in("scope", [scope, "gateway"]);
  if (error) throw new AIRequestError(503, "Could not check AI access. Please try again later.");
  if (data?.[0]) throw new AIRequestError(data[0].status, data[0].reason);
}

export async function safeUpstreamError(response: Response, scope: string) {
  const text = await response.text();
  let message = `AI request failed (${response.status}).`;
  let type = "";
  try {
    const body = JSON.parse(text);
    message = body.message || body.error?.message || message;
    type = body.type || body.error?.type || "";
  } catch { /* Never expose arbitrary provider response bodies. */ }
  if (response.status === 402 || response.status === 403) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceBlock = response.status === 402 || ["credit_limit_reached", "ai_disabled"].includes(type);
    const { error } = await supabaseAdmin.from("ai_access_state").upsert({ scope: workspaceBlock ? "gateway" : scope, status: response.status, reason: message });
    if (error) throw new AIRequestError(response.status, message);
  }
  return new AIRequestError(response.status, message);
}