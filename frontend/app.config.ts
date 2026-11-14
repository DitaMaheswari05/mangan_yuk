import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Mangan Yuk',
  slug: 'mangan-yuk',
  scheme: 'manganyuk',
  version: '0.1.0',
  orientation: 'portrait',
  owner: 'ditmahes',
  extra: { eas: { projectId: '1e36eaeb-ae38-4396-8040-bc2814a81b33' } },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Mangan Yuk memakai lokasi untuk memberi tahu saat kamu dekat tempat kuliner.',
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    'expo-notifications',
    [
      'expo-audio',
      { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: true },
    ],
    '@maplibre/maplibre-react-native',
  ],
  ios: {
    bundleIdentifier: 'id.manganyuk.app',
    infoPlist: { UIBackgroundModes: ['location', 'audio'] },
  },
  android: {
    package: 'id.manganyuk.app',
    // FOREGROUND_SERVICE_LOCATION wajib di Android 14+ agar foreground service Mode Jelajah tidak dimatikan.
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'VIBRATE',
    ],
  },
};

export default config;
