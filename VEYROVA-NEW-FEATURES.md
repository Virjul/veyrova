# Veyrova — next feature batch

This update adds to the existing Repository Manager:

- Search files by path in a project.
- Export all current project text files as a portable `.json` backup.
- Import a Veyrova `.json` backup into an existing project, validating format, paths, duplicate names, and 1 MB per-file limit. Existing paths are overwritten only after confirmation.
- Existing upload/download/edit/delete and Supabase RLS integrations are retained.

## Before deploying

1. Back up your existing GitHub repository and Supabase project.
2. Run `supabase/migrations/202610200001_veyrova_files.sql` in your Supabase SQL Editor if it has not been applied.
3. In Vercel use **Root Directory = repository root** and output directory `artifacts/veyrova/dist/public` (as configured in `vercel.json`).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel for all intended environments. Do not put service-role keys in frontend variables.
5. Build with `BASE_PATH=/ PORT=3000 pnpm --filter @workspace/veyrova run build`.
6. Test auth, RLS, file upload, backup export/import, and page refresh on the deployed URL.

## Not implemented in this package

Git hosting (real branches, commits, pull requests), GitHub OAuth sync, production backend, database administration, object/binary storage, teams, billing, cloud build runners, automatic deployments, and ZIP import/export. These require additional backend architecture, permissions and infrastructure. Do not advertise them as working.

## Backup limitations

JSON backup contains all text file contents, so treat it as sensitive. Do not upload it publicly. Backup import currently supports at most 100 text files and 12 MB JSON total. Import is not transactional across the application and should be tested with a disposable project first.
