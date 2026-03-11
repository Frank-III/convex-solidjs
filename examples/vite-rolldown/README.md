# Vite + Rolldown + Solid Example

This is the canonical example for `convex-solidjs`.

Stack:

- Solid 2 beta
- `vite-plugin-solid`
- Vite runtime from `rolldown-vite`
- Convex realtime backend
- Two demo pages: `Baseline` and `Optimistic`

## Environment

Set `VITE_CONVEX_URL` in a `.env.local` file.

## Run

```bash
cd examples/vite-rolldown
pnpm install
pnpm convex:dev
```

In another terminal:

```bash
cd examples/vite-rolldown
pnpm dev
```

Open `http://localhost:5173`.

## Notes

This example uses placeholder files in `convex/_generated/*` so the app can typecheck before running `convex dev`. Running `convex dev` will replace them with generated types.
