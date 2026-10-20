# Veyrova source upgrade — actual scope

## Implemented in this package
- Existing Supabase authentication, projects, text repository file management, multi-file/folder upload and JSON backup features preserved from supplied ZIP.
- NEW: project issue tracker (create, list, close/reopen) using Supabase RLS.
- NEW: private binary asset uploads/download/deletion (10 MB each) through Supabase Storage with owner/project checks.
- NEW: project navigation to Issues and Assets pages.
- SQL migration `supabase/migrations/202610200002_veyrova_issues_assets.sql` for issue table and private storage bucket.

## Setup order
1. Upload source files to GitHub, keeping repository root contents of `Veyrova-Dashboard` at GitHub root.
2. Supabase: ensure `public.projects` exists with UUID id, UUID user_id; run migration `202610200001_veyrova_files.sql` if not already run, then `202610200002_veyrova_issues_assets.sql` (review before running).
3. Vercel: repository root `.`; build `BASE_PATH=/ PORT=3000 pnpm --filter @workspace/veyrova run build`; output `artifacts/veyrova/dist/public`; set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY; deploy.
4. Test auth, project ownership, issues, asset upload/download, file manager and SPA refresh.

## Not implemented / requires separate services
- Self-hosted Git repositories, real commits/branches, pull requests and GitHub sync
- ZIP import/export (JSON backup exists), code execution/live preview, database SQL console
- Custom API service, realtime collaboration, team RBAC, billing, admin panel, domain provisioning and automatic deployment
- Production security/performance audit, integration tests and hosted build verification

These features must NOT be described as working. The source code has not been production-build-tested in this environment.
