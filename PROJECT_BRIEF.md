# School Device Management System — Full Fix & ESP32 Firmware

## Goal

Maktab qo'ng'iroq qurilmalarini (ESP32-based IoT) boshqarish tizimini to'liq ishga tushirish:
1. Backend (Django) dagi barcha critical/medium buglarni tuzatish
2. ESP32 firmware yozish (PlatformIO + Espressif framework)
3. Dashboard (admin panel) dagi buglarni tuzatish
4. Member App (oddiy foydalanuvchi ilovasi) dagi buglarni tuzatish
5. Arxitekturani to'g'rilash (rollar, permission, flow)

## Arxitektura

```
┌──────────────────┐      MQTT (TLS)     ┌──────────────┐
│  ESP32 Devices   │◄───────────────────►│  EMQX Broker │
│  (PlatformIO)    │                     └──────┬───────┘
└──────────────────┘                            │
                                                │ MQTT subscribe
┌──────────────────┐      REST API       ┌─────▼────────────┐
│  Dashboard       │◄──────────────────►│  Django API        │
│  (Admin panel)   │                    │  + Celery + Redis  │
│  React+Vite+TS   │                    │  + PostgreSQL      │
└──────────────────┘                    └─────▲────────────┘
                                              │ REST API
┌──────────────────┐                          │
│  Member App      │◄─────────────────────────┘
│  (Maktab user)   │
│  React+Vite+TS   │
└──────────────────┘
```

### Rollar

| Rol | Panel | Imkoniyatlar |
|-----|-------|-------------|
| SuperAdmin | Dashboard | Barcha qurilmalar, foydalanuvchilar, firmware, OTA |
| SchoolAdmin | Member App | O'z maktabi qurilmalari, jadvallar, sozlamalar |
| Member | Member App | Faqat ko'rish, jadval ko'rish |

**Muhim:** Dashboard — faqat SuperAdmin uchun. Member App — maktab adminlari va oddiy foydalanuvchilar uchun.

## Repositories

```
burxon/
├── api_school_device/          # Django 5.2 + DRF backend
├── school_device_dashboard/    # React admin panel (SuperAdmin only)
├── school_device_member_app/   # React member app (SchoolAdmin + Member)
└── esp32_firmware/             # ESP32 PlatformIO firmware (YANGI)
```

---

## Phase 1: ESP32 Firmware (PlatformIO + Espressif Framework)

### Yaratish kerak: `esp32_firmware/` papka

**Platform:** ESP32-WROOM-32, PlatformIO, `framework = espidf` (Espressif IDF)

### Funksionallik:
1. **WiFi ulanish** — SSID/password NVS (non-volatile storage) dan o'qiladi
2. **MQTT ulanish** — EMQX broker'ga TLS bilan ulanish
3. **Auto-registration** — birinchi ishga tushganda API'ga o'zini ro'yxatdan o'tkazish
4. **Qo'ng'iroq boshqarish** — GPIO pin orqali relay/buzzer boshqarish
5. **Jadval sinxronizatsiya** — MQTT orqali jadval olish va NVS'da saqlash
6. **OTA yangilash** — MQTT orqali firmware yangilash buyrug'ini qabul qilish, HTTPS orqali yuklab olish
7. **Status reporting** — har 30 soniyada heartbeat, WiFi signal, uptime
8. **Offline mode** — internet yo'q bo'lganda NVS'dagi jadval bo'yicha ishlash
9. **API key authentication** — device activation flow

### MQTT Topics:
```
devices/{device_id}/command     # Server → Device (ring, sync, ota, reboot)
devices/{device_id}/status      # Device → Server (heartbeat, online/offline)
devices/{device_id}/ota/status  # Device → Server (ota progress/result)
devices/{device_id}/schedule    # Server → Device (jadval yuborish)
devices/{device_id}/config      # Server → Device (konfiguratsiya)
```

