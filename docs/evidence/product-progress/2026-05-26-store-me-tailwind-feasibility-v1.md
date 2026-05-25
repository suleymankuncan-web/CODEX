# Store Me Tailwind Feasibility V1

Date: 2026-05-26

## Scope

This slice validates that the `admin-web` Vite app can host Tailwind CSS v4 and
shadcn/ui configuration for a future `/store/me` redesign.

It does not redesign `/store/me`, add shadcn UI components to production routes,
change auth/permission behavior, change API contracts, or rewrite the existing
global CSS foundation.

## Decision

Tailwind is feasible for the Store Me redesign if it is introduced as an
isolated, prefixed, preflight-free layer:

- Tailwind utilities use the `tw:` prefix, so local classes such as
  `.store-*`, `.panel`, and `.sr-only` are not overloaded by utility names.
- Tailwind preflight is intentionally not imported. The existing app CSS keeps
  ownership of base element styling.
- shadcn semantic tokens live in `admin-web/src/styles/shadcn-tailwind.css`.
- shadcn source components can be added later through `npx shadcn@latest add`
  after reviewing the generated files.

## Implementation Notes

- `@tailwindcss/vite` is wired into the Vite plugin list.
- `@/*` aliases are configured in Vite and TypeScript so shadcn imports resolve.
- TypeScript 6 rejects the older `baseUrl` alias pattern, so the alias is kept
  as `paths` only.
- `components.json` points shadcn to the preflight-free Tailwind CSS file and
  `@/lib/utils`.
- `admin-web/src/prototypes/shadcn-tailwind-proof.tsx` is a compile-only proof
  surface. It is not imported into routes.

## Verification

- `npx.cmd shadcn@latest info --json`
  - Result: `tailwindVersion` is `v4`, import alias is `@`, and shadcn resolves
    `src/styles/shadcn-tailwind.css`.
- `npx.cmd shadcn@latest add button --dry-run`
  - Result: dry-run succeeds and would create `src/components/ui/button.tsx`.
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
  - Result: build succeeds and emits a CSS asset containing prefixed utilities
    such as `.tw\:flex`.

## Risk Notes

- Tailwind should remain prefixed while the old CSS foundation exists.
- Do not import `tailwindcss/preflight.css` without a separate visual regression
  pass across existing surfaces.
- The next `/store/me` redesign slice should install only the shadcn components
  it actually uses, then review generated component source before committing.
