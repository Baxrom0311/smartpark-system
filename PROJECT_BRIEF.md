# SmartPark — Aqilli Parkovka Tizimi

## Goal

ESP32 + ultrasonik sensorlar yordamida real-time parkovka monitoring tizimi yaratish.
Multi-tenant arxitektura: admin parkovka joylarini boshqaradi, parkovka egalari o'z joylarini nazorat qiladi, mijozlar bo'sh joylarni ko'radi va bron qiladi. Vaqtga asoslangan narx hisoblash.

Bu diplom ishi — prototip darajasida, lekin to'liq ishlaydigan eko-tizim.

---

## Tech Stack

| Qatlam | Texnologiya |
|--------|-------------|
| Hardware | ESP32 DevKit + 4x HC-SR04 ultrasonik sensor |
| Firmware | PlatformIO (Arduino framework), C++ |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Auth | JWT (simple login — phone + password) |
| Android | Kotlin, Jetpack Compose, Retrofit |
| Realtime | WebSocket (ESP32 → Backend), SSE (Backend → Android) |
| Deploy | Docker Compose (backend + db) |

---

## Architecture

```
[HC-SR04 x4] → [ESP32] —WiFi/HTTP POST→ [FastAPI Backend] ←→ [PostgreSQL]
                                              ↕ SSE
                                         [Android App]
```

### Komponentlar:

1. **ESP32 Firmware** — Har 2 sekundda sensorlarni o'qiydi, masofaga qarab occupied/free aniqlaydi, backend ga POST qiladi
2. **FastAPI Backend** — REST API + WebSocket/SSE, JWT auth, biznes logika
3. **Android App** — Mijoz va parkovka egasi uchun UI (role-based)

---

## Database Schema

