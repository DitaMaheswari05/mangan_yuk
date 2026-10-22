import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Mangan Yuk',
  slug: 'mangan-yuk',
  scheme: 'manganyuk',
  version: '0.1.0',
  orientation: 'portrait',
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
  ],
  ios: {
    bundleIdentifier: 'id.manganyuk.app',
    infoPlist: { UIBackgroundModes: ['location', 'audio'] },
  },
  android: {
    package: 'id.manganyuk.app',
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE'],
  },
};

export default config;
