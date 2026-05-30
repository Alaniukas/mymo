// Shared workspace/project types. Kept dependency-free (no `next/headers`,
// no Supabase) so both server modules and Client Components can import it.

export interface ProjectSummary {
  id: string;
  name: string;
  app_url: string | null;
  niche: string | null;
  created_at: string;
}
