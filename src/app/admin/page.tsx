import { createClient } from "@/lib/supabase/server";
import { getModelSettings } from "@/lib/settings/service";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { ModelSettingsForm } from "@/components/admin/model-settings-form";

export const metadata = {
  title: "Admin · Mymo",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const settings = await getModelSettings(supabase);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
        <p className="text-[#666] mt-1">
          Choose which AI models power text, image, and video generation across
          the app.
        </p>
      </div>

      <ModelSettingsForm
        initialSettings={settings}
        serviceRoleConfigured={isServiceRoleConfigured()}
      />
    </div>
  );
}
