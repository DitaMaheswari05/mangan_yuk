// F04 – Audio Queueing Service untuk pemutaran audio berurutan tanpa tumpang tindih.
// Mengelola antrean narasi POI, prompt suara eyes-free, dan instruksi navigasi secara teratur.

import type { Poi } from '@/types/content';
import { pauseNarration, playNarration, resumeNarration, stopNarration } from './index';
import { speakArrivalCue, speakText, stopSpeaking, type SpeakOptions } from './tts';

// Jeda antara "Kamu sudah sampai" dan narasi tenant tujuan.
export const ARRIVAL_NARRATION_DELAY_MS = 2000;

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
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
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

  /** Seperti enqueue, tapi setelah jeda. Dibatalkan oleh stop(). */
  public enqueueAfter(item: AudioQueueItem, delayMs: number): void {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      void this.enqueue(item);
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  /**
   * Instruksi navigasi didahulukan: narasi rekaman dijeda lalu dilanjutkan setelahnya.
   * Narasi TTS tidak bisa dilanjutkan dari tengah, jadi dihentikan.
   */
  public async interruptWith(speak: (options: SpeakOptions) => Promise<void>): Promise<void> {
    if (pauseNarration()) {
      await speak({ onDone: resumeNarration, onStopped: resumeNarration, onError: resumeNarration });
      return;
    }
    if (this.currentItem?.type === 'narration') await this.stopCurrent();
    await speak({});
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
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers.clear();
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

/**
 * Kedatangan di tujuan: hentikan audio lain, ucapkan "Kamu sudah sampai", lalu narasi tenant
 * menyusul setelah ARRIVAL_NARRATION_DELAY_MS.
 */
export async function announceArrival(
  poi: NonNullable<AudioQueueItem['poi']>,
): Promise<void> {
  await AudioQueue.stop();
  const narrateLater = () =>
    AudioQueue.enqueueAfter(
      { id: `narration-${poi.id}-${Date.now()}`, type: 'narration', title: poi.name, priority: 'high', poi },
      ARRIVAL_NARRATION_DELAY_MS,
    );
  await speakArrivalCue(poi.name, { onDone: narrateLater, onError: narrateLater });
}
