# Storage

Bucket didefinisikan di `../config.toml`:

| Bucket       | Isi                     | Path objek                  |
|--------------|-------------------------|-----------------------------|
| `poi-photos` | foto POI (jpg/png/webp) | `p01/1.jpg`, `p01/2.jpg`, … |
| `poi-audio`  | narasi audio POI (mp3)  | `p01.mp3`, …                |

File yang diletakkan di `poi-photos/` dan `poi-audio/` folder ini otomatis
diunggah oleh `supabase start` / `supabase db reset` (lingkungan lokal).
Kedua bucket bersifat publik-baca; penulisan hanya lewat service role.
