-- Veyrova Issues and private binary assets (run AFTER projects and 202610200001)
create table if not exists public.veyrova_issues (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 160),
 body text not null default '' check (length(body) <= 10000),
 status text not null default 'open' check (status in ('open','closed')),
 created_at timestamptz not null default now()
);
create index if not exists veyrova_issues_project_idx on public.veyrova_issues(project_id,created_at desc);
alter table public.veyrova_issues enable row level security;
create policy "Veyrova issue select" on public.veyrova_issues for select to authenticated using
 (user_id=auth.uid() and exists (select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));
create policy "Veyrova issue insert" on public.veyrova_issues for insert to authenticated with check
 (user_id=auth.uid() and exists (select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));
create policy "Veyrova issue update" on public.veyrova_issues for update to authenticated using
 (user_id=auth.uid() and exists (select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid())) with check
 (user_id=auth.uid() and exists (select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));
create policy "Veyrova issue delete" on public.veyrova_issues for delete to authenticated using
 (user_id=auth.uid() and exists (select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit)
 values ('veyrova-assets','veyrova-assets',false,10485760)
 on conflict (id) do update set public=false,file_size_limit=10485760;
-- Storage key: <user_uuid>/<project_uuid>/<unique_filename>
create policy "Veyrova assets read" on storage.objects for select to authenticated using (
 bucket_id='veyrova-assets' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2] and p.user_id=auth.uid()));
create policy "Veyrova assets upload" on storage.objects for insert to authenticated with check (
 bucket_id='veyrova-assets' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2] and p.user_id=auth.uid()));
create policy "Veyrova assets delete" on storage.objects for delete to authenticated using (
 bucket_id='veyrova-assets' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2] and p.user_id=auth.uid()));
