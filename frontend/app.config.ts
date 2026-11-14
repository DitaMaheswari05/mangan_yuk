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
        locationWhenInUsePermission:
          'Mangan Yuk memakai lokasi untuk menampilkan posisimu di peta dan memandu rute ke tenant kuliner.',
        locationAlwaysAndWhenInUsePermission:
          'Mangan Yuk memakai lokasi untuk memandu dan memberi tahu saat kamu dekat tenant kuliner, termasuk saat Mode Jelajah aktif.',
        locationAlwaysPermission:
          'Mangan Yuk membutuhkan akses lokasi latar belakang hanya saat fitur Mode Jelajah diaktifkan untuk memutar narasi kuliner secara otomatis.',
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    'expo-notifications',
    [
      'expo-audio',
      { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: true },
    ],
    '@maplibre/maplibre-react-native',
    [
      'expo-build-properties',
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    './plugins/withNetworkSecurityConfig',
  ],
  ios: {
    bundleIdentifier: 'id.manganyuk.app',
    infoPlist: {
      UIBackgroundModes: ['location', 'audio'],
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
      },
    },
  },
  android: {
    package: 'id.manganyuk.app',
    allowBackup: false,
    // FOREGROUND_SERVICE_LOCATION wajib di Android 14+ agar foreground service Mode Jelajah tidak dimatikan.
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'VIBRATE',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_PHONE_STATE',
    ],
  },
};

export default config;
