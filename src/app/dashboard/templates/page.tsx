import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { TemplatesClient } from "@/components/dashboard/templates-client";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <TemplatesClient isAdmin={isAdminEmail(user?.email)} />;
}
