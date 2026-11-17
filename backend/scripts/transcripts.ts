/** Helper bersama untuk content/transcripts/pXX.md (dipakai gen:audio & upload:audio). */
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '../..');
export const TRANSCRIPTS = path.join(ROOT, 'content/transcripts');
export const AUDIO = path.join(ROOT, 'content/audio');

/** Batas durasi narasi, sama dengan check constraint pois.audio_duration_sec. */
export const MIN_SEC = 45;
export const MAX_SEC = 90;

const PLACEHOLDER = '<transkrip narasi>';
export const DURATION_RE = /^Durasi audio:.*$/m;

/** Ambil teks narasi: semua baris setelah baris 'Durasi audio'. */
export function extractNarration(md: string): string | null {
  const m = DURATION_RE.exec(md);
  const text = (m ? md.slice(m.index + m[0].length) : md).trim();
  return !text || text.includes(PLACEHOLDER) ? null : text;
}

/** Durasi (detik) yang ditulis gen:audio di baris 'Durasi audio: N detik', atau null. */
export function extractDuration(md: string): number | null {
  const m = /^Durasi audio:\s*(\d+)\s*detik/m.exec(md);
  return m ? Number(m[1]) : null;
}
