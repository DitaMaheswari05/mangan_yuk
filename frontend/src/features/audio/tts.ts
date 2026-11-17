// F04 – Text-to-Speech (TTS) Service untuk interaksi Eyes-Free dan panduan audio.
// Membaca prompt suara proximity ("Kamu mendekati X. Mau dengar ceritanya?"),
// narasi kuliner POI jika audio rekaman belum tersedia, serta instruksi navigasi.

export type SpeakOptions = {
  language?: string;
  pitch?: number;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: unknown) => void;
};

function getSpeechModule(): typeof import('expo-speech') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech') as typeof import('expo-speech');
  } catch {
    return null;
  }
}

let speaking = false;

/**
 * Membaca teks menggunakan modul expo-speech (default bahasa Indonesia 'id-ID').
 */
export async function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  const Speech = getSpeechModule();
  if (!Speech) {
    options.onDone?.();
    return;
  }

  const {
    language = 'id-ID',
    pitch = 1.0,
    rate = 0.95, // Sedikit lebih lambat agar jelas saat pengguna sedang berjalan
    onDone,
    onStopped,
    onError,
  } = options;

  try {
    speaking = true;
    Speech.speak(text, {
      language,
      pitch,
      rate,
      onDone: () => {
        speaking = false;
        onDone?.();
      },
      onStopped: () => {
        speaking = false;
        onStopped?.();
      },
      onError: (err) => {
        speaking = false;
        onError?.(err);
      },
    });
  } catch (err) {
    speaking = false;
    onError?.(err);
  }
}

/**
 * Menghentikan pembacaan suara TTS yang sedang berjalan.
 */
export async function stopSpeaking(): Promise<void> {
  const Speech = getSpeechModule();
  speaking = false;
  if (!Speech) return;

  try {
    Speech.stop();
  } catch {
    // abaikan di lingkungan tanpa native speech
  }
}

/**
 * Mengecek apakah TTS sedang aktif berbicara.
 */
export async function isSpeaking(): Promise<boolean> {
  const Speech = getSpeechModule();
  if (!Speech) return speaking;

  try {
    return (await Speech.isSpeakingAsync()) || speaking;
  } catch {
    return speaking;
  }
}

/**
 * Format prompt suara proximity eyes-free standar sesuai PRD F04:
 * "Kamu mendekati [Nama Tenant]. Mau dengar ceritanya?"
 */
export function buildProximityPrompt(poiName: string): string {
  return `Kamu mendekati ${poiName}. Mau dengar ceritanya?`;
}

/**
 * Memutar prompt suara eyes-free saat pengguna memasuki radius proximity tenant.
 */
export async function speakProximityPrompt(
  poiName: string,
  options?: SpeakOptions,
): Promise<void> {
  const prompt = buildProximityPrompt(poiName);
  await speakText(prompt, options);
}

/**
 * Memutar pengumuman kedatangan tujuan ("Kamu sudah sampai!").
 */
export async function speakArrivalCue(
  poiName?: string,
  options?: SpeakOptions,
): Promise<void> {
  const text = poiName ? `Kamu sudah sampai di ${poiName}!` : 'Kamu sudah sampai!';
  await speakText(text, options);
}

/**
 * Memutar panduan navigasi berkala setiap pengurangan jarak (misal 20m).
 */
export async function speakNavigationCue(
  distanceM: number,
  directionText?: string,
  options?: SpeakOptions,
): Promise<void> {
  const dir = directionText ? ` di ${directionText}` : '';
  const text = `Tenant tujuan ${Math.round(distanceM)} meter lagi${dir}.`;
  await speakText(text, options);
}

export const TtsService = {
  speakText,
  stopSpeaking,
  isSpeaking,
  buildProximityPrompt,
  speakProximityPrompt,
  speakArrivalCue,
  speakNavigationCue,
};
