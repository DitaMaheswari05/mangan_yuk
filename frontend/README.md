# Frontend — Mangan Yuk 📱

Aplikasi mobile Expo + TypeScript dengan routing berbasis file (expo-router).

## Menjalankan

```bash
npm install
npx expo install --fix    # setup pertama: selaraskan versi paket dengan SDK Expo, lalu commit package-lock.json
npm start                 # Expo dev server
npm run android           # development build Android (dibutuhkan untuk background location)
```

| Script              | Fungsi                         |
|---------------------|--------------------------------|
| `npm start`         | Expo dev server                |
| `npm run android`   | build & jalankan di Android    |
| `npm run ios`       | build & jalankan di iOS (macOS)|
| `npm run lint`      | ESLint (`eslint-config-expo`)  |
| `npm run typecheck` | `tsc --noEmit`                 |
| `npm test`          | Jest (`jest-expo`)             |

## Konvensi

- Import dari `src/` memakai alias `@/` — contoh: `import { distanceMeters } from '@/lib/geo'`.
- Screen di `app/` tipis saja; logika diletakkan di `src/features/<fitur>/`.
- Test diletakkan di `__tests__/` di dalam folder fitur.
- Angka yang bisa diatur (radius geofence, interval lokasi) ada di `src/constants/config.ts`.
- **Jangan mengedit** `src/types/database.types.ts`, `src/data/*`, dan `assets/content/` —
  semuanya dihasilkan oleh skrip di `backend/` (lihat README root).
- File `.geojson` dapat di-import langsung (diatur di `metro.config.js`).
- Peta memakai tile OpenStreetMap; atribusi (`MapAttribution`) wajib selalu tampil.

## Struktur

```
app/
  _layout.tsx, index.tsx       # root stack & redirect onboarding/beranda
  onboarding/                  # welcome, location, notification, preferences, no-location
  (tabs)/                      # index (Beranda/peta), search, passport, settings
  poi/[id].tsx                 # detail POI
  navigate/[poiId].tsx         # navigasi ke POI
  trail/                       # planner, itinerary, summary
src/
  features/                    # logika per requirement (F01–F10)
  components/map, components/ui
  tasks/backgroundLocation.ts
  store/ storage/ lib/ constants/ types/ data/
assets/
  content/                     # ⚙️ foto & audio hasil ekspor
  maps/denah-sudirman.png      # denah kawasan (tambahkan manual)
  images/                      # ikon, ilustrasi onboarding
```
