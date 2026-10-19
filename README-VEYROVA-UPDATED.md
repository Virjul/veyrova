# Veyrova — updated source workspace

This ZIP contains the Veyrova source project plus the first Repository/File Manager implementation.

## What changed
- Added a private Repository page at `/projects/:projectId/repository`.
- Added create, open, edit, save, and delete for text/code files.
- Files persist in Supabase table `public.veyrova_files`.
- Every operation is scoped to the authenticated user and project.
- Added SQL migration: `supabase/migrations/202610200001_veyrova_files.sql`.
- Existing `public.projects` schema and project CRUD were left unchanged.

## Required before using Repository
1. Open the existing Supabase project and go to SQL Editor.
2. Review and run `supabase/migrations/202610200001_veyrova_files.sql`.
3. Confirm it completes successfully.
4. Set frontend environment variables for the deployment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Build and deploy the frontend from `artifacts/veyrova`.

Do not put Supabase service-role keys or Google OAuth client secrets in frontend environment variables. Google OAuth client secret belongs in Supabase Auth provider settings.

## Build
This is a pnpm workspace. Use a recent Node.js version and pnpm, then from the repository root:
```sh
pnpm install
pnpm --filter @workspace/veyrova run typecheck
pnpm --filter @workspace/veyrova run build
```

The Repository page is a persistent file manager, not yet a Git-backed implementation. Git commits, branches, GitHub synchronization, runtime code execution, and deployment automation are not implemented yet.

## Security note
The SQL migration enables Row Level Security and verifies that the authenticated user owns the referenced row in `public.projects`. Test with two separate user accounts before production use.
