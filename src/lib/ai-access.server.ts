export class AIRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function checkAccess(scope: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("ai_access_state").select("reason,status").in("scope", scope === "lovable" ? [scope, "gateway"] : [scope]);
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
  const eligibility = ["provider_not_available_in_region", "model_requires_retention_consent", "model_vendor_not_enabled"].includes(type);
  if (response.status === 402 || (response.status === 403 && !eligibility)) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceBlock = scope === "lovable" && (response.status === 402 || ["credit_limit_reached", "ai_disabled"].includes(type));
    const { error } = await supabaseAdmin.from("ai_access_state").upsert({ scope: workspaceBlock ? "gateway" : scope, status: response.status, reason: message });
    if (error) throw new AIRequestError(response.status, message);
  }
  return new AIRequestError(response.status, message);
}

export async function recordStreamError(error: unknown, scope: string) {
  const e = error as { statusCode?: number; status?: number; responseBody?: string; message?: string; type?: string; code?: string };
  const status = e.statusCode || e.status || (e.type === "permission_error" ? 403 : 502);
  return safeUpstreamError(new Response(e.responseBody || JSON.stringify({ error: e }), { status }), scope);
}