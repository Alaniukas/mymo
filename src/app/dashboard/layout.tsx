import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { resolveActiveWorkspace } from "@/lib/workspace/active";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ProjectProvider } from "@/components/dashboard/project-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { activeProjectId, projects } = await resolveActiveWorkspace(
    supabase,
    user.id,
  );

  return (
    <ProjectProvider activeProjectId={activeProjectId} projects={projects}>
      <div className="flex min-h-screen bg-[var(--surface)]">
        <Sidebar userEmail={user.email} isAdmin={isAdminEmail(user.email)} />
        <main className="flex-1 min-w-0 overflow-auto p-6 sm:p-8">
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
}
