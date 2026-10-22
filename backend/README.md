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

| Tabel        | Isi                                               |
|--------------|---------------------------------------------------|
| `pois`       | 10 POI: nama, koordinat, path foto & audio        |
| `trails`     | Trail kuliner                                     |
| `trail_pois` | Urutan POI dalam setiap trail                     |

Semua tabel publik-baca (RLS `select using (true)`); penulisan hanya lewat service role / Studio.

## Storage

Lihat [supabase/storage/README.md](supabase/storage/README.md).