### Fayl tuzilishi:
```
esp32_firmware/
├── platformio.ini
├── src/
│   ├── main.c
│   ├── wifi_manager.c / .h
│   ├── mqtt_client.c / .h
│   ├── schedule_manager.c / .h
│   ├── ota_manager.c / .h
│   ├── bell_controller.c / .h
│   ├── nvs_storage.c / .h
│   ├── device_registration.c / .h
│   └── status_reporter.c / .h
├── include/
│   └── config.h
├── partitions.csv
└── README.md
```

### platformio.ini:
```ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = espidf
monitor_speed = 115200
board_build.partitions = partitions.csv
build_flags =
    -DCONFIG_ESP_TLS_USING_MBEDTLS=y
```

---

## Phase 2: Backend Bug Fixes (api_school_device)

### CRITICAL fixes:

#### 2.1 DeviceLog model qaytarish
- `src/apps/devices/models/device_log.py` yaratish (LogLevel, LogSource, DeviceLog)
- `models/__init__.py` ga import qo'shish
- Migration yaratish

#### 2.2 Security fixes
- `SECRET_KEY`: default qiymatni olib tashlash, env majburiy qilish
- `auto_register` endpoint: API key yoki rate-limit qo'shish
- MQTT password: hash qilib saqlash (PBKDF2 yoki bcrypt)
- `RegisterView`: verification_token ni response'dan olib tashlash (production)
- `CORS_ALLOW_ALL_ORIGINS`: `DEBUG` ga bog'lash

#### 2.3 Auth fixes
- `LoginSerializer`: `is_verified` tekshirish qo'shish
- `ResendVerificationView`: rate-limit (1 request/minute)
- `username` field: `unique=True` qo'shish

#### 2.4 Performance fixes
- OTA batch counter: `F()` expression ishlatish (race condition fix)
- `DeviceListSerializer`: `select_related("schedule")` list action'da ham
- `FirmwareVersion.save()`: faqat yangi upload'da file read qilish
- Duplicate indexes olib tashlash

#### 2.5 Device activation flow to'g'rilash
- `activate_with_api_key`: `permission_classes=[AllowAny]` qilish (ESP32 uchun)
- Device registration → activation → MQTT credentials flow

#### 2.6 Throttle rate oshirish
- `"user": "10000/day"` (IoT admin uchun)

---

## Phase 3: Dashboard Fixes (school_device_dashboard)

### 3.1 Auth flow fixes
- Token refresh: bitta joyda (api-client interceptor), auth-store'dan olib tashlash
- 401 handling: interceptor refresh qiladi, faqat refresh ham fail bo'lsa logout
- Cookie: `Secure; SameSite=Strict` flag qo'shish
- localStorage desync: `isAuthenticated` ni cookie'dan derive qilish

### 3.2 Forgot password
- Haqiqiy API call qo'shish (`/auth/forgot-password/` endpoint)
- OTP sahifasiga email pass qilish

### 3.3 Error handling
- `handleServerError`: `data.detail` ishlatish (`data.title` emas)
- QueryCache 401: faqat refresh fail bo'lganda logout

### 3.4 UI fixes
- `ThemeProvider`: `resolvedTheme` ni state bilan track qilish
- `useTableUrlState`: URL o'zgarganda state sync qilish
- `DeviceClaim`: `basePath` ga qarab to'g'ri navigate qilish

