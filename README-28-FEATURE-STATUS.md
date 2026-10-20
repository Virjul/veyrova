# Veyrova: 28 feature implementation inventory

**Important:** This is not a complete 28-feature production platform. The feature status below distinguishes existing code, partial implementations, and missing backend infrastructure.

| # | Feature | Status |
|---|---|---|
| 1 | Authentication | Existing Supabase auth code; test OAuth settings |
| 2 | Dashboard | Existing project dashboard; needs production testing |
| 3 | Project management | Existing CRUD; needs production testing |
| 4 | File upload | Existing text/code multi-upload; test |
| 5 | Folder upload | Existing browser-dependent picker; test |
| 6 | File manager | Existing CRUD; migration 001 required |
| 7 | ZIP import/export | Not implemented; JSON backup exists |
| 8 | Code editor | Basic text editor; IDE functionality missing |
| 9 | Live preview | Not implemented; needs sandboxing |
| 10 | Git repositories | Public GitHub Explorer; no Git hosting |
| 11 | Git operations | Read-only branches and commits; no push/merge |
| 12 | Pull requests | Not implemented |
| 13 | Issues | Existing Supabase issues; migration 002 required |
| 14 | GitHub integration | Public API browsing; private OAuth/sync missing |
| 15 | Database manager | NEW read-only own-project metadata explorer; no arbitrary SQL |
| 16 | Storage buckets | Existing private assets feature; migration 002 required |
| 17 | API management | Not implemented |
| 18 | Realtime | Not implemented |
| 19 | Team collaboration | Not implemented |
| 20 | Deployment | Vercel config only; deployment management missing |
| 21 | Custom domains | Not implemented |
| 22 | Developer settings | Setup guide only; API key management missing |
| 23 | Billing | Not implemented |
| 24 | Admin dashboard | Not implemented |
| 25 | Security | RLS policies exist for files/issues/assets; audit pending |
| 26 | Mobile responsive UI | Existing CSS; device testing pending |
| 27 | Error handling | Existing UI messages; central logs missing |
| 28 | Hosting configuration | Vercel config and SPA rewrite; verify live |

## New in this package

- `/data`: authenticated, read-only explorer of your own project metadata, code-file metadata and issue metadata, up to 100 rows per table; JSON export. Supabase RLS applies.
- `/github`: public GitHub repositories, branches, recent commits, and source previews from the previous package.

## Setup and test

1. Back up GitHub and Supabase before replacing files. Never upload `.env`, tokens or secret keys.
2. Review existing SQL files under `supabase/migrations` before applying them in order. Avoid re-running migration 002 if its policies already exist.
3. At repo root: `pnpm install && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/veyrova run build`.
4. Confirm `artifacts/veyrova/dist/public/index.html` exists.
5. Vercel project root `.` and output `artifacts/veyrova/dist/public`; `vercel.json` contains build and rewrite settings.
6. Configure Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and redeploy.
7. Test auth, projects, files, issues, assets, GitHub Explorer, and Data Explorer.

**Build not verified here:** the package registry is unavailable in this environment. This ZIP has not been end-to-end tested. Production Git hosting, code execution, private GitHub sync, billing and deployment workers require separate secure backend services.
