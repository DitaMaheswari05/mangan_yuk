// F04 – Audio Queueing Service untuk pemutaran audio berurutan tanpa tumpang tindih.
// Mengelola antrean narasi POI, prompt suara eyes-free, dan instruksi navigasi secara teratur.

import type { Poi } from '@/types/content';
import { playNarration, stopNarration } from './index';
import { speakText, stopSpeaking } from './tts';

export type QueueItemType = 'narration' | 'prompt' | 'navigation' | 'tts';

export type AudioQueueItem = {
  id: string;
  type: QueueItemType;
  title: string;
  priority?: 'normal' | 'high';
  poi?: Pick<Poi, 'id' | 'name' | 'audio' | 'culturalStory' | 'description'>;
  text?: string;
};

export type AudioQueueStatus = {
  isPlaying: boolean;
  currentItem: AudioQueueItem | null;
  queue: AudioQueueItem[];
};

type QueueListener = (status: AudioQueueStatus) => void;

class AudioQueueService {
  private queue: AudioQueueItem[] = [];
  private currentItem: AudioQueueItem | null = null;
  private isProcessing = false;
  private listeners = new Set<QueueListener>();

  public getStatus(): AudioQueueStatus {
    return {
      isPlaying: this.currentItem !== null,
      currentItem: this.currentItem,
      queue: [...this.queue],
    };
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(status);
      } catch {
        // abaikan listener yang error
      }
    });
  }

  /**
   * Menambahkan item ke antrean audio.
   * Jika priority 'high' dan ada audio 'normal' yang sedang jalan, audio lama dihentikan
   * dan item prioritas langsung diputar.
   */
  public async enqueue(item: AudioQueueItem): Promise<void> {
    if (item.priority === 'high') {
      if (this.currentItem && this.currentItem.priority !== 'high') {
        // Hentikan pemutaran item normal yang sedang aktif untuk mengutamakan item high
        await this.stopCurrent();
        this.queue.unshift(item);
      } else {
        // Sisipkan di posisi depan antrean
        this.queue.unshift(item);
      }
    } else {
      this.queue.push(item);
    }

    this.notify();
    await this.processQueue();
  }

  /**
   * Menghentikan item yang sedang aktif tanpa menghapus sisa antrean.
   */
  private async stopCurrent(): Promise<void> {
    this.isProcessing = false;
    stopNarration();
    await stopSpeaking();
    this.currentItem = null;
    this.notify();
  }

  /**
   * Lewati item yang sedang diputar dan lanjut ke antrean berikutnya.
   */
  public async skip(): Promise<void> {
    await this.stopCurrent();
    await this.processQueue();
  }

  /**
   * Menghentikan semua pemutaran dan mengosongkan seluruh antrean.
   */
  public async stop(): Promise<void> {
    this.queue = [];
    await this.stopCurrent();
  }

  /**
   * Mengosongkan sisa antrean tanpa menghentikan yang sedang berbunyi.
   */
  public clear(): void {
    this.queue = [];
    this.notify();
  }

  /**
   * Memproses antrean satu per satu secara berurutan.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.currentItem !== null) return;
    if (this.queue.length === 0) {
      this.notify();
      return;
    }

    const nextItem = this.queue.shift()!;
    this.currentItem = nextItem;
    this.isProcessing = true;
    this.notify();

    const onFinish = () => {
      this.currentItem = null;
      this.isProcessing = false;
      this.notify();
      void this.processQueue();
    };

    try {
      if (nextItem.type === 'narration' && nextItem.poi) {
        const poi = nextItem.poi;
        // Coba putar file audio rekaman
        const started = await playNarration(poi, onFinish);
        if (!started) {
          // Fallback TTS jika file rekaman audio POI belum tersedia di bundel
          const ttsText =
            poi.culturalStory ||
            poi.description ||
            `Berikut adalah cerita kuliner untuk ${poi.name}.`;
          await speakText(ttsText, {
            onDone: onFinish,
            onStopped: onFinish,
            onError: onFinish,
          });
        }
      } else if (nextItem.text) {
        // Tipe prompt / navigation / tts
        await speakText(nextItem.text, {
          onDone: onFinish,
          onStopped: onFinish,
          onError: onFinish,
        });
      } else {
        onFinish();
      }
    } catch {
      onFinish();
    }
  }
}

export const AudioQueue = new AudioQueueService();
