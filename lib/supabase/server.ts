import "server-only";

import { createClient } from "@supabase/supabase-js";

function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}

const supabase = createServerClient();

export function getServerClient() {
  return supabase;
}
