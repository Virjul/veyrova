# Veyrova — Updated repository manager

## Included, working implementation
- Existing project dashboard, Supabase email/Google auth, project CRUD, file create/edit/delete retained.
- Added multiple text/code file upload and browser-supported folder upload.
- Files saved to existing `public.veyrova_files` table with owner RLS.
- Existing file paths are updated (upsert); file path and size validation; binary files rejected.
- Download selected text file.
- SPA refresh fallback and Vercel monorepo build/output configuration in root `vercel.json`.

## Limitations
- Text/code files only, maximum 1 MiB each and 100 files per batch; no binary assets, large files, true Git repositories, commits/branches, ZIP import, hosting automation, or team management.
- Folder selection is browser-dependent, especially on mobile.
- Supabase SQL migration must be applied separately. Back up before applying.
- The ZIP has not been verified by a full pnpm build in this environment. Test build before production use.

## Vercel
- Import this folder as the repository root (`.`), not `artifacts/veyrova`.
- Use the included `vercel.json` or set build command `BASE_PATH=/ PORT=3000 pnpm --filter @workspace/veyrova run build` and output `artifacts/veyrova/dist/public`.
- Environment variables for Production: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public publishable key, NEVER service role key).
- Run `supabase/migrations/202610200001_veyrova_files.sql` in the correct Supabase project if not already applied.
- Verify authentication, project CRUD, file upload and refresh on a test deployment.
