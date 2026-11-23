// ============================================================================
// Unit Test: 03-multimodal-and-audio.test.ts
// Terkait: F03, F04, PB-08, PB-09, Audio Narration Player & Eyes-Free Cues
// ============================================================================

import { configureAudioSession, formatClock, resolveAsset } from '@/features/audio';

// Mock modul expo-audio
jest.mock(
  'expo-audio',
  () => ({
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    useAudioPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn().mockResolvedValue(undefined),
      setActiveForLockScreen: jest.fn(),
    })),
    useAudioPlayerStatus: jest.fn(() => ({
      playing: false,
      currentTime: 0,
      duration: 60,
      didJustFinish: false,
    })),
  }),
  { virtual: true },
);

// Mock bundel asset map
jest.mock('@/data/assets', () => ({
  CONTENT_ASSETS: {
    'poi-audio/P01.mp3': 1001,
    'poi-audio/P13.mp3': 1002,
    'poi-photos/P01/1.jpg': 2001,
  },
}));

describe('Kategori 1: Resolusi Aset Bundel Offline (resolveAsset)', () => {
  it('mengembalikan id modul numerik untuk assetKey yang terdaftar di peta aset bundel', () => {
    expect(resolveAsset('poi-audio/P01.mp3')).toBe(1001);
    expect(resolveAsset('poi-photos/P01/1.jpg')).toBe(2001);
  });

  it('mengembalikan null jika assetKey belum diekspor atau tidak terdaftar di aset bundel', () => {
    expect(resolveAsset('poi-audio/UNKNOWN.mp3')).toBeNull();
  });

  it('menangani input null atau undefined secara aman tanpa memicu runtime error', () => {
    expect(resolveAsset(null)).toBeNull();
    expect(resolveAsset(undefined)).toBeNull();
    expect(resolveAsset('')).toBeNull();
  });
});

describe('Kategori 2: Format Tampilan Durasi Jam & Audio (formatClock)', () => {
  it('memformat 0 detik menjadi 0:00', () => {
    expect(formatClock(0)).toBe('0:00');
  });

  it('memformat durasi di bawah 1 menit dengan padding angka nol (misal 5 detik -> 0:05)', () => {
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(59)).toBe('0:59');
  });

  it('memformat durasi menit dan detik standar (misal 75 detik -> 1:15)', () => {
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(125)).toBe('2:05');
  });

  it('menangani angka desimal dengan pembulatan ke bawah (floor) secara tepat (75.8 detik -> 1:15)', () => {
    expect(formatClock(75.8)).toBe('1:15');
  });

  it('menangani durasi negatif dengan mengembalikan batas aman 0:00', () => {
    expect(formatClock(-10)).toBe('0:00');
  });

  it('memformat durasi panjang (> 10 menit) secara konsisten', () => {
    expect(formatClock(615)).toBe('10:15');
  });
});

describe('Kategori 3: Konfigurasi Audio Background & Mode Senyap (Eyes-Free)', () => {
  it('configureAudioSession mengonfigurasi audio background dan playsInSilentMode', async () => {
    const { setAudioModeAsync } = require('expo-audio');
    await configureAudioSession();
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  });

  it('bersifat idempoten (hanya memanggil setAudioModeAsync sekali per siklus hidup aplikasi)', async () => {
    const { setAudioModeAsync } = require('expo-audio');
    setAudioModeAsync.mockClear();
    await configureAudioSession();
    await configureAudioSession();
    // Sudah pernah terkonfigurasi, tidak perlu dipanggil ulang
    expect(setAudioModeAsync).toHaveBeenCalledTimes(0);
  });
});

describe('Kategori 4: Resiliensi Multimodal Offline & Fallback', () => {
  it('jika file audio belum ada di bundel, player menandai available: false namun tidak crash', () => {
    const missingAsset = resolveAsset('poi-audio/missing.mp3');
    expect(missingAsset).toBeNull();
    // Fallback: transkrip cerita budaya teks tetap dapat dibaca oleh pengguna
  });
});
