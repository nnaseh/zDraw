# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.

## zDraw fork: Ponytail rules

- Write the least code that solves the problem. Prefer a thin `fetch` wrapper or a small helper to a new dependency or SDK.
- No bloat: no drive-by refactors, no speculative options, no Electron. New dependencies must be small, permissively licensed (MIT/Apache), and lazy-loaded if they are big.
- Keep zDraw code in `excalidraw-app/zdraw/` and touch upstream files only where you have to wire something in, so that merges from upstream stay easy.
- Cloud features are opt-in: they need an env var or a user-supplied key, and user secrets are stored only in localStorage.
- Before committing, run `npx tsc -p tsconfig.json`, `npx eslint --max-warnings=0 --ext .ts,.tsx excalidraw-app` and `yarn vitest run excalidraw-app`.
