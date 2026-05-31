import Link from "next/link";
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
          Choose which AI models power captions, hook images, carousel video, and
          hook reel animation.
        </p>
      </div>

      <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_0_#000]">
        <p className="text-sm font-semibold">Hook library</p>
        <p className="mt-1 text-xs text-[#666]">
          Manage premade hooks and viral hook templates founders stitch to their
          app demos.
        </p>
        <Link
          href="/admin/hooks"
          className="mt-3 inline-block text-sm font-semibold text-[var(--ember)] underline"
        >
          Open hook library →
        </Link>
      </div>

      <ModelSettingsForm
        initialSettings={settings}
        serviceRoleConfigured={isServiceRoleConfigured()}
      />
    </div>
  );
}
