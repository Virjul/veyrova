# Veyrova GitHub Explorer update

This incremental source update adds a **read-only public GitHub repository explorer** at `/github`:
- Open a public repository by `owner/repo` or its GitHub URL.
- Browse up to 50 branches, 20 recent commits, up to 1000 file paths and text file previews (max 1 MB).
- Uses the public GitHub REST API and raw.githubusercontent.com without storing any access tokens.
- Handles missing repositories, network errors and API rate limiting.

This is **not** self-hosted Git, GitHub OAuth, push/merge or pull request support. Private repositories require a secure backend and OAuth. Other 28-feature roadmap items remain unimplemented. The existing Supabase SQL migrations are unchanged.

## Setup
Keep the contents of `Veyrova-Dashboard` at the GitHub repository root. Vercel Root Directory `.`; install `pnpm install`; build `BASE_PATH=/ PORT=3000 pnpm --filter @workspace/veyrova run build`; output `artifacts/veyrova/dist/public`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel before building. Run existing SQL migrations in order only after review.

## Verification status
This archive was inspected and the new route/source was added, but dependency installation, TypeScript compilation and production deployment have **not** been run in this environment. Test in Codespaces before replacing your production repository.
