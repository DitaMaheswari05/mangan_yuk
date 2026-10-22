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

async function download(bucket: string, objectPath: string) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) throw new Error(`${bucket}/${objectPath}: ${error.message}`);
  const dest = path.join(ASSET_DIR, bucket, objectPath);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

async function main() {
  const { data: pois, error } = await supabase.from('pois').select('*').order('id');
  if (error) throw error;
  const { data: trails, error: trailErr } = await supabase
    .from('trails')
    .select('id, name, description, trail_pois(poi_id, position)')
    .order('id');
  if (trailErr) throw trailErr;

  for (const poi of pois) {
    for (const photo of poi.photos) await download('poi-photos', photo);
    if (poi.audio) await download('poi-audio', poi.audio);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, 'pois.json'),
    JSON.stringify(
      pois.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        latitude: p.latitude,
        longitude: p.longitude,
        photos: p.photos,
        audio: p.audio,
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
  console.log(`Ekspor selesai: ${pois.length} POI, ${trails.length} trail.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
