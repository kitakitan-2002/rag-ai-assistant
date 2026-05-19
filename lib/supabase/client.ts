import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client — uses anon key.
// Subject to RLS. Reserved for future client-side use.
// Do NOT use service_role key here.
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