```sql
-- Foydalanuvchilar (admin, owner, client)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'client', -- admin, owner, client
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Parkovka joylari (parking lot)
CREATE TABLE parking_lots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    owner_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    hourly_rate INTEGER NOT NULL DEFAULT 5000, -- so'm/soat
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alohida parkovka slotlari
CREATE TABLE parking_slots (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER REFERENCES parking_lots(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL,
    sensor_id VARCHAR(50), -- ESP32 dan keladigan sensor identifikatori
    status VARCHAR(20) DEFAULT 'free', -- free, occupied, reserved
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bron qilish
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES parking_slots(id),
    user_id INTEGER REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP, -- NULL = hali turibdi
    total_cost INTEGER DEFAULT 0, -- so'mda
    status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sensor log (tarix uchun)
CREATE TABLE sensor_logs (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES parking_slots(id),
    distance_cm FLOAT NOT NULL,
    is_occupied BOOLEAN NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Ro'yxatdan o'tish (phone, password, full_name)
- `POST /api/auth/login` — Login (phone, password) → JWT token

### Admin
- `POST /api/admin/parking-lots` — Yangi parkovka yaratish
- `GET /api/admin/parking-lots` — Barcha parkovkalar ro'yxati
- `PUT /api/admin/parking-lots/{id}` — Parkovka tahrirlash
- `DELETE /api/admin/parking-lots/{id}` — Parkovka o'chirish
- `POST /api/admin/parking-lots/{id}/slots` — Slot qo'shish
- `PUT /api/admin/users/{id}/role` — Foydalanuvchi rolini o'zgartirish
- `POST /api/admin/parking-lots/{id}/assign-owner` — Egasini tayinlash

### Owner (Parkovka egasi)
- `GET /api/owner/my-lots` — O'z parkovkalari
- `GET /api/owner/my-lots/{id}/stats` — Statistika (band/bo'sh, daromad)
- `GET /api/owner/my-lots/{id}/history` — Bron tarixi
- `PUT /api/owner/slots/{id}/rate` — Narx o'zgartirish

### Client (Mijoz)
- `GET /api/parking-lots` — Barcha parkovkalar (bo'sh joylar soni bilan)
- `GET /api/parking-lots/{id}/slots` — Slotlar holati (real-time)
- `POST /api/reservations` — Bron qilish (slot_id)
- `PUT /api/reservations/{id}/end` — Tugatish (vaqt * narx hisoblanadi)
- `GET /api/reservations/my` — Mening bronlarim
- `GET /api/reservations/{id}` — Bron tafsiloti

### ESP32 (Device)
- `POST /api/device/sensor-data` — Sensor ma'lumotlarini yuborish (API key auth)
  ```json
  {
    "device_id": "esp32_001",
    "sensors": [
      {"slot_number": 1, "distance_cm": 5.2, "is_occupied": true},
      {"slot_number": 2, "distance_cm": 150.0, "is_occupied": false}
    ]
  }
  ```

### SSE (Real-time)
- `GET /api/stream/parking-lots/{id}` — Slot holati o'zgarishlarini stream qilish

---

## ESP32 Firmware Spec

- **Pinlar:** 4 ta HC-SR04 (trigger + echo = 8 pin)
- **Logika:** distance < 20cm → occupied, distance >= 20cm → free
- **Interval:** Har 2 sekundda o'qish, faqat o'zgarish bo'lganda POST
- **Config:** WiFi SSID/password va backend URL `config.h` da
- **Endpoint:** `POST /api/device/sensor-data` ga JSON yuborish
- **Auth:** Oddiy API key header (`X-Device-Key`)
- **LED:** Har slot uchun LED (yashil=bo'sh, qizil=band) — ixtiyoriy

---

## Android App Screens

### Umumiy
- Login screen (phone + password)
- Register screen

### Client role
- Parkovkalar ro'yxati (bo'sh joylar soni ko'rinadi)
- Parkovka tafsiloti (slotlar grid — yashil/qizil)
- Bron qilish dialog
- Mening bronlarim (aktiv + tarix)
- Bron tafsiloti (vaqt, narx, tugatish tugmasi)

### Owner role
- Mening parkovkalarim ro'yxati
- Parkovka statistikasi (bugungi daromad, band/bo'sh)
- Bron tarixi

---

## Acceptance Criteria

1. ✅ ESP32 sensorlardan ma'lumot o'qiydi va backend ga yuboradi
2. ✅ Backend sensor datani qabul qiladi va slot statusini yangilaydi
3. ✅ Admin yangi parkovka va slotlar yarata oladi
4. ✅ Admin parkovkaga owner tayinlay oladi
5. ✅ Mijoz bo'sh joylarni real-time ko'ra oladi
6. ✅ Mijoz slot bron qila oladi
7. ✅ Bron tugatilganda vaqt * narx hisoblanadi
8. ✅ Owner o'z parkovkasi statistikasini ko'ra oladi
9. ✅ JWT auth ishlaydi (phone + password)
10. ✅ Android app login, ro'yxat, bron qilish ishlaydi
11. ✅ Docker Compose bilan backend + db ishga tushadi

---

## Non-goals

- To'lov integratsiyasi (Payme, Click) — faqat hisoblash
- Push notification
- Xarita integratsiyasi (Google Maps)
- Kamera yoki ANPR (raqam aniqlash)
- Admin panel web UI (faqat API)
- Multi-language support
- Rate limiting / throttling

---

## Constraints

- Diplom ishi — o'rtacha murakkablik, lekin to'liq ishlaydigan
- ESP32 prototip — 4 ta sensor, 1 ta device
- Android — Jetpack Compose (tez development)
- Auth sodda — phone + password, JWT
- Narx faqat soatlik (hourly_rate * soat)
- Bitta valyuta — so'm (integer, tiyin yo'q)

---

## Folder Structure

```
parking_esp32/
├── esp32/                    # ESP32 PlatformIO loyihasi (→ github.com/Baxrom0311/smartpark-esp32)
│   ├── platformio.ini
│   ├── src/
│   │   └── main.cpp
│   └── include/
│       └── config.h
├── backend/                  # FastAPI backend (→ github.com/Baxrom0311/smartpark-backend)
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   └── auth/
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
├── android/                  # Android Jetpack Compose (→ github.com/Baxrom0311/smartpark-android)
│   ├── app/
│   │   └── src/main/java/com/smartpark/
│   ├── build.gradle.kts
│   └── gradle/
├── docker-compose.yml
├── PROJECT_BRIEF.md
├── AGENTS.md
└── agentloop.toml
```
