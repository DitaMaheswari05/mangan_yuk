// Global Jest mocks untuk modul-modul native Expo

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
    seekTo: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setActiveForLockScreen: jest.fn(),
    clearLockScreenControls: jest.fn(),
  })),
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    setActiveForLockScreen: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    currentTime: 0,
    duration: 60,
    didJustFinish: false,
  })),
}));
jest.mock(
  'expo-speech',
  () => ({
    speak: jest.fn((text, opts) => opts?.onDone?.()),
    stop: jest.fn(),
    isSpeakingAsync: jest.fn(async () => false),
  }),
  { virtual: true }
);
