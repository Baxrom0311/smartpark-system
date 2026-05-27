# SADO Mobile

React Native / Expo SDK 52 mobile app for the SADO speech-therapy platform.

## Stack

- Expo SDK 52 + Expo Router (file-based navigation)
- React Native 0.76 + React 18.3
- TypeScript (strict mode, `noUncheckedIndexedAccess`)
- NativeWind 4 (Tailwind CSS for React Native)
- TanStack Query 5 + Zustand 5 (server state + client state)
- expo-av (audio recording), expo-secure-store (token storage)
- react-native-reanimated 3 (animations)
- i18next + expo-localization (uz / ru / kk)

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- For iOS: Xcode 15+
- For Android: Android Studio + JDK 17

## Quick start

```bash
npm install
npm run start          # Expo dev server
npm run ios            # Open iOS simulator
npm run android        # Open Android emulator
npm run web            # Run in browser
```

## Verification

```bash
npm run typecheck      # tsc --noEmit (must pass with zero errors)
npm run lint           # eslint
npm run test           # jest
```

## Project structure

```
sado-mobile/
├── app/                 # Expo Router file-based routes
│   ├── _layout.tsx      # Root layout (providers, splash, gesture handler)
│   └── index.tsx        # Initial landing screen
├── components/          # Shared UI / game / audio components
├── services/            # API client, auth, audio, offline queue
├── stores/              # Zustand stores
├── hooks/               # Custom React hooks
├── i18n/                # uz.json, ru.json translations
├── assets/              # Images, sounds, fonts
├── app.json             # Expo config
├── eas.json             # EAS Build config
├── babel.config.js      # Babel + NativeWind + Reanimated plugin
├── metro.config.js      # Metro + NativeWind transformer
├── tailwind.config.js   # Tailwind colors (primary, risk-green/yellow/red)
└── tsconfig.json        # TypeScript strict mode
```

## Environment

Public config goes in `app.json` under `expo.extra`. Secrets (API keys) must
not be committed — use `.env` + `expo-constants` at runtime.

## Offline architecture

The PROJECT_BRIEF lists WatermelonDB as the long-term local-first store, but
its native module breaks Expo Go and a custom dev client is out of scope for
the hosted demo. The current implementation uses an **AsyncStorage-backed
durable queue** for audio recordings captured while the device is offline:

- `services/offline-queue.ts` — durable JSON queue keyed by recording id,
  with retry counters and a dead-letter list (`MAX_RETRIES = 5`).
- `stores/offline-store.ts` — Zustand mirror of pending items + connectivity
  status for header badges and progress screens.
- `hooks/useOfflineSync.ts` — hydrates the store, polls `/health` every 20s
  to detect connectivity, and drains the queue on AppState `active` /
  online transitions. Tests can inject `upload` and `probe` overrides.

**Migration path:** when WatermelonDB adoption is unblocked, swap the
storage layer in `services/offline-queue.ts` (replace AsyncStorage I/O with
WatermelonDB tables); the public API and the hook contract stay stable.

## License

Proprietary — © SADO Platform.
