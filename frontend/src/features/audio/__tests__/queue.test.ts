import { announceArrival, ARRIVAL_NARRATION_DELAY_MS, AudioQueue } from '../queue';
import { pauseNarration, playNarration, resumeNarration, stopNarration } from '../index';
import { speakArrivalCue, speakText, stopSpeaking } from '../tts';

jest.mock('../index', () => ({
  playNarration: jest.fn(async (_poi, onFinish) => {
    // Simulasikan pemutaran asynchronous
    setTimeout(() => onFinish?.(), 10);
    return true;
  }),
  stopNarration: jest.fn(),
  pauseNarration: jest.fn(() => false),
  resumeNarration: jest.fn(),
}));

jest.mock('../tts', () => ({
  speakText: jest.fn(async (_text, opts) => {
    setTimeout(() => opts?.onDone?.(), 10);
  }),
  stopSpeaking: jest.fn(async () => {}),
  speakArrivalCue: jest.fn(async (_name, opts) => {
    setTimeout(() => opts?.onDone?.(), 10);
  }),
}));

describe('F04 AudioQueue Service', () => {
  beforeEach(async () => {
    await AudioQueue.stop();
    jest.clearAllMocks();
  });

  it('memutar item secara berurutan dan mengubah status isPlaying', async () => {
    const statuses: boolean[] = [];
    const unsubscribe = AudioQueue.subscribe((s) => {
      statuses.push(s.isPlaying);
    });

    await AudioQueue.enqueue({
      id: 'item-1',
      type: 'prompt',
      title: 'Prompt 1',
      text: 'Prompt text 1',
    });

    expect(AudioQueue.getStatus().currentItem?.id).toBe('item-1');
    expect(speakText).toHaveBeenCalledWith(
      'Prompt text 1',
      expect.objectContaining({ onDone: expect.any(Function) }),
    );

    unsubscribe();
  });

  it('memprioritaskan item high priority di atas item normal', async () => {
    // Mulai item normal
    await AudioQueue.enqueue({
      id: 'norm-1',
      type: 'prompt',
      title: 'Normal Item',
      text: 'Normal',
      priority: 'normal',
    });

    // Enqueue item high priority
    await AudioQueue.enqueue({
      id: 'high-1',
      type: 'narration',
      title: 'High Priority Narration',
      priority: 'high',
      poi: { id: 'P01', name: 'Batagor' } as any,
    });

    expect(stopSpeaking).toHaveBeenCalled();
    expect(stopNarration).toHaveBeenCalled();
    expect(AudioQueue.getStatus().currentItem?.id).toBe('high-1');
  });

  it('stop() menghentikan pemutaran dan mengosongkan antrean', async () => {
    await AudioQueue.enqueue({
      id: 'item-1',
      type: 'prompt',
      title: 'Prompt 1',
      text: 'Text 1',
    });
    await AudioQueue.enqueue({
      id: 'item-2',
      type: 'prompt',
      title: 'Prompt 2',
      text: 'Text 2',
    });

    expect(AudioQueue.getStatus().queue.length).toBe(1);

    await AudioQueue.stop();

    expect(AudioQueue.getStatus().isPlaying).toBe(false);
    expect(AudioQueue.getStatus().queue).toEqual([]);
    expect(stopSpeaking).toHaveBeenCalled();
    expect(stopNarration).toHaveBeenCalled();
  });

  it('skip() melanjutkan ke antrean berikutnya', async () => {
    await AudioQueue.enqueue({
      id: 'item-1',
      type: 'prompt',
      title: 'Prompt 1',
      text: 'Text 1',
    });
    await AudioQueue.enqueue({
      id: 'item-2',
      type: 'prompt',
      title: 'Prompt 2',
      text: 'Text 2',
    });

    await AudioQueue.skip();

    expect(AudioQueue.getStatus().currentItem?.id).toBe('item-2');
  });

  it('announceArrival: ucapan kedatangan dulu, narasi tujuan menyusul setelah jeda', async () => {
    jest.useFakeTimers();
    try {
      const poi = { id: 'P01', name: 'Baso Goreng Pandu', audio: null, culturalStory: '', description: '' };
      await announceArrival(poi as never);
      expect(speakArrivalCue).toHaveBeenCalledWith('Baso Goreng Pandu', expect.anything());

      jest.advanceTimersByTime(10);
      expect(playNarration).not.toHaveBeenCalled();

      jest.advanceTimersByTime(ARRIVAL_NARRATION_DELAY_MS);
      await Promise.resolve();
      expect(playNarration).toHaveBeenCalledWith(poi, expect.any(Function));
    } finally {
      await AudioQueue.stop();
      jest.useRealTimers();
    }
  });

  it('stop() membatalkan narasi yang masih menunggu jeda', async () => {
    jest.useFakeTimers();
    try {
      AudioQueue.enqueueAfter({ id: 'late', type: 'tts', title: 'x', text: 'x' }, 1000);
      await AudioQueue.stop();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(speakText).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('interruptWith: narasi rekaman dijeda selama instruksi lalu dilanjutkan', async () => {
    (pauseNarration as jest.Mock).mockReturnValueOnce(true);
    const speak = jest.fn(async (opts: { onDone?: () => void }) => opts.onDone?.());
    await AudioQueue.interruptWith(speak);
    expect(speak).toHaveBeenCalled();
    expect(resumeNarration).toHaveBeenCalledTimes(1);
  });

  it('interruptWith: narasi TTS dihentikan sebelum instruksi', async () => {
    (playNarration as jest.Mock).mockResolvedValueOnce(false);
    await AudioQueue.enqueue({ id: 'n1', type: 'narration', title: 'x', poi: { id: 'P01', name: 'x', audio: null, culturalStory: 'cerita', description: '' } as never });
    const speak = jest.fn(async () => {});
    await AudioQueue.interruptWith(speak);
    expect(stopSpeaking).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith({});
    expect(resumeNarration).not.toHaveBeenCalled();
  });

  it('clear() mengosongkan sisa antrean tanpa menghentikan item yang sedang berbunyi', async () => {
    await AudioQueue.enqueue({ id: 'c1', type: 'prompt', title: 'P1', text: 'Satu' });
    await AudioQueue.enqueue({ id: 'c2', type: 'prompt', title: 'P2', text: 'Dua' });
    expect(AudioQueue.getStatus().queue).toHaveLength(1);

    AudioQueue.clear();

    expect(AudioQueue.getStatus().isPlaying).toBe(true);
    expect(AudioQueue.getStatus().currentItem?.id).toBe('c1');
    expect(AudioQueue.getStatus().queue).toEqual([]);
  });

  it('item high priority kedua tidak memotong item high priority yang sedang diputar', async () => {
    await AudioQueue.enqueue({
      id: 'high-1',
      type: 'prompt',
      title: 'High 1',
      text: 'Satu',
      priority: 'high',
    });
    jest.clearAllMocks();

    await AudioQueue.enqueue({
      id: 'high-2',
      type: 'prompt',
      title: 'High 2',
      text: 'Dua',
      priority: 'high',
    });

    expect(stopSpeaking).not.toHaveBeenCalled();
    expect(AudioQueue.getStatus().currentItem?.id).toBe('high-1');
    expect(AudioQueue.getStatus().queue.map((q) => q.id)).toEqual(['high-2']);
  });
});
