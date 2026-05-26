# SADO Platform — Agent Rules

All AI coding agents working on this project MUST follow these rules strictly.

## General Rules

1. **Three separate repos.** The project has 3 independent sub-projects: `sado-api/`, `sado-admin/`, `sado-mobile/`. Each is a standalone repo with its own package manager, tests, and CI.
2. **Do not mix repos.** When building backend, only touch files in `sado-api/`. When building admin, only touch `sado-admin/`. Same for mobile.
3. **No secrets in code.** Use `.env` files (gitignored) and `.env.example` for documentation. Never hardcode API keys, passwords, or tokens.
4. **Pin all dependencies.** Use exact versions in package.json and pyproject.toml. No `^` or `~` ranges.
5. **Run verification after every change.** Backend: `pytest`. Admin: `npm run build`. Mobile: `npx tsc --noEmit`.
6. **Production-quality code.** Proper error handling, input validation, type safety, meaningful variable names.
7. **No placeholder/TODO code.** Every file must be functional. Mock external services (Whisper, ML model) with realistic responses.
8. **Git: create repos with `gh repo create`.** Each sub-project gets its own GitHub repo. Push after each successful build.

## Backend Rules (sado-api)

- Use async everywhere: `async def`, `asyncpg`, `httpx`
- SQLAlchemy 2.0 async style with mapped_column
- Alembic for ALL schema changes — never raw SQL
- Pydantic v2 for all request/response schemas
- JWT with short-lived access (15min) + long-lived refresh (7d)
- Role-based access: `parent`, `teacher`, `therapist`, `admin`
- All list endpoints: cursor-based pagination
- Consistent error format: `{"detail": "message", "code": "ERROR_CODE"}`
- Audio processing in Celery workers, never in request handlers
- Health check must verify DB, Redis, MinIO connectivity
- Docker Compose must start everything with one command

## Admin Dashboard Rules (sado-admin)

- React 19 + TypeScript strict mode — zero `any` types allowed
- Vite 7 as build tool
- TanStack Router with file-based routing (routes/ directory)
- TanStack Query for ALL server state — no manual fetch/useEffect
- Zustand ONLY for client-side UI state (theme, sidebar, modals)
- shadcn/ui for ALL UI components — do not create custom components when shadcn has one
- Zod schemas that mirror backend Pydantic schemas
- React Hook Form + Zod resolver for all forms
- Recharts for all charts and statistics
- TanStack Table for all data tables
- Proper loading skeletons, error boundaries, empty states
- Dark/light mode with system preference detection
- i18n: all user-facing strings in translation files (uz.json, ru.json)
- API client with automatic JWT refresh and error interceptor
- Route guards: redirect to /login if not authenticated

## Mobile Rules (sado-mobile)

- Expo SDK 52 with Expo Router (file-based)
- TypeScript strict — no `any`
- NativeWind for styling (Tailwind classes in RN)
- expo-av for audio recording
- react-native-reanimated for all animations
- WatermelonDB for offline-first data
- expo-secure-store for token storage
- Zustand + TanStack Query (same pattern as admin)
- All screens must handle: loading, error, empty, success states
- Audio recorder: show noise level, countdown, max 60s
- Gamification: animated characters, progress bars, star rewards
- Offline queue: record audio → store locally → sync when online
- Support both Android and iOS (no platform-specific code unless necessary)
- Minimum target: Android 8+ (API 26), iOS 15+

## Review Focus Areas

When reviewing, prioritize:
1. **Correctness** — Does it match the PROJECT_BRIEF acceptance criteria?
2. **Type safety** — No `any`, proper generics, strict null checks
3. **Security** — Auth on every protected endpoint, input validation, SQL injection prevention
4. **Error handling** — Graceful failures, user-friendly messages
5. **Offline support** — Mobile must work without internet for core flows
6. **i18n** — All strings externalized, RTL-ready structure
7. **Performance** — No N+1 queries, proper indexes, lazy loading
8. **Accessibility** — ARIA labels, keyboard navigation (admin), screen reader support (mobile)

## Naming Conventions

- Backend: snake_case (Python standard)
- Frontend/Mobile: camelCase for variables, PascalCase for components
- API routes: kebab-case in URLs, snake_case in JSON bodies
- Database: snake_case for tables and columns
- Files: kebab-case for routes, PascalCase for components, camelCase for utilities

## Commit Messages

Format: `feat(scope): description` or `fix(scope): description`
Scopes: `api`, `admin`, `mobile`, `infra`, `docs`
Examples:
- `feat(api): add JWT authentication with refresh tokens`
- `feat(admin): implement dashboard with stat cards and charts`
- `fix(mobile): handle offline audio recording queue`
