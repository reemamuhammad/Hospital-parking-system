# Smart Hospital Parking — local setup

Stack: TanStack Start (React 19) + Vite 7 + Tailwind v4 + Supabase.

1. `npm install` (or `bun install`)
2. Copy `.env.example` to `.env` and fill in your Supabase project values.
3. `npm run dev` → http://localhost:8080
4. Apply the SQL in `supabase/migrations/` (in filename order) to your Supabase project.

Key files:
- `src/routes/index.tsx` — dashboard (map, stats, appointments, booking, nav bar)
- `src/routes/auth.tsx`, `src/routes/reset-password.tsx`, `src/routes/_authenticated/profile.tsx`
- `src/components/parking/` — GarageMap, GarageSvg, HospitalSearch, data, format
- `src/styles.css` — design tokens (calm blue theme, available/occupied/reserved colors)
- `src/routeTree.gen.ts` is auto-generated on `dev`/`build`; it is intentionally not included.
