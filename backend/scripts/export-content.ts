// Ekspor konten Supabase → frontend/src/data/*.json + frontend/assets/content/
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di backend/.env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const FRONTEND = path.resolve(__dirname, '../../frontend');
const DATA_DIR = path.join(FRONTEND, 'src/data');
const ASSET_DIR = path.join(FRONTEND, 'assets/content');

type MenuRow = {
  id: string;
  name: string;
  price_idr: number;
  tastes: string[];
  food_type: string | null;
  dish_category: string | null;
  is_halal: boolean | null;
  is_signature: boolean;
  position: number;
};

// Harus sama dengan PriceBucket di frontend/src/types/content.ts.
function priceBucket(priceIdr: number) {
  if (priceIdr < 25_000) return 'murah';
  if (priceIdr < 50_000) return 'sedang';
  if (priceIdr < 100_000) return 'mahal';
  return 'premium';
}

async function download(bucket: string, objectPath: string) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) throw new Error(`${bucket}/${objectPath}: ${error.message}`);
  const dest = path.join(ASSET_DIR, bucket, objectPath);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

async function main() {
  const { data: pois, error } = await supabase
    .from('pois')
    .select('*, menu_items(*), poi_photos(path, position)')
    .order('id');
  if (error) throw error;
  const { data: trails, error: trailErr } = await supabase
    .from('trails')
    .select('id, name, description, trail_pois(poi_id, position)')
    .order('id');
  if (trailErr) throw trailErr;

  // Filter per menu butuh food_type & dish_category di setiap menu.
  const missing = pois.flatMap((p) =>
    (p.menu_items as MenuRow[]).filter((m) => !m.food_type || !m.dish_category).map((m) => m.id),
  );
  if (missing.length) {
    throw new Error(`food_type/dish_category kosong di menu: ${missing.join(', ')}`);
  }

  for (const poi of pois) {
    for (const photo of poi.poi_photos) await download('poi-photos', photo.path);
    if (poi.audio_path) await download('poi-audio', poi.audio_path);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, 'pois.json'),
    JSON.stringify(
      pois.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.food_type,
        categoryLabel: p.category_label,
        tasteTags: p.tastes,
        isHalal: p.is_halal,
        zone: p.zone,
        description: p.description,
        latitude: p.latitude,
        longitude: p.longitude,
        triggerRadiusM: p.trigger_radius_m,
        avgVisitMin: p.avg_visit_min,
        searchKeywords: p.search_keywords,
        menu: [...(p.menu_items as MenuRow[])]
          .sort((a, b) => a.position - b.position)
          .map((m) => ({
            id: m.id,
            poiId: p.id,
            name: m.name,
            priceIdr: m.price_idr,
            priceBucket: priceBucket(m.price_idr),
            tasteTags: m.tastes,
            type: m.food_type,
            dishCategory: m.dish_category,
            // null = belum diverifikasi → warisi status tenant (dapur non-halal → menu ikut non-halal).
            isHalal: m.is_halal ?? (p.is_halal === false ? false : null),
            isSignature: m.is_signature,
          })),
        photos: [...p.poi_photos]
          .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
          .map((ph: { path: string }) => ph.path),
        audio: p.audio_path,
        audioDurationSec: p.audio_duration_sec,
      })),
      null,
      2,
    ),
  );
  await writeFile(
    path.join(DATA_DIR, 'trails.json'),
    JSON.stringify(
      trails.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        poiIds: [...t.trail_pois].sort((a, b) => a.position - b.position).map((tp) => tp.poi_id),
      })),
      null,
      2,
    ),
  );
  const menuCount = pois.reduce((n, p) => n + p.menu_items.length, 0);
  console.log(`Ekspor selesai: ${pois.length} POI, ${menuCount} menu, ${trails.length} trail.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
