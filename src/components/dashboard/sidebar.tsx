"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  Layers,
  LayoutTemplate,
  Link2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  BarChart3,
  CalendarClock,
  Type,
  Video,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { PlanUsageCard } from "@/components/dashboard/plan-usage-card";
import { SidebarProfile } from "@/components/dashboard/sidebar-profile";
import { ProjectSwitcher } from "@/components/dashboard/project-switcher";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/onboarding", label: "Brand setup", icon: Palette },
  { href: "/dashboard/templates", label: "Hook templates", icon: LayoutTemplate },
];

const outputNav = [
  { href: "/dashboard/carousels", label: "Carousels", icon: Layers },
  { href: "/dashboard/stories/carousel", label: "Simple carousel", icon: Type },
  { href: "/dashboard/founder-hooks/new", label: "Hook reels", icon: Video },
  { href: "/dashboard/library", label: "Library", icon: BookOpen },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/connections", label: "Connections", icon: Link2 },
];

interface SidebarProps {
  userEmail?: string;
  isAdmin?: boolean;
}

export function Sidebar({ userEmail, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/onboarding") {
      return (
        pathname.startsWith("/dashboard/onboarding") ||
        pathname.startsWith("/dashboard/assets")
      );
    }
    return pathname.startsWith(href);
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
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/25 to-white/40"
      />
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
            href="/dashboard/create"
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
          {mainNav.map(renderItem)}

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
