# Content — bahan mentah

Folder ini berisi bahan mentah **sebelum** diunggah ke Supabase Storage.
Aplikasi tidak membaca folder ini secara langsung.

## Aturan penamaan

| Jenis      | Lokasi                     | Format nama              | Contoh                    |
|------------|----------------------------|--------------------------|---------------------------|
| Foto       | `photos/pXX/`              | `1.jpg`, `2.jpg`, …      | `photos/p01/1.jpg`        |
| Audio      | `audio/`                   | `pXX.mp3`                | `audio/p01.mp3`           |
| Transkrip  | `transcripts/`             | `pXX.md`                 | `transcripts/p01.md`      |

- `pXX` = ID POI dua digit (`p01` … `p10`), sama dengan kolom `pois.id` di database.
- Foto: JPG, sisi terpanjang maks. 1600 px, ukuran < 500 KB.
- Audio: MP3 mono, 64–128 kbps, **durasi 45–90 detik**.
- Transkrip: teks narasi persis seperti yang dibacakan di audio.

## Alur

1. Taruh file di folder ini sesuai aturan di atas.
2. Salin ke `backend/supabase/storage/poi-photos/` dan `poi-audio/` (lokal),
   atau unggah lewat Supabase Studio (produksi).
3. Jalankan `npm run export` di `backend/` untuk menyalin ke aplikasi.
