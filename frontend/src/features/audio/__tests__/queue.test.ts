import { AudioQueue } from '../queue';
import { playNarration, stopNarration } from '../index';
import { speakText, stopSpeaking } from '../tts';

jest.mock('../index', () => ({
  playNarration: jest.fn(async (_poi, onFinish) => {
    // Simulasikan pemutaran asynchronous
    setTimeout(() => onFinish?.(), 10);
    return true;
  }),
  stopNarration: jest.fn(),
}));

jest.mock('../tts', () => ({
  speakText: jest.fn(async (_text, opts) => {
    setTimeout(() => opts?.onDone?.(), 10);
  }),
  stopSpeaking: jest.fn(async () => {}),
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
});
