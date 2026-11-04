# Backend — Mangan Yuk 🗄️

Proyek Supabase (Postgres + Storage). Dipakai sebagai **sumber kebenaran konten**;
hasilnya diekspor ke `frontend/` sehingga aplikasi bisa berjalan offline.

## Menjalankan lokal

Butuh Docker Desktop yang sedang berjalan.

```bash
npm install
cp .env.example .env      # isi SUPABASE_SERVICE_ROLE_KEY dari output `npm run db:start`
npm run db:start
```

| Script                    | Fungsi                                                         |
|---------------------------|----------------------------------------------------------------|
| `npm run db:start`        | Menjalankan Supabase lokal (API :54321, DB :54322, Studio :54323) |
| `npm run db:stop`         | Menghentikan Supabase lokal                                    |
| `npm run db:reset`        | Hapus DB lokal, terapkan ulang semua migration + `seed.sql`    |
| `npm run db:new <nama>`   | Membuat file migration baru di `supabase/migrations/`          |
| `npm run gen:types`       | Generate `frontend/src/types/database.types.ts`                |
| `npm run export`          | Ekspor POI/trail + foto/audio ke `frontend/`                   |

`npm run gen:types` memakai bash; di Windows jalankan dari Git Bash.

## Mengubah skema

1. `npm run db:new tambah_kolom_x`
2. Tulis SQL di file migration yang baru dibuat.
3. `npm run db:reset` untuk menguji dari nol.
4. `npm run gen:types && npm run export`, lalu commit perubahan di `backend/` **dan** `frontend/`.

Jangan mengedit migration yang sudah di-merge ke `main`; buat migration baru.

## Tabel

| Tabel            | Isi                                                        |
|------------------|------------------------------------------------------------|
| `areas`          | Kawasan Sudirman Street Food: titik pusat, radius entry/exit |
| `pois`           | 10 POI: kategori, rasa, koordinat, radius trigger, cerita, audio |
| `poi_photos`     | Foto POI (food / tenant / ambience)                        |
| `menu_items`     | Menu & harga per POI                                       |
| `opening_hours`  | Jam buka per hari                                          |
| `peak_hours`     | Jam ramai hasil observasi (F07)                            |
| `taste_pairings` | Aturan pasangan rasa untuk rekomendasi (F07)               |
| `trails`         | Trail tematik Paspor Kuliner (F10)                         |
| `trail_pois`     | Urutan POI dalam setiap trail                              |
| `profiles`       | Profil + preferensi onboarding, 1:1 dengan `auth.users`    |
| `passport_stamps`| Stempel Paspor Kuliner per pengguna (tanpa koordinat, F09) |

Skema Prisma ([prisma/schema.prisma](prisma/schema.prisma)) mencerminkan migration dan hanya dipakai
sebagai client; perubahan skema tetap lewat migration Supabase.

Semua tabel konten publik-baca (RLS `select using (true)`); penulisan hanya lewat service role / Studio.
`profiles` dan `passport_stamps` hanya bisa diakses pemiliknya (RLS `auth.uid()`); profil dibuat otomatis
oleh trigger saat sign-up.

## Storage

Lihat [supabase/storage/README.md](supabase/storage/README.md).
