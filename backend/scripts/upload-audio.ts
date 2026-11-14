/**
 * Unggah narasi content/audio/pXX.mp3 ke bucket Supabase `poi-audio`, lalu isi
 * pois.audio_path, audio_duration_sec, dan audio_transcript dari transkripnya.
 *
 * Pemakaian (dari folder backend/):
 *   npm run upload:audio                # semua MP3 yang ada
 *   npm run upload:audio -- p01 p03     # POI tertentu saja
 *   npm run upload:audio -- --dry-run   # cek saja, tanpa unggah/ubah DB
 *
 * Butuh SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan DATABASE_URL di backend/.env.
 * Setelah ini jalankan `npm run export` supaya audio ikut dibundel ke app.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AUDIO, MAX_SEC, MIN_SEC, TRANSCRIPTS, extractDuration, extractNarration } from './transcripts';

const BUCKET = 'poi-audio';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'dry-run': { type: 'boolean', default: false } },
  });
  const dryRun = values['dry-run']!;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di backend/.env');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const prisma = new PrismaClient();

  try {
    let ids = (await readdir(AUDIO))
      .filter((f) => /^p\d+\.mp3$/.test(f))
      .map((f) => f.slice(0, -4))
      .sort();
    if (positionals.length) ids = ids.filter((id) => positionals.map((p) => p.toLowerCase()).includes(id));

    const poiIds = new Set((await prisma.poi.findMany({ select: { id: true } })).map((p) => p.id));

    const done: string[] = [];
    const problems: string[] = [];
    for (const id of ids) {
      const poiId = id.toUpperCase(); // file p01.mp3 ↔ POI 'P01'
      const mdFile = path.join(TRANSCRIPTS, `${id}.md`);
      if (!poiIds.has(poiId)) { problems.push(`${id}: POI ${poiId} tidak ada di database`); continue; }
      if (!existsSync(mdFile)) { problems.push(`${id}: transkrip ${id}.md tidak ada`); continue; }

      const md = await readFile(mdFile, 'utf8');
      const transcript = extractNarration(md);
      const duration = extractDuration(md);
      if (!transcript) { problems.push(`${id}: transkrip belum diisi`); continue; }
      if (duration == null) { problems.push(`${id}: baris 'Durasi audio: N detik' kosong, jalankan gen:audio dulu`); continue; }
      if (duration < MIN_SEC || duration > MAX_SEC) {
        problems.push(`${id}: durasi ${duration} dtk di luar ${MIN_SEC}–${MAX_SEC} (ditolak constraint DB)`);
        continue;
      }

      const objectPath = `${id}.mp3`;
      if (!dryRun) {
        const mp3 = await readFile(path.join(AUDIO, objectPath));
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(objectPath, mp3, { contentType: 'audio/mpeg', upsert: true });
        if (error) { problems.push(`${id}: gagal unggah: ${error.message}`); continue; }

        await prisma.poi.update({
          where: { id: poiId },
          data: { audioPath: objectPath, audioDurationSec: duration, audioTranscript: transcript },
        });
      }
      done.push(`${id} (${duration} dtk)`);
    }

    console.log(`\n== Ringkasan${dryRun ? ' (dry run, tidak ada yang diubah)' : ''} ==`);
    console.log(`${dryRun ? 'Siap diunggah' : 'Diunggah'}: ${done.join(', ') || '-'}`);
    if (problems.length) {
      console.log('Dilewati:');
      for (const p of problems) console.log(`  ! ${p}`);
    }
    const withoutAudio = [...poiIds].filter((p) => !ids.includes(p.toLowerCase())).sort();
    if (withoutAudio.length && !positionals.length) console.log(`POI tanpa MP3: ${withoutAudio.join(', ')}`);
    if (done.length && !dryRun) console.log('\nLanjut: npm run export');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
