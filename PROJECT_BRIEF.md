# SADO — AI Speech Therapy Platform

## Goal

Build a production-ready AI-powered speech therapy platform for children aged 2-12 in Uzbekistan. The platform detects speech disorders early through gamified assessments, provides personalized exercises, and connects parents, kindergarten teachers, and speech therapists in one ecosystem.

The system consists of THREE separate repositories built in parallel:
1. **sado-api** — Backend REST API
2. **sado-admin** — Admin dashboard (web)
3. **sado-mobile** — Mobile app (React Native/Expo)

Each repo is independently deployable and communicates via REST API.

---

## Tech Stack

### Backend (sado-api)
- **Runtime:** Python 3.12+
- **Framework:** FastAPI (async)
- **Database:** PostgreSQL 16 with asyncpg + SQLAlchemy 2.0 (async)
- **Migrations:** Alembic
- **Auth:** JWT (access + refresh tokens) with role-based access control (RBAC)
- **Audio Processing:** OpenAI Whisper (fine-tuned for Uzbek), librosa (MFCC, pitch, formant extraction)
- **ML Model:** XGBoost classifier for risk scoring (Green/Yellow/Red)
- **File Storage:** MinIO (S3-compatible) for audio files
- **Cache:** Redis (sessions, rate limiting, task queue)
- **Task Queue:** Celery + Redis (async audio processing)
- **Validation:** Pydantic v2
- **Testing:** pytest + pytest-asyncio + httpx
- **API Docs:** Auto-generated OpenAPI/Swagger
- **Containerization:** Docker + docker-compose

### Admin Dashboard (sado-admin)
- **Framework:** React 19 + TypeScript (strict mode)
- **Build Tool:** Vite 7
- **Routing:** TanStack Router (file-based routing)
- **Server State:** TanStack Query v5
- **Client State:** Zustand
- **UI:** Tailwind CSS 4 + shadcn/ui (all components)
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts (statistics, analytics)
- **Tables:** TanStack Table (data grids)
- **Auth:** JWT with automatic refresh, route guards
- **i18n:** react-i18next (uz, ru, kk languages)
- **Testing:** Vitest + Testing Library
- **Linting:** ESLint + Prettier + TypeScript strict

### Mobile App (sado-mobile)
- **Framework:** React Native 0.76+ with Expo SDK 52
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router (file-based)
- **State:** Zustand + TanStack Query
- **UI:** NativeWind (Tailwind for RN) + custom design system
- **Audio:** expo-av (recording), expo-file-system (storage)
- **Animations:** react-native-reanimated 3 (gamification)
- **Offline:** WatermelonDB (local-first, sync when online)
- **Auth:** expo-secure-store (token storage)
- **Push:** expo-notifications
- **Testing:** Jest + React Native Testing Library
- **i18n:** i18next + expo-localization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SADO Platform                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │  Mobile  │───▶│   FastAPI    │◀───│  Admin Dashboard │   │
│  │  (Expo)  │    │   Backend    │    │  (React+shadcn) │   │
│  └──────────┘    └──────┬───────┘    └─────────────────┘   │
│                          │                                   │
│              ┌───────────┼───────────┐                      │
│              │           │           │                      │
│         ┌────▼───┐  ┌───▼────┐  ┌──▼───┐                  │
│         │PostgreSQL│  │ Redis  │  │MinIO │                  │
│         │(data)   │  │(cache) │  │(audio)│                  │
│         └─────────┘  └────────┘  └──────┘                  │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │  Celery   │                            │
│                    │  Workers  │                            │
│                    │(Whisper+ML)│                            │
│                    └───────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (Speech Assessment)
1. Child plays game → audio recorded on device
2. Audio uploaded to API → stored in MinIO
3. Celery worker processes: noise reduction → Whisper STT → MFCC/pitch/formant extraction
4. XGBoost classifier scores risk: Green (normal) / Yellow (monitor) / Red (refer to specialist)
5. Results returned to parent with explanation + personalized exercises
6. Dashboard shows aggregated anonymous statistics per region/kindergarten

