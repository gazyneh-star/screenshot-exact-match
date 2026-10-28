import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { isAdmin: false, providers: [] as { id: string; configured: boolean }[] };
    const { providerStatus } = await import("@/lib/providers.server");
    return { isAdmin: true, providers: providerStatus() };
  });

export const getAvailableProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getProviders } = await import("@/lib/providers.server");
    return getProviders().map(({ id, name, model }) => ({ id, name, model }));
  });