### 3.5 Clerk olib tashlash
- Dashboard Clerk auth ishlatmaydi (o'z JWT auth), Clerk dependency olib tashlash
- O'z auth flow (login/register/JWT) to'liq ishlashi kerak

---

## Phase 4: Member App Fixes (school_device_member_app)

### 4.1 Token refresh qo'shish (CRITICAL)
- 401 interceptor: avval refresh token bilan yangilash
- Faqat refresh ham fail bo'lsa logout
- `isRefreshing` flag + request queue (parallel request'lar uchun)

### 4.2 Schedule fixes
- `getSchedule`: error'ni swallow qilmaslik, throw qilish
- Schedule create: yangi device uchun POST (create), mavjud uchun PATCH (update)
- `timesToPairs`: entry/exit semantikasini saqlash
- `schedule!.id` null check qo'shish

### 4.3 Device claim fix
- `handleGoToDashboard`: `claimedDevice` ni reset qilish yoki navigate

### 4.4 Cleanup
- `"install": "^0.13.0"` dependency olib tashlash
- Cookie: `Secure; SameSite=Strict` qo'shish

---

## Phase 5: Arxitektura to'g'rilash

### 5.1 Permission system
Backend'da:
- `IsSuperAdmin` — faqat Dashboard API'lar uchun
- `IsSchoolAdmin` — o'z maktabi qurilmalari uchun
- `IsMember` — faqat o'qish

### 5.2 API endpoint'larni ajratish
```
/api/v1/admin/...     → Dashboard (SuperAdmin only)
/api/v1/member/...    → Member App (SchoolAdmin + Member)
/api/v1/device/...    → ESP32 device endpoints (API key auth)
```

### 5.3 Device ownership
- Device → School → Users (many-to-many through SchoolMembership)
- SchoolAdmin faqat o'z maktabi qurilmalarini ko'radi/boshqaradi

### 5.4 Backend'ga yangi endpoint'lar
- `POST /api/v1/device/auto-register/` — ESP32 o'zini ro'yxatdan o'tkazish (API key)
- `POST /api/v1/device/activate/` — Device activation (API key)
- `GET /api/v1/device/credentials/` — MQTT credentials olish
- `GET /api/v1/member/my-devices/` — Foydalanuvchi qurilmalari
- `GET /api/v1/member/my-schedules/` — Foydalanuvchi jadvallari
- `POST /api/v1/admin/ota/batch/` — OTA batch yaratish
- `POST /api/v1/auth/forgot-password/` — Parol tiklash

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Django 5.2, DRF, SimpleJWT, Celery, Redis, PostgreSQL |
| Dashboard | React 19, Vite 7, TanStack Router, ShadcnUI, TypeScript, Bun |
| Member App | React 19, Vite 7, TanStack Router, TypeScript, Bun |
| ESP32 | PlatformIO, Espressif IDF (espidf framework), C |
| MQTT Broker | EMQX |
| Monitoring | Sentry, Prometheus |

---

## Acceptance Criteria

- [ ] ESP32 firmware kompilatsiya bo'ladi (PlatformIO build success)
- [ ] ESP32 WiFi'ga ulanadi, MQTT broker'ga connect bo'ladi
- [ ] ESP32 auto-register va activate flow ishlaydi
- [ ] ESP32 jadval bo'yicha qo'ng'iroq chaladi
- [ ] ESP32 OTA yangilash ishlaydi
- [ ] Backend barcha critical buglar tuzatilgan
- [ ] Backend test'lar o'tadi (pytest)
- [ ] Dashboard auth flow to'liq ishlaydi (login → refresh → logout)
- [ ] Dashboard forgot password ishlaydi
- [ ] Member App token refresh ishlaydi
- [ ] Member App schedule create/update ishlaydi
- [ ] Permission system to'g'ri ishlaydi (SuperAdmin vs SchoolAdmin vs Member)
- [ ] CORS production'da cheklangan
- [ ] SECRET_KEY xavfsiz
- [ ] MQTT password hashed

## Non-Goals

- Mobile native app (React Native/Flutter) — hozircha yo'q
- Payment/billing system
- SMS notification (faqat email)
- Multi-tenant SaaS (hozircha single-instance)
- ESP32 BLE provisioning (hozircha hardcoded WiFi credentials)

## Priority Order

1. **ESP32 Firmware** (yangi, asosiy hardware qism)
2. **Backend Critical Fixes** (security + crash fixes)
3. **Member App Fixes** (end-user experience)
4. **Dashboard Fixes** (admin experience)
5. **Arxitektura to'g'rilash** (permission, API separation)
