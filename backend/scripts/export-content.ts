import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = path.resolve(__dirname, '../../frontend');
const DATA_DIR = path.join(FRONTEND, 'src/data');
const ASSET_DIR = path.join(FRONTEND, 'assets/content');
const AREA_ID = 'sudirman-street-food';
const CIRCLE_SEGMENTS = 64;

const prisma = new PrismaClient();

// Kolom `time` dibaca Prisma sebagai Date 1970-01-01 UTC.
const hhmm = (d: Date) => d.toISOString().slice(11, 16);

let storage: SupabaseClient | null = null;
function getStorage(): SupabaseClient {
  if (storage) return storage;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Ada foto/audio untuk diunduh: isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di backend/.env');
  }
  storage = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return storage;
}

const ASSET_MAP_FILE = path.join(DATA_DIR, 'assets.ts');
const downloadedAssetKeys: string[] = [];

async function download(bucket: string, objectPath: string) {
  const { data, error } = await getStorage().storage.from(bucket).download(objectPath);
  if (error) throw new Error(`${bucket}/${objectPath}: ${error.message}`);
  const dest = path.join(ASSET_DIR, bucket, objectPath);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
  downloadedAssetKeys.push(`${bucket}/${objectPath}`);
}

/** Metro hanya bisa membundel aset lewat require() statis → tulis peta assetKey → modul. */
async function writeAssetMap() {
  const lines = [...downloadedAssetKeys]
    .sort()
    .map((key) => `  '${key}': require('../../assets/content/${key}'),`);
  const body = lines.length ? `{
${lines.join('
')}
}` : '{}';
  await writeFile(
    ASSET_MAP_FILE,
    [
      '// ⚙️ Dihasilkan oleh backend/scripts/export-content.ts — jangan diedit manual.',
      '// Metro hanya bisa membundel aset lewat require() statis, jadi peta assetKey → modul ada di sini.',
      '/* eslint-disable @typescript-eslint/no-require-imports */',
      '',
      `export const CONTENT_ASSETS: Record<string, number> = ${body};`,
      '',
    ].join('
'),
  );
}

/** Lingkaran radius `radiusM` di sekitar pusat, sebagai polygon GeoJSON untuk overlay peta. */
function circlePolygon(lat: number, lng: number, radiusM: number) {
  const R = 6_371_000;
  const ring: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const θ = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    const dLat = ((radiusM * Math.cos(θ)) / R) * (180 / Math.PI);
    const dLng = ((radiusM * Math.sin(θ)) / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    ring.push([+(lng + dLng).toFixed(7), +(lat + dLat).toFixed(7)]);
  }
  return ring;
}

const write = (file: string, value: unknown) =>
  writeFile(path.join(DATA_DIR, file), JSON.stringify(value, null, 2) + '\n');

async function main() {
  const area = await prisma.area.findUnique({ where: { id: AREA_ID } });
  if (!area) throw new Error(`Baris areas '${AREA_ID}' tidak ada. Jalankan seed dulu.`);

  const pois = await prisma.poi.findMany({
    where: { areaId: AREA_ID },
    orderBy: { id: 'asc' },
    include: {
      photos: { orderBy: { position: 'asc' } },
      menuItems: { orderBy: { position: 'asc' } },
      openingHours: { orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }] },
      peakHours: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
    },
  });
  const trails = await prisma.trail.findMany({
    orderBy: { id: 'asc' },
    include: { trailPois: { orderBy: { position: 'asc' } } },
  });
  const pairings = await prisma.tastePairing.findMany({ orderBy: { id: 'asc' } });

  for (const p of pois) {
    for (const ph of p.photos) await download('poi-photos', ph.path);
    if (p.audioPath) await download('poi-audio', p.audioPath);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeAssetMap();

  await write('area.json', {
    id: area.id,
    name: area.name,
    center: { latitude: area.centerLatitude, longitude: area.centerLongitude },
    entryRadiusM: area.entryRadiusM,
    exitHysteresisM: area.exitHysteresisM,
    googleMapsQuery: area.googleMapsQuery,
  });

  await write('area.geojson', {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: area.id, name: area.name, radiusM: area.entryRadiusM },
        geometry: {
          type: 'Polygon',
          coordinates: [circlePolygon(area.centerLatitude, area.centerLongitude, area.entryRadiusM)],
        },
      },
    ],
  });

  await write(
    'pois.json',
    pois.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.foodType,
      categoryLabel: p.categoryLabel,
      tasteTags: p.tastes,
      isHalal: p.isHalal,
      zone: p.zone,
      latitude: p.latitude,
      longitude: p.longitude,
      triggerRadiusM: p.triggerRadiusM,
      avgVisitMin: p.avgVisitMin,
      description: p.description,
      culturalStory: p.culturalStory,
      photos: p.photos.map((ph) => ({ assetKey: `poi-photos/${ph.path}`, kind: ph.kind, caption: ph.caption })),
      audio:
        p.audioPath && p.audioDurationSec != null && p.audioTranscript != null
          ? { assetKey: `poi-audio/${p.audioPath}`, durationSec: p.audioDurationSec, transcript: p.audioTranscript }
          : null,
      menu: p.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        priceIdr: m.priceIdr,
        tastes: m.tastes,
        isSignature: m.isSignature,
      })),
      openingHours: p.openingHours.map((h) => ({ day: h.dayOfWeek, open: hhmm(h.openTime), close: hhmm(h.closeTime) })),
      peakHours: p.peakHours.map((h) => ({ day: h.dayOfWeek, open: hhmm(h.startTime), close: hhmm(h.endTime) })),
      searchKeywords: p.searchKeywords,
      qrCode: p.qrCode,
    })),
  );

  await write(
    'trails.json',
    trails.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      badgeName: t.badgeName,
      badgeIcon: t.badgeIcon,
      poiIds: t.trailPois.map((tp) => tp.poiId),
    })),
  );

  await write(
    'taste-pairings.json',
    pairings.map((tp) => ({
      afterTaste: tp.afterTaste,
      suggestTaste: tp.suggestTaste,
      suggestFoodType: tp.suggestFoodType,
      reason: tp.reason,
    })),
  );

  console.log(
    `Ekspor selesai: ${pois.length} POI, ${trails.length} trail, ${pairings.length} pasangan rasa.\n` +
      'Cek validasi dataset: cd ../frontend && npx jest dataset',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
