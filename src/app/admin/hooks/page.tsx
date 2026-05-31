import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HookTemplatesAdmin } from "@/components/admin/hook-templates-admin";

export const metadata = {
  title: "Hook library · Admin",
};

export default function AdminHooksPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-[#555] hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        App settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hook library</h1>
        <p className="text-[#666] mt-1 text-sm">
          Premade hooks power our curated A/B set; templates are the founder
          hook gallery. Founders pick these instead of AI-generated hooks.
        </p>
      </div>
      <HookTemplatesAdmin />
    </div>
  );
}
