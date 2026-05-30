"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SidebarProfileProps {
  userEmail?: string;
  isAdmin?: boolean;
  collapsed?: boolean;
}

export function SidebarProfile({
  userEmail,
  isAdmin = false,
  collapsed = false,
}: SidebarProfileProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const initial = (userEmail?.trim()[0] ?? "U").toUpperCase();

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border-2 border-black bg-white p-1 shadow-[3px_3px_0_0_#000]">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#333] transition-colors hover:bg-gray-100"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#333] transition-colors hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border-2 border-transparent px-2 py-1.5 text-left transition-colors hover:border-black hover:bg-white/70",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[var(--ember)] text-sm font-bold text-white">
          {initial}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#1a1a1a]">
              {userEmail ?? "Account"}
            </span>
            <span className="block text-[11px] text-[#666]">Free Plan</span>
          </span>
        )}
      </button>
    </div>
  );
}
