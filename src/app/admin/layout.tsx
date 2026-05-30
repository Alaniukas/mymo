import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/admin");
  }

  if (!isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="h-14 border-b-2 border-black bg-white flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[var(--ember)]" />
          <span className="font-bold tracking-tight">Mymo Admin</span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#333] hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </Link>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
