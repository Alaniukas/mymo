import Link from "next/link";
import { Logo } from "@/components/logo";

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Use Cases",
    links: [
      { href: "/use-case/ecommerce", label: "E-commerce" },
      { href: "/use-case/dropshipping", label: "Dropshipping" },
      { href: "/use-case/saas", label: "SaaS" },
      { href: "/use-case/agencies", label: "Agencies" },
    ],
  },
  {
    title: "Templates",
    links: [
      { href: "/templates/podcast-style", label: "Podcast" },
      { href: "/templates/street-interview", label: "Street Interviews" },
      { href: "/templates/reaction", label: "Product Reviews" },
      { href: "/templates", label: "All Templates" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/learn/what-is-ugc", label: "What is UGC?" },
      { href: "/learn/ai-ugc-explained", label: "AI UGC Explained" },
      { href: "/learn/what-is-roas", label: "What is ROAS?" },
      { href: "/learn", label: "All Guides" },
    ],
  },
  {
    title: "Compare",
    links: [
      { href: "/compare/synthesia", label: "Mymo vs Synthesia" },
      { href: "/compare/arcads", label: "Mymo vs Arcads" },
      { href: "/compare/heygen", label: "Mymo vs HeyGen" },
      { href: "/compare/best-ai-ugc-tools", label: "Best AI UGC Tools" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/help", label: "Help Centre" },
      { href: "/pricing", label: "Pricing" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="relative bg-[#0A0A0A] text-white/80 pt-16 sm:pt-20 pb-8 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
          backgroundSize: "220px 220px",
        }}
      />
      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-10 sm:mb-12">
          <Logo className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          <span className="font-gambarino text-[36px] sm:text-[48px] leading-none tracking-[-0.04em] text-white">
            Mymo
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 sm:gap-10 mb-12 sm:mb-16">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/50 mb-4">
                {column.title}
              </p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="text-[14px] text-white/80 hover:text-white transition-colors"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-white/10">
          <p className="text-[12px] text-white/50">
            © {new Date().getFullYear()} UAB Mymo. All rights reserved.
          </p>
          <p
            className="text-[18px] text-[var(--ember)] -rotate-2"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            made with ♥ in Vilnius
          </p>
        </div>
      </div>
    </footer>
  );
}