---

## Database Schema (Core Tables)

```
users (id, role[parent|teacher|therapist|admin], email, phone, password_hash, language, region_id)
children (id, parent_id, name, birth_date, gender, language)
assessments (id, child_id, type, status, created_at)
audio_recordings (id, assessment_id, task_type, file_path, duration_sec, processed)
analysis_results (id, recording_id, risk_level[green|yellow|red], confidence, mfcc_features, pitch_data, formant_data, phoneme_scores)
exercises (id, category, age_group, difficulty, language, title, description, audio_example_path, image_path)
exercise_assignments (id, child_id, exercise_id, assigned_by, due_date, completed_at, score)
kindergartens (id, name, region_id, address, teacher_count, child_count)
regions (id, name, parent_id, type[country|region|district])
notifications (id, user_id, type, title, body, read_at)
```

---

## User Roles & Features

### Parent (Mobile App)
- Register child (age, language)
- Run gamified speech assessment (10-15 min game)
- View results (Green/Yellow/Red with explanation)
- Access daily exercises (5-10 min games)
- Track progress over time (charts)
- Get notifications for scheduled assessments
- Offline mode: record audio, sync later

### Teacher/Kindergarten (Mobile + Admin)
- View all children in their group
- Run group screening
- See risk distribution per group
- Refer Red-level children to parents/therapists
- Access teaching materials

### Speech Therapist (Admin Dashboard)
- View referred children (Red level)
- Access detailed analysis (MFCC, formants, phoneme breakdown)
- Assign specific exercises
- Track therapy progress
- Export reports (PDF)

### System Admin (Admin Dashboard)
- User management (CRUD)
- Kindergarten management
- Regional statistics & heatmaps
- System health monitoring
- Content management (exercises, games)
- ML model performance metrics

---

## API Endpoints (Core)

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/users/me
PUT    /api/v1/users/me
GET    /api/v1/users (admin)

POST   /api/v1/children
GET    /api/v1/children
GET    /api/v1/children/:id
PUT    /api/v1/children/:id

POST   /api/v1/assessments
GET    /api/v1/assessments
GET    /api/v1/assessments/:id
POST   /api/v1/assessments/:id/recordings (multipart audio upload)

GET    /api/v1/analysis/:assessment_id
GET    /api/v1/analysis/:assessment_id/detailed (therapist only)

GET    /api/v1/exercises
GET    /api/v1/exercises/:id
POST   /api/v1/exercises/:child_id/assign
GET    /api/v1/exercises/:child_id/assignments
PUT    /api/v1/exercises/assignments/:id/complete

GET    /api/v1/kindergartens (admin/teacher)
POST   /api/v1/kindergartens (admin)
GET    /api/v1/kindergartens/:id/children
GET    /api/v1/kindergartens/:id/stats

GET    /api/v1/stats/regional (admin)
GET    /api/v1/stats/system (admin)
GET    /api/v1/notifications
PUT    /api/v1/notifications/:id/read

