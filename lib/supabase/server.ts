import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client — uses service_role key.
// Bypasses RLS, for use in API routes and server components only.
// Never import this in client components.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}

let cached: ReturnType<typeof createClient> | null = null;

export function getServerClient() {
  if (!cached) {
    cached = createServerClient();
  }
  return cached;
}
