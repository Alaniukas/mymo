-- App-wide settings (admin-managed). Singleton row keyed on id = 1.

create table public.app_settings (
  id integer primary key default 1 check (id = 1),
  text_model text not null default 'gemini-3.5-flash',
  image_model text not null default 'gpt-image-2',
  video_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

-- Any authenticated user may READ settings (generation routes need the active models).
create policy "Authenticated users can read app settings"
  on public.app_settings for select
  to authenticated
  using (true);

-- No insert/update/delete policies: writes are blocked under RLS and only
-- performed server-side by the service-role client in /api/admin/settings,
-- after the caller is verified to be an admin.

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Seed the singleton row with code defaults.
insert into public.app_settings (id) values (1)
on conflict (id) do nothing;
