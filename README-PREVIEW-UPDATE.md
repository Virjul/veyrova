# Veyrova preview update

Added a sandboxed HTML/CSS/JavaScript preview to the existing repository editor. It previews saved files only: index.html, all .css files, and plain .js files. It does not compile React/TS/TSX, resolve imports, run npm, or host backend code. This is **one partial feature**, not completion of the 17 remaining feature areas. The preview uses iframe sandbox="allow-scripts" without allow-same-origin; user code remains untrusted.

Before deploying: build and typecheck using the repository's existing pnpm scripts, then test against a separate Supabase project. This environment has no installed node_modules, so production build was not verified. Existing Supabase migrations are unchanged.
