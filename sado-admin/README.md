# sado-admin

SADO platform admin dashboard. React 19 + TypeScript (strict) + Vite 7,
TanStack Router (file-based) and Query for routing/server state, Zustand
for client UI state, Tailwind 4 for styling, Recharts for analytics, and
Vitest + Testing Library for tests.

## Scripts

| Command              | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Vite dev server on `http://localhost:5173`               |
| `npm run build`      | Generates routes, runs `tsc -b`, then `vite build`       |
| `npm run typecheck`  | Generates routes and runs `tsc --noEmit`                 |
| `npm test`           | Runs Vitest in CI mode (single pass, jsdom environment)  |
| `npm run lint`       | ESLint with `--max-warnings=0`                           |
| `npm run preview`    | Serves the built `dist/` for smoke testing               |

## Environment variables

`VITE_API_BASE_URL` — base URL of the sado-api backend. Defaults to
`/api/v1` so the Vite dev proxy in `vite.config.ts` can forward calls to
`http://localhost:8000`.

## Testing

Tests live in `tests/` and use Vitest with the jsdom environment.
A localStorage shim is installed in `tests/setup.ts` because Vitest's
bundled jsdom implementation does not always expose Storage methods.

Currently covered:

- `auth-tokens` — read/write/clear, expiry skew, corrupt-state recovery
- `api-client` — JSON parsing, 204 handling, typed `ApiClientError`,
  401 → `/auth/refresh` retry
- `auth-store` — login success/failure, logout, bootstrap-without-tokens
- `ui-store` — theme persistence + `dark` class toggling, sidebar toggle
- `data-table` — populated/empty/error states, "load more" callback
- `login-form` — Zod schema validation for both email and phone modes

Add new tests as `tests/<name>.test.{ts,tsx}` — they're picked up
automatically by `vitest.config.ts`.

## Continuous Integration

`.github/workflows/ci.yml` runs `typecheck`, `test`, and `build` on every
push and pull request to `main`, then uploads `dist/` as an artifact.
