# School Device — ESP32 Mustahkamlash

## Goal

ESP32 firmware'ni production-ready qilish: WiFi AP provisioning, RTC diagnostika, offline xavfsizlik.

## Vazifalar

### 1. WiFi AP Provisioning (Captive Portal)

WiFi'ga ulanolmasa ESP32 o'zi Access Point bo'ladi va web-sahifa orqali sozlanadi.

**Logic:**
```
Boot → NVS'dan WiFi creds o'qish → Ulanishga harakat (3 marta)
  ├── Ulandi → Normal mode (MQTT, schedule, etc.)
  └── Ulanolmadi → AP Mode:
        ├── SSID: "SchoolBell_XXXX" (oxirgi 4 hex MAC)
        ├── Password: kuchli (NVS'da yoki device label'da)
        ├── Captive Portal: 192.168.4.1
        ├── Web sahifa: FAQAT WiFi SSID/Password o'zgartirish
        ├── Boshqa sozlamalar YO'Q (xavfsizlik)
        └── Save → NVS'ga yozish → Reboot → Normal mode
```

**Xavfsizlik:**
- AP parol: `SchoolBell_` + device MAC oxirgi 6 ta (masalan: `SchoolBell_71CE40`)
- Captive portal'da faqat WiFi creds — jadval, MQTT, boshqa narsa o'zgartirib bo'lmaydi
- 5 daqiqa ichida sozlanmasa → AP o'chadi, 10 daqiqadan keyin yana harakat
- Brute-force himoya: 3 ta noto'g'ri parol → 30s kutish

**Fayllar:**
- `esp32_firmware/src/ap_provisioning.c` + `.h`
- `esp32_firmware/src/captive_portal.c` + `.h` (HTTP server + HTML)
- `esp32_firmware/src/main.c` — AP mode logic

### 2. Offline Mode Xavfsizlik

**Qoidalar:**
- Offline vaqtida ESP32 FAQAT NVS'dagi 7 kunlik jadval bilan ishlaydi
- Offline'da hech narsa o'zgartirilmaydi (AP mode'dan tashqari WiFi creds)
- Online bo'lganda:
  - Server'dan jadval yangilanganmi tekshirish (version compare)
  - Yangilangan bo'lsa → yuklab olish va NVS'ga saqlash
  - Vaqtni SNTP'dan olish va RTC'ga yozish

**Jadval sync logic:**
```
Online bo'ldi → MQTT subscribe → Server jadval version yuboradi
  ├── Version == NVS version → hech narsa qilmaslik
  └── Version > NVS version → yangi jadval olish → NVS'ga saqlash
```

### 3. RTC Diagnostika va Batareya Monitoring

**Muammo:** RTC batareykasi o'lsa vaqt noto'g'ri bo'ladi → jadval ishlamaydi.

**Yechim:**
```
Har kuni 1 marta (soat 3:00 da):
  1. SNTP'dan vaqt olish
  2. RTC'dan vaqt o'qish
  3. Farq > 30 soniya → RTC'ni SNTP bilan to'g'rilash
  4. Farq > 5 daqiqa → RTC batareya muammosi! → MQTT alert yuborish
  5. 3 kun ketma-ket farq > 5 min → "RTC_BATTERY_DEAD" flag → dashboard'da ko'rsatish

Boot'da:
  1. RTC'dan vaqt o'qish
  2. Agar vaqt < 2024 yil → RTC batareya o'lgan
  3. SNTP kutish (online bo'lguncha offline jadval bilan ishlash)
```

**MQTT alert format:**
```json
{"type": "rtc_drift", "drift_sec": 312, "battery_status": "low"}
```

**Dashboard'da:**
- Qurilma kartasida: "RTC ⚠️ Batareya zaiflashgan" badge
- Alert: "Qurilma X ning RTC batareykasini almashtiring"

### 4. Vaqt Sinxronizatsiya Strategiya

```
Boot:
  1. RTC → system time (darhol, offline ishlashi uchun)
  2. WiFi ulanganda → SNTP sync → RTC'ga yozish

Har kuni soat 3:00:
  1. SNTP sync
  2. RTC bilan solishtirish (diagnostika)
  3. RTC'ni yangilash

Har soatda:
  1. SNTP re-sync (allaqachon bor ✅)
  2. RTC'ga yozish (allaqachon bor ✅)
```

### 5. WiFi Reconnect Strategiya (AP+STA mode)

ESP32 bir vaqtda AP (tarqatish) va STA (ulanish) ishlata oladi.

```
Boot:
  1. NVS'da WiFi creds bormi?
     ├── Yo'q → AP+STA mode (AP ko'rinadi, STA scan qiladi)
     └── Bor → STA ulanishga harakat

  2. STA 5 marta fail:
     → AP yoqiladi (AP+STA mode)
     → STA background'da retry davom etadi (30s interval)
     → AP orqali yangi WiFi sozlash mumkin

  3. STA ulandi:
     → Normal mode (MQTT, jadval sync)
     → AP 2 daqiqadan keyin o'chadi (RAM tejash)
     → Agar WiFi yana uzilsa → AP qayta yoqiladi

  4. Reset tugma 3s bosilsa:
     → AP majburiy yoqiladi (WiFi qayta sozlash uchun)
```

**Muhim:** AP yoqiq bo'lsa ham jadval NVS'dan ishlayveradi. WiFi/MQTT faqat sync uchun kerak.

## Fayllar

```
esp32_firmware/
├── src/
│   ├── ap_provisioning.c    # WiFi AP mode + captive portal
│   ├── ap_provisioning.h
│   ├── captive_dns.c        # DNS redirect (captive portal uchun)
│   ├── captive_dns.h
│   ├── rtc_diagnostics.c    # RTC drift detection + battery alert
│   ├── rtc_diagnostics.h
│   ├── main.c               # AP mode logic, WiFi retry strategy
│   ├── wifi_manager.c       # Yangilangan: AP fallback
│   └── schedule_manager.c   # Version-based sync
```

## Acceptance Criteria
- [ ] WiFi'ga 3 marta ulanolmasa → AP mode yoqiladi
- [ ] AP mode: "SchoolBell_XXXX" SSID, kuchli parol
- [ ] Captive portal: faqat WiFi SSID/password o'zgartirish
- [ ] Boshqa sozlamalar captive portal'da YO'Q
- [ ] WiFi sozlangandan keyin reboot va normal mode
- [ ] Offline: NVS jadval bilan ishlaydi, hech narsa o'zgarmaydi
- [ ] Online: jadval version tekshirish, yangilangan bo'lsa sync
- [ ] RTC drift > 5 min → MQTT alert
- [ ] 3 kun ketma-ket drift → "battery dead" flag
- [ ] Dashboard'da RTC battery status ko'rinadi
- [ ] AP mode 5 daqiqadan keyin avtomatik o'chadi

## Priority
1. WiFi AP Provisioning (eng muhim — qurilma sozlash)
2. RTC Diagnostika (batareya monitoring)
3. Offline xavfsizlik (allaqachon 90% tayyor)
4. Vaqt sync strategiya (allaqachon 80% tayyor)
