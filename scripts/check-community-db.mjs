/** Quick check: does community_templates exist in remote Supabase? */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.from("community_templates").select("id").limit(1);

if (error) {
  console.log("community_templates ERROR:", error.message);
  console.log("\nApply: supabase/migrations/017_community_templates.sql in Supabase SQL Editor");
  process.exit(1);
}

console.log("community_templates OK — rows sample:", data?.length ?? 0);
const { count } = await supabase
  .from("community_templates")
  .select("*", { count: "exact", head: true });
console.log("Total templates:", count);