GET    /api/v1/health
GET    /api/v1/health/detailed (admin)
```

---

## Acceptance Criteria

### Backend (sado-api)
- [ ] FastAPI app starts with `uvicorn` and serves OpenAPI docs at /docs
- [ ] PostgreSQL migrations run cleanly with Alembic
- [ ] JWT auth works: register, login, refresh, logout with RBAC
- [ ] CRUD for users, children, kindergartens, exercises
- [ ] Audio upload endpoint accepts WAV/MP3, stores in MinIO
- [ ] Celery worker processes audio: Whisper STT + feature extraction
- [ ] XGBoost model scores risk level with confidence
- [ ] Rate limiting on auth endpoints (Redis)
- [ ] All endpoints have Pydantic request/response schemas
- [ ] pytest passes with >80% coverage on business logic
- [ ] Docker Compose starts all services (api, db, redis, minio, celery)
- [ ] Health check endpoint returns service status
- [ ] API versioning (v1 prefix)
- [ ] Proper error handling with consistent error response format
- [ ] Pagination on list endpoints (cursor-based)
- [ ] CORS configured for admin dashboard and mobile

### Admin Dashboard (sado-admin)
- [ ] Vite dev server starts without errors
- [ ] TanStack Router file-based routing works
- [ ] Login/logout with JWT (auto-refresh)
- [ ] Protected routes redirect to login
- [ ] Dashboard page: key metrics cards + charts
- [ ] Users management: list, create, edit, delete with pagination
- [ ] Children list with risk level badges and filters
- [ ] Kindergartens management with stats
- [ ] Exercises management: CRUD with audio/image upload
- [ ] Regional statistics with charts (Recharts)
- [ ] Responsive layout (desktop + tablet)
- [ ] Dark/light mode toggle
- [ ] Language switcher (uz/ru)
- [ ] All forms validated with Zod
- [ ] Loading states, error boundaries, empty states
- [ ] Vitest passes with component tests
- [ ] TypeScript strict mode — no `any` types
- [ ] Build produces optimized production bundle

### Mobile App (sado-mobile)
- [ ] Expo dev server starts, app loads on simulator
- [ ] Expo Router file-based navigation works
- [ ] Onboarding flow (language select, role select)
- [ ] Auth: register, login, secure token storage
- [ ] Parent flow: add child → start assessment → record audio → view results
- [ ] Gamified assessment UI: animated characters, progress bar, rewards
- [ ] Audio recording with noise level indicator
- [ ] Results screen: Green/Yellow/Red with explanation in Uzbek
- [ ] Exercise list with daily recommendations
- [ ] Exercise player: audio example + record attempt + feedback
- [ ] Progress tracking: weekly/monthly charts
- [ ] Offline mode: queue recordings, sync when online
- [ ] Push notifications for scheduled assessments
- [ ] Teacher mode: group view, screening
- [ ] Settings: language, notifications, child profiles
- [ ] Works on Android and iOS
- [ ] Animations smooth (60fps) with Reanimated
- [ ] Jest tests pass for core logic

---

## Non-goals

- Do NOT build a real ML model training pipeline (use mock/pretrained weights)
- Do NOT implement real Whisper fine-tuning (mock the STT response for demo)
- Do NOT deploy to production cloud (Docker Compose local is sufficient)
- Do NOT implement payment/subscription system yet
- Do NOT build a separate therapist mobile app (they use admin dashboard)
- Do NOT implement video calling or real-time chat

---

## Constraints

- All three repos must be independently buildable and testable
- API must be stateless (JWT, no server sessions)
- Mobile app must work offline for core assessment flow
- All user-facing text must support uz/ru languages minimum
- Audio files must not exceed 60 seconds per recording
- API response time < 200ms for non-audio endpoints
- Audio processing < 30 seconds per recording
- Admin dashboard must work on Chrome, Firefox, Safari (latest 2 versions)
- No paid API keys required to run locally (mock external services)
- Each repo gets its own GitHub repository with CI-ready structure

---

## Repository Structure

### sado-api/
```
sado-api/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── dependencies.py
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── children.py
│   │   │   ├── assessments.py
│   │   │   ├── exercises.py
│   │   │   ├── kindergartens.py
│   │   │   ├── stats.py
│   │   │   └── health.py
│   │   └── deps.py
│   ├── models/
│   │   ├── user.py
│   │   ├── child.py
│   │   ├── assessment.py
│   │   ├── exercise.py
│   │   └── kindergarten.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── child.py
│   │   ├── assessment.py
│   │   └── exercise.py
│   ├── services/
│   │   ├── auth.py
│   │   ├── audio_processor.py
│   │   ├── speech_analyzer.py
│   │   └── ml_scorer.py
│   ├── core/
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   └── middleware.py
│   └── workers/
│       ├── celery_app.py
│       └── tasks.py
├── alembic/
│   ├── env.py
│   └── versions/
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_children.py
│   └── test_assessments.py
├── docker-compose.yml
├── Dockerfile
├── alembic.ini
├── pyproject.toml
├── .env.example
├── .github/workflows/ci.yml
└── README.md
```

### sado-admin/
```
sado-admin/
├── src/
│   ├── main.tsx
│   ├── app.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── _authenticated.tsx
│   │   ├── _authenticated/
│   │   │   ├── index.tsx (dashboard)
│   │   │   ├── users/
│   │   │   │   ├── index.tsx
│   │   │   │   └── $userId.tsx
│   │   │   ├── children/
│   │   │   │   ├── index.tsx
│   │   │   │   └── $childId.tsx
│   │   │   ├── kindergartens/
│   │   │   │   ├── index.tsx
│   │   │   │   └── $kindergartenId.tsx
│   │   │   ├── exercises/
│   │   │   │   ├── index.tsx
│   │   │   │   └── $exerciseId.tsx
│   │   │   ├── statistics/
│   │   │   │   └── index.tsx
│   │   │   └── settings/
│   │   │       └── index.tsx
│   │   └── login.tsx
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── breadcrumbs.tsx
│   │   └── shared/
│   │       ├── data-table.tsx
│   │       ├── stat-card.tsx
│   │       └── risk-badge.tsx
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   └── use-theme.ts
│   ├── stores/
│   │   ├── auth-store.ts
│   │   └── ui-store.ts
│   ├── types/
│   │   └── index.ts
│   └── i18n/
│       ├── config.ts
│       ├── uz.json
│       └── ru.json
├── tests/
│   └── components/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── .github/workflows/ci.yml
└── README.md
```

### sado-mobile/
```
sado-mobile/
├── app/
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (parent)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx (home)
│   │   ├── assessment/
│   │   │   ├── index.tsx
│   │   │   ├── game.tsx
│   │   │   └── results.tsx
│   │   ├── exercises/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── progress/
│   │   │   └── index.tsx
│   │   └── profile/
│   │       └── index.tsx
│   └── (teacher)/
│       ├── _layout.tsx
│       ├── index.tsx
│       └── group/
│           └── [id].tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Badge.tsx
│   ├── game/
│   │   ├── GameCharacter.tsx
│   │   ├── ProgressBar.tsx
│   │   └── RewardAnimation.tsx
│   └── audio/
│       ├── AudioRecorder.tsx
│       └── AudioPlayer.tsx
├── services/
│   ├── api.ts
│   ├── auth.ts
│   ├── audio.ts
│   └── offline-queue.ts
├── stores/
│   ├── auth-store.ts
│   ├── assessment-store.ts
│   └── offline-store.ts
├── hooks/
│   ├── useAudioRecorder.ts
│   └── useOfflineSync.ts
├── i18n/
│   ├── config.ts
│   ├── uz.json
│   └── ru.json
├── assets/
│   ├── images/
│   └── sounds/
├── app.json
├── package.json
├── tsconfig.json
├── eas.json
├── .github/workflows/ci.yml
└── README.md
```

---

## Risks

- Whisper Uzbek language support is limited — use mock STT for demo
- XGBoost model needs real training data — use synthetic/mock scores
- Audio recording quality varies on cheap Android devices — implement noise detection
- Offline sync conflicts possible — use last-write-wins with timestamps
- Large audio files on slow networks — implement chunked upload with resume
- React Native + Expo version compatibility — pin all versions exactly

---

## Git Strategy

Each repo is created as a separate GitHub repository:
- `sado-api` — backend
- `sado-admin` — admin dashboard  
- `sado-mobile` — mobile app

Use `gh repo create` to create repos, push initial code, and maintain clean commit history.
Branch: `main` for all repos.
Auto-push after each successful build iteration.
