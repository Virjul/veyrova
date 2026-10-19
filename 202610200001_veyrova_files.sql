-- Veyrova Repository File Manager
-- Run this migration in Supabase SQL Editor after backing up your project.
-- This does not alter or recreate public.projects.

create table if not exists public.veyrova_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null check (length(path) between 1 and 240),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint veyrova_files_project_path_unique unique (project_id, path),
  constraint veyrova_files_path_no_parent_traversal check (position('..' in path) = 0)
);

create index if not exists veyrova_files_owner_project_idx
  on public.veyrova_files (user_id, project_id);

alter table public.veyrova_files enable row level security;

drop policy if exists "Users can view own Veyrova files" on public.veyrova_files;
create policy "Users can view own Veyrova files"
on public.veyrova_files for select to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own Veyrova files" on public.veyrova_files;
create policy "Users can create own Veyrova files"
on public.veyrova_files for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own Veyrova files" on public.veyrova_files;
create policy "Users can update own Veyrova files"
on public.veyrova_files for update to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own Veyrova files" on public.veyrova_files;
create policy "Users can delete own Veyrova files"
on public.veyrova_files for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create or replace function public.veyrova_files_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists veyrova_files_updated_at on public.veyrova_files;
create trigger veyrova_files_updated_at
before update on public.veyrova_files
for each row execute function public.veyrova_files_set_updated_at();
