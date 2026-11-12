import * as Speech from 'expo-speech';
import {
  buildProximityPrompt,
  speakArrivalCue,
  speakNavigationCue,
  speakProximityPrompt,
  speakText,
  stopSpeaking,
} from '../tts';

jest.mock('expo-speech', () => ({
  speak: jest.fn((text, opts) => {
    opts?.onDone?.();
  }),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(async () => false),
}));

describe('F04 Text-to-Speech (TTS) Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('memformat prompt proximity sesuai PRD F04', () => {
    const prompt = buildProximityPrompt('Baso Goreng Pandu');
    expect(prompt).toBe('Kamu mendekati Baso Goreng Pandu. Mau dengar ceritanya?');
  });

  it('memanggil Speech.speak dengan bahasa default id-ID', async () => {
    const onDone = jest.fn();
    await speakText('Halo Sudirman Street Food', { onDone });

    expect(Speech.speak).toHaveBeenCalledWith(
      'Halo Sudirman Street Food',
      expect.objectContaining({
        language: 'id-ID',
      }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('speakProximityPrompt memutar prompt suara proximity tenant', async () => {
    await speakProximityPrompt('Raja Pukis Modern');

    expect(Speech.speak).toHaveBeenCalledWith(
      'Kamu mendekati Raja Pukis Modern. Mau dengar ceritanya?',
      expect.objectContaining({ language: 'id-ID' }),
    );
  });

  it('speakArrivalCue memutar instruksi kedatangan di tenant tujuan', async () => {
    await speakArrivalCue('King Crab Bandung');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Kamu sudah sampai di King Crab Bandung!',
      expect.objectContaining({ language: 'id-ID' }),
    );

    await speakArrivalCue();
    expect(Speech.speak).toHaveBeenCalledWith(
      'Kamu sudah sampai!',
      expect.objectContaining({ language: 'id-ID' }),
    );
  });

  it('speakNavigationCue memutar panduan jarak navigasi berkala', async () => {
    await speakNavigationCue(20, 'sebelah kanan');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Tenant tujuan 20 meter lagi di sebelah kanan.',
      expect.objectContaining({ language: 'id-ID' }),
    );
  });

  it('stopSpeaking menghentikan modul TTS', async () => {
    await stopSpeaking();
    expect(Speech.stop).toHaveBeenCalled();
  });
});
