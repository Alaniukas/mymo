"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Link2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { PlanUsageCard } from "@/components/dashboard/plan-usage-card";
import { SidebarProfile } from "@/components/dashboard/sidebar-profile";
import { ProjectSwitcher } from "@/components/dashboard/project-switcher";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { nicheIdentityLabel } from "@/lib/carousel/niches";
import { cn } from "@/lib/utils";

// Ordered to mirror the simplified content pipeline: set up the brand, add
// assets, pick a template style — then the published OUTPUT. Captions and
// generation now live inside the Create wizard, so there are no separate
// Generate/Review steps. The identity label is filled in per-niche at render.
const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/onboarding", label: "App Identity", icon: Globe },
  { href: "/dashboard/assets", label: "Assets", icon: ImagePlus },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
];

const outputNav = [
  { href: "/dashboard/carousels", label: "Carousels", icon: Layers },
  { href: "/dashboard/connections", label: "Connections", icon: Link2 },
];

interface SidebarProps {
  userEmail?: string;
  isAdmin?: boolean;
}

export function Sidebar({ userEmail, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const { activeProject } = useActiveProject();
  const [collapsed, setCollapsed] = useState(false);

  // The brand-identity step is labelled per-niche ("App Identity", "Brand
  // Identity", or just "Identity" for viral).
  const identityLabel = nicheIdentityLabel(activeProject?.niche);
  const navItems = mainNav.map((item) =>
    item.href === "/dashboard/onboarding"
      ? { ...item, label: identityLabel }
      : item,
  );

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  function renderItem(item: (typeof mainNav)[number]) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-[var(--ember)] text-white shadow-[2px_2px_0_0_#000]"
            : "text-[#1a1a1a] hover:bg-white/70",
          collapsed && "justify-center px-0",
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 overflow-hidden transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[272px]",
      )}
    >
      {/* Sky + clouds lifted from the landing hero — zoomed to keep the airy
          upper sky and crop out the grass/horizon. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-no-repeat"
        style={{
          backgroundImage:
            "url('/assets/landing/Background/background-example.jpg')",
          backgroundSize: "auto 130%",
          backgroundPosition: "center top",
        }}
      />
      {/* Light pastel wash for legibility without washing the sky out */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/25 to-white/40"
      />
      {/* Gradual right-side fade into the content surface so the sidebar melts
          into the dashboard with no visible seam. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, transparent 58%, var(--surface) 100%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 px-1">
              <Logo className="h-6 w-6 text-[#0a0a0a]" />
              <span className="text-lg font-bold tracking-tight">Mymo</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-[#333] transition-colors hover:bg-white/70"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="px-2 pb-2">
          <ProjectSwitcher collapsed={collapsed} />
        </div>

        <div className="px-2 pb-2">
          <Link
            href="/dashboard/carousels/new"
            title={collapsed ? "Create" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 border-black bg-[var(--ember)] py-2.5 font-semibold text-white shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]",
              collapsed ? "px-0" : "px-3",
            )}
          >
            <Plus className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Create</span>}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-1">
          {navItems.map(renderItem)}

          <div className="px-3 pb-1 pt-4">
            {!collapsed ? (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0a0a0a]/45">
                Output
              </span>
            ) : (
              <div className="mx-auto h-px w-6 bg-black/15" />
            )}
          </div>
          {outputNav.map(renderItem)}
        </nav>

        <div className="space-y-2 p-2">
          {!collapsed && <PlanUsageCard />}
          <SidebarProfile
            userEmail={userEmail}
            isAdmin={isAdmin}
            collapsed={collapsed}
          />
        </div>
      </div>
    </aside>
  );
}
