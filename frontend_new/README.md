# frontend_new

This directory contains the new frontend monorepo structure for Hazard Hero.  
It separates mobile and web apps while sharing reusable code through workspace packages.

## Why `frontend_new` exists

`frontend_new` is an incremental migration target so we can:

1. Keep the old frontend flow untouched while migration is in progress.
2. Split platform apps cleanly (`apps/mobile`, `apps/web`).
3. Extract shared logic into packages (`packages/shared`, `packages/ui`).

## Directory layout

```text
frontend_new/
  apps/
    mobile/      # Expo React Native app
    web/         # Next.js web app
  packages/
    shared/      # shared types, API helpers, config utilities
    ui/          # shared UI package (scaffolded)
    eslint-config/
    tsconfig/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

## pnpm in this repo

This monorepo uses **pnpm workspaces**.

- Workspace manifest: `frontend_new/pnpm-workspace.yaml`
- Root package manager pin: `frontend_new/package.json` (`packageManager`)
- Cross-package deps use `workspace:*` (example: `@hazard-hero/shared`)

### Install dependencies

From `frontend_new`:

```bash
pnpm install
```

### Run apps

From `frontend_new`:

```bash
# Run all dev tasks via turbo
pnpm dev

# Run only mobile
pnpm dev:mobile

# Run only web
pnpm dev:web
```

### Useful workspace commands

```bash
# Typecheck all packages/apps through turbo
pnpm typecheck

# Run a command for one workspace package
pnpm --filter mobile lint
pnpm --filter web build
pnpm --filter @hazard-hero/shared typecheck
```

## Notes

- Run commands from inside `frontend_new` so pnpm resolves the workspace correctly.
- `apps/mobile` and `apps/web` can import from `packages/*`.
- `packages/*` must not import from `apps/*`.
