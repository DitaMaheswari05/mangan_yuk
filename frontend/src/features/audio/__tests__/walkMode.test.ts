import type { Poi } from '@/types/content';
import { AudioQueue } from '../queue';
import { speakProximityPrompt } from '../tts';
import {
  handleProximityAudioTrigger,
  isWalkModeActive,
  isWalkModeActiveSync,
  setWalkModeActive,
  toggleWalkMode,
} from '../walkMode';

jest.mock('../queue', () => ({
  AudioQueue: {
    enqueue: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
  },
}));

jest.mock('../tts', () => ({
  speakProximityPrompt: jest.fn(async () => {}),
}));

jest.mock('@/storage', () => {
  let store: Record<string, unknown> = {};
  return {
    load: jest.fn(async (key: string, fallback: unknown) => store[key] ?? fallback),
    save: jest.fn(async (key: string, value: unknown) => {
      store[key] = value;
    }),
    __clearStore: () => {
      store = {};
    },
  };
});

const DUMMY_POI: Poi = {
  id: 'P01',
  name: 'Raja Pukis Modern',
  slug: 'raja-pukis-modern',
  type: 'jajanan',
  categoryLabel: 'Jajanan',
  tasteTags: ['manis'],
  isHalal: true,
  zone: 'Zone Entrance',
  latitude: -6.9181,
  longitude: 107.6002,
  triggerRadiusM: 25,
  avgVisitMin: 15,
  description: 'Pukis modern lembut',
  culturalStory: 'Cerita budaya pukis',
  photos: [],
  menu: [],
  openingHours: [{ day: 1, open: '16:00', close: '22:00' }],
  peakHours: [],
  searchKeywords: ['pukis'],
  qrCode: null,
  priceMinIdr: 10000,
  priceMaxIdr: 25000,
  priceBucket: '15to30k',
  audio: {
    assetKey: 'poi-audio/P01.mp3',
    durationSec: 60,
    transcript: 'Transkrip audio cerita pukis',
  },
};

describe('F04 Mode Jalan (Walk Mode) Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await setWalkModeActive(false);
  });

  it('default Mode Jalan adalah nonaktif', async () => {
    const active = await isWalkModeActive();
    expect(active).toBe(false);
    expect(isWalkModeActiveSync()).toBe(false);
  });

  it('dapat mengaktifkan dan melakukan toggle Mode Jalan', async () => {
    await setWalkModeActive(true);
    expect(await isWalkModeActive()).toBe(true);

    const toggled = await toggleWalkMode();
    expect(toggled).toBe(false);
    expect(await isWalkModeActive()).toBe(false);
  });

  it('saat Mode Jalan NONAKTIF, memutar prompt suara proximity ("Mau dengar ceritanya?")', async () => {
    await setWalkModeActive(false);

    const res = await handleProximityAudioTrigger(DUMMY_POI);

    expect(res).toEqual({ autoPlayed: false });
    expect(speakProximityPrompt).toHaveBeenCalledWith('Raja Pukis Modern');
    expect(AudioQueue.enqueue).not.toHaveBeenCalled();
  });

  it('saat Mode Jalan AKTIF, langsung memutar narasi POI otomatis (F04-AC2)', async () => {
    await setWalkModeActive(true);

    const res = await handleProximityAudioTrigger(DUMMY_POI);

    expect(res).toEqual({ autoPlayed: true });
    expect(AudioQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'narration',
        priority: 'high',
        poi: DUMMY_POI,
      }),
    );
    expect(speakProximityPrompt).not.toHaveBeenCalled();
  });
});
