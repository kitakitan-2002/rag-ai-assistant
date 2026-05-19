import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL is not set");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("FAIL: SUPABASE_SERVICE_ROLE_KEY is not set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("Checking Supabase connection...");

  const { error: documentsError } = await supabase
    .from("documents")
    .select("id")
    .limit(1);

  if (documentsError) {
    console.error("FAIL: documents table is not accessible:", documentsError.message);
    process.exit(1);
  }

  console.log("OK: documents table accessible");

  const { error: chunksError } = await supabase
    .from("document_chunks")
    .select("id")
    .limit(1);

  if (chunksError) {
    console.error("FAIL: document_chunks table is not accessible:", chunksError.message);
    process.exit(1);
  }

  console.log("OK: document_chunks table accessible");
  console.log("Supabase connection verified.");
}

main().catch((error) => {
  console.error("FAIL: unexpected error:", error instanceof Error ? error.message : error);
  process.exit(1);
});