import Link from "next/link";
import {
  Palette,
  LayoutTemplate,
  Layers,
  Link2,
  ArrowRight,
  ImagePlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace/active";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProjectOverview } from "@/components/dashboard/project-overview";

async function getProjectStats(workspaceId: string) {
  const supabase = await createClient();

  const [
    identityResult,
    assetsResult,
    templatesResult,
    carouselsResult,
    connectionsResult,
  ] = await Promise.all([
    supabase
      .from("app_identities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("carousel_templates")
      .select("id", { count: "exact", head: true })
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`),
    supabase
      .from("carousels")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("social_connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
  ]);

  return {
    hasIdentity: (identityResult.count ?? 0) > 0,
    assetCount: assetsResult.count ?? 0,
    templateCount: templatesResult.count ?? 0,
    carouselCount: carouselsResult.count ?? 0,
    connectionCount: connectionsResult.count ?? 0,
  };
}

export default async function DashboardPage() {
  const { activeProjectId } = await getActiveWorkspace();

  const stats = activeProjectId
    ? await getProjectStats(activeProjectId)
    : {
        hasIdentity: false,
        assetCount: 0,
        templateCount: 0,
        carouselCount: 0,
        connectionCount: 0,
      };

  const brandSetupDone = stats.hasIdentity;
  const brandSetupValue = stats.hasIdentity
    ? stats.assetCount > 0
      ? `Active · ${stats.assetCount} images`
      : "Identity set"
    : "Not set";

  const quickActions = [
    {
      label: "Set up your brand",
      description:
        "Identity, colors, and product photos — one place for voice and images",
      href: "/dashboard/onboarding",
      done: brandSetupDone,
    },
    {
      label: "Add a Template",
      description: "Import or upload a carousel style to replicate",
      href: "/dashboard/templates",
      icon: LayoutTemplate,
      done: stats.templateCount > 0,
    },
    {
      label: "Create content",
      description: "Brand story, viral memes, or classic template carousel",
      href: "/dashboard/create",
      icon: Layers,
      done: stats.carouselCount > 0,
    },
    {
      label: "Connect Accounts",
      description: "Link TikTok and Instagram for auto-publishing",
      href: "/dashboard/connections",
      icon: Link2,
      done: stats.connectionCount > 0,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-[#666] mt-1">
          Your content generation pipeline at a glance.
        </p>
      </div>

      <ProjectOverview />

      {activeProjectId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Brand setup"
              value={brandSetupValue}
              icon={Palette}
            />
            <StatCard label="Images" value={stats.assetCount} icon={ImagePlus} />
            <StatCard
              label="Carousels"
              value={stats.carouselCount}
              icon={Layers}
            />
            <StatCard
              label="Connections"
              value={stats.connectionCount}
              icon={Link2}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Get started</h2>
            <div className="space-y-3">
              {quickActions.map((action, i) => {
                const Icon = action.icon ?? Palette;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--ember)]/10 shrink-0">
                      <span className="text-sm font-bold text-[var(--ember)]">
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {action.label}
                        </span>
                        {action.done && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#666] mt-0.5">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#999] shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
