# Mangan Yuk 🍜

Tugas Besar II4011 Transformasi Digital — aplikasi mobile pemandu wisata kuliner
berbasis lokasi (peta OSM, geofence, narasi audio, trail, dan paspor kuliner).

Repo ini berbentuk **monorepo**:

| Folder        | Isi                                                         | Pemilik  |
|---------------|-------------------------------------------------------------|----------|
| `frontend/`   | 📱 Aplikasi mobile — Expo + TypeScript + expo-router        | FE       |
| `backend/`    | 🗄️ Proyek Supabase — skema DB, seed, storage, skrip ekspor | BE + DB  |
| `content/`    | 🎨 Bahan mentah: foto, audio, transkrip POI                 | Konten   |
| `docs/`       | 📄 PRD, desain, pengujian, compliance matrix, log AI        | Semua    |
| `.github/`    | ⚙️ CI: lint/typecheck/test FE, cek migration BE             | —        |

## Alur data

```
content/  ──(unggah)──▶  Supabase (backend/)  ──(npm run export)──▶  frontend/src/data + assets/content
                                │
                                └──(npm run gen:types)──▶  frontend/src/types/database.types.ts
```

Aplikasi **tidak** memanggil Supabase saat runtime: semua konten POI dibundel
ke dalam aplikasi (offline-first). File bertanda ⚙️ adalah hasil generate —
jangan diedit manual, jalankan ulang skripnya.

## Prasyarat

| Tool                          | Versi       | Dipakai untuk                         |
|-------------------------------|-------------|---------------------------------------|
| Node.js                       | 20 LTS      | frontend & backend                    |
| Git                           | terbaru     |                                       |
| Docker Desktop                | terbaru     | Supabase lokal (`supabase start`)     |
| Expo Go / Android Studio / Xcode | —        | menjalankan aplikasi                  |

Supabase CLI sudah termasuk di `backend/package.json`, jadi tidak perlu dipasang global.

## Cara menjalankan

### 1. Clone

```bash
git clone <url-repo> mangan-yuk
cd mangan-yuk
```

### 2. Backend (Supabase lokal)

Pastikan Docker Desktop sudah berjalan.

```bash
cd backend
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm run db:start              # menjalankan Postgres + Storage + Studio, menerapkan migration & seed
```

Setelah selesai, CLI menampilkan `API URL` dan `service_role key`.
Isi keduanya ke `backend/.env`. Studio bisa dibuka di http://127.0.0.1:54323.

Lalu sinkronkan ke frontend:

```bash
npm run gen:types             # → frontend/src/types/database.types.ts
npm run export                # → frontend/src/data/*.json + frontend/assets/content/
```

> Langkah ini hanya perlu diulang jika skema atau konten di database berubah.
> Anggota FE yang hanya mengerjakan UI bisa langsung ke langkah 3.

### 3. Frontend (Expo)

```bash
cd frontend
npm install
npx expo install --fix        # menyelaraskan versi paket dengan SDK Expo (wajib saat setup pertama)
npm start
```

- Tekan `a` untuk Android emulator, `i` untuk iOS simulator, atau scan QR dengan Expo Go.
- Fitur lokasi di background (geofence) **tidak berjalan di Expo Go**; gunakan development build:
  ```bash
  npx expo run:android        # atau: npx eas build --profile development
  ```

### 4. Cek kualitas kode (sama seperti CI)

```bash
cd frontend
npm run lint
npm run typecheck
npm test
```

## Peta folder

| Path                                   | Keterangan                                                    |
|----------------------------------------|---------------------------------------------------------------|
| `frontend/app/`                        | Screen (expo-router): onboarding, tab, detail POI, navigasi, trail |
| `frontend/src/features/<fitur>/`       | Logika per requirement (F01–F10), lihat tabel di bawah        |
| `frontend/src/components/map/`         | Komponen peta: `OsmMap`, `PoiMarker`, `RouteLine`, dst.       |
| `frontend/src/components/ui/`          | Komponen UI umum (tombol, kartu, dll.)                        |
| `frontend/src/tasks/`                  | Background task lokasi (geofence)                             |
| `frontend/src/store/`                  | State global (Zustand)                                        |
| `frontend/src/storage/`                | Data lokal pengguna (AsyncStorage)                            |
| `frontend/src/lib/`                    | Utilitas: `geo.ts` (haversine), `time.ts`                     |
| `frontend/src/constants/`              | `config.ts` (radius geofence dll.), `map.ts` (URL tile OSM)   |
| `frontend/src/types/`                  | ⚙️ `database.types.ts` (generate), `content.ts`               |
| `frontend/src/data/`                   | ⚙️ `pois.json`, `trails.json`, `area.geojson` (hasil ekspor)  |
| `frontend/assets/content/`             | ⚙️ Foto & audio POI (hasil ekspor)                            |
| `backend/supabase/migrations/`         | Skema tabel, urut berdasarkan timestamp                       |
| `backend/supabase/seed.sql`            | Data awal 10 POI                                              |
| `backend/supabase/storage/`            | Struktur bucket foto & audio                                  |
| `backend/scripts/`                     | `export-content.ts`, `gen-types.sh`                           |
| `content/`                             | Bahan mentah; aturan penamaan di `content/README.md`          |
| `docs/`                                | PRD, desain, pengujian, compliance matrix, log AI             |

### Requirement → folder fitur

| ID  | Fitur                      | Folder `frontend/src/features/`      |
|-----|----------------------------|--------------------------------------|
| F01 | Lokasi pengguna            | `location/`                          |
| F02 | Geofence + notifikasi      | `geofence/`, `notifications/`        |
| F03 | Detail POI + audio         | `poi/`, `audio/`                     |
| F04 | Audio dari notifikasi      | `audio/`, `notifications/`           |
| F05 | Pencarian                  | `search/`                            |
| F06 | Navigasi                   | `navigation/`                        |
| F07 | Rekomendasi                | `recommendation/`                    |
| F08 | Trail planner              | `trail/`                             |
| F10 | Paspor kuliner             | `passport/`                          |

## Alur kerja tim

- Branch dari `main`: `fe/<fitur>`, `be/<fitur>`, `docs/<topik>`.
- Perubahan skema DB **selalu** lewat migration baru: `cd backend && npm run db:new <nama>`;
  jangan mengedit migration yang sudah di-merge.
- CI hanya berjalan untuk folder yang berubah (`frontend/**` atau `backend/**`).
- Catat penggunaan AI di `docs/ai-development-log.md`.

Detail tambahan: [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md) · [content/README.md](content/README.md)
