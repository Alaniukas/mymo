"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import {
  ResourcesDropdown,
  TemplatesDropdown,
  UseCasesDropdown,
} from "@/components/nav-dropdown";
import { navItems, type NavMenuKey } from "@/lib/nav-menus";
import { cn } from "@/lib/utils";

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<NavMenuKey | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = useCallback((menu: NavMenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveMenu(menu);
    setActiveIndex(0);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActiveMenu(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const closeMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveMenu(null);
  }, []);

  return (
    <header
      className="relative z-50 w-full bg-[#0A0A0A] overflow-visible"
      onMouseLeave={scheduleClose}
    >
      <div className="h-12 max-w-[1200px] mx-auto px-6 flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] text-[16px] text-white/95 font-medium tracking-[-0.018em] font-inter-display">
        <Link
          aria-label="Mymo home"
          className="flex items-center lg:justify-self-start"
          href="/"
        >
          <Logo className="w-7 h-7 text-white" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7 lg:justify-self-center">
          {navItems.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => item.menu && openMenu(item.menu)}
            >
              <Link
                className={cn(
                  "py-3 hover:text-white transition-colors block",
                  activeMenu === item.menu && "text-white",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-4 lg:justify-self-end">
          <div className="hidden lg:flex items-center gap-4">
            <Link className="hover:text-white transition-colors" href="/auth/login">
              Login
            </Link>
            <Link
              className="inline-flex items-center whitespace-nowrap rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors"
              href="/checkout?type=intro"
            >
              Try for only $19
            </Link>
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Desktop mega-menu — sibling of the 48px bar so it is not clipped */}
      {activeMenu && (
        <div
          className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {activeMenu === "Use Cases" && (
            <UseCasesDropdown
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onClose={closeMenu}
            />
          )}
          {activeMenu === "Templates" && (
            <TemplatesDropdown
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onClose={closeMenu}
            />
          )}
          {activeMenu === "Resources" && <ResourcesDropdown onClose={closeMenu} />}
        </div>
      )}

      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0A0A0A] px-6 py-4 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className="block py-2 text-white/95 hover:text-white"
              href={item.href}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className="block py-2 text-white/95 hover:text-white"
            href="/auth/login"
            onClick={() => setMobileOpen(false)}
          >
            Login
          </Link>
          <Link
            className="inline-flex items-center rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] px-3 py-2 text-[13px] font-semibold text-white"
            href="/checkout?type=intro"
            onClick={() => setMobileOpen(false)}
          >
            Try for only $19
          </Link>
        </div>
      )}
    </header>
  );
}
