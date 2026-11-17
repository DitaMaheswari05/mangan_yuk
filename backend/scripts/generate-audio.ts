/**
 * Generate narasi audio POI (content/audio/pXX.mp3) dari transkrip pakai Gemini TTS.
 *
 * Pemakaian (dari folder backend/):
 *   npm run gen:audio                       # semua transkrip yang sudah diisi
 *   npm run gen:audio -- p01 p02            # POI tertentu saja
 *   npm run gen:audio -- --force p01        # buat ulang walau MP3 sudah ada
 *   npm run gen:audio -- --voice Puck       # ganti suara (default Sulafat; Achird, Aoede, Kore, ...)
 *
 * Butuh GEMINI_API_KEY di .env root repo dan ffmpeg di PATH.
 * Mode resume: MP3 yang sudah ada & transkrip yang masih template dilewati.
 * Kalau kena batas kuota (HTTP 429), script berhenti — jalankan lagi nanti/besok.
 */
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AUDIO, DURATION_RE, MAX_SEC, MIN_SEC, ROOT, TRANSCRIPTS, extractNarration } from './transcripts';

config({ path: path.join(ROOT, '.env') });

const DEFAULT_MODEL = 'gemini-3.8-flash-tts';
const DEFAULT_VOICE = 'Sulafat';
const SAMPLE_RATE = 24_000; // PCM 16-bit mono dari Gemini TTS
const DELAY_MS = 25_000; // jeda antar-request agar tidak kena batas per menit

class QuotaExceeded extends Error {}

async function synthesize(text: string, apiKey: string, model: string, voice: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );
  if (res.status === 429) throw new QuotaExceeded(await res.text());
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error(`Respons tanpa audio: ${JSON.stringify(data).slice(0, 500)}`);
  return Buffer.from(b64, 'base64');
}

function pcmToMp3(pcm: Buffer, out: string) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1',
      '-i', 'pipe:0', '-ac', '1', '-b:a', '96k', out],
    { input: pcm },
  );
  if (r.error) throw new Error(`ffmpeg tidak bisa dijalankan: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg gagal: ${r.stderr.toString()}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      force: { type: 'boolean', default: false },
      model: { type: 'string', default: DEFAULT_MODEL },
      voice: { type: 'string', default: DEFAULT_VOICE },
    },
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY tidak ditemukan di .env root repo');
  await mkdir(AUDIO, { recursive: true });

  let ids = (await readdir(TRANSCRIPTS))
    .filter((f) => /^p\d+\.md$/.test(f))
    .map((f) => f.slice(0, -3))
    .sort();
  if (positionals.length) ids = ids.filter((id) => positionals.includes(id));

  const skipped: string[] = [];
  const pending: { id: string; file: string; md: string; text: string; mp3: string }[] = [];
  for (const id of ids) {
    const file = path.join(TRANSCRIPTS, `${id}.md`);
    const md = await readFile(file, 'utf8');
    const text = extractNarration(md);
    const mp3 = path.join(AUDIO, `${id}.mp3`);
    if (!text) skipped.push(`${id} (transkrip belum diisi)`);
    else if (existsSync(mp3) && !values.force) skipped.push(`${id} (MP3 sudah ada)`);
    else pending.push({ id, file, md, text, mp3 });
  }

  const done: string[] = [];
  const warned: string[] = [];
  for (const [i, p] of pending.entries()) {
    if (i) await new Promise((r) => setTimeout(r, DELAY_MS));
    console.log(`[${i + 1}/${pending.length}] ${p.id} ...`);
    let pcm: Buffer;
    try {
      pcm = await synthesize(p.text, apiKey, values.model!, values.voice!);
    } catch (e) {
      if (!(e instanceof QuotaExceeded)) throw e;
      console.log(`\nKuota habis (429). Belum dibuat: ${pending.slice(i).map((x) => x.id).join(', ')}`);
      console.log('Jalankan lagi nanti/besok — yang sudah jadi akan dilewati.');
      break;
    }
    pcmToMp3(pcm, p.mp3);

    const seconds = Math.round(pcm.length / (SAMPLE_RATE * 2));
    await writeFile(p.file, p.md.replace(DURATION_RE, `Durasi audio: ${seconds} detik`), 'utf8');
    done.push(`${p.id} (${seconds} dtk)`);
    if (seconds < MIN_SEC || seconds > MAX_SEC) {
      warned.push(`${p.id}: ${seconds} dtk (target ${MIN_SEC}–${MAX_SEC})`);
    }
  }

  console.log('\n== Ringkasan ==');
  console.log(`Dibuat  : ${done.join(', ') || '-'}`);
  console.log(`Dilewati: ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s}`);
  if (warned.length) {
    console.log('Durasi di luar target (perpendek/perpanjang transkrip lalu --force):');
    for (const w of warned) console.log(`  ! ${w}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
