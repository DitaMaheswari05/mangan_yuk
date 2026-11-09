import { TextStyle } from 'react-native';

/**
 * Mangan Yuk Design Tokens
 * Sumber: docs/design/manganyuk-color-tokens.json & docs/design/manganyuk-typography-tokens.json
 */

export const colors = {
  // Neutral & Surface
  surface: '#fcf9f8',
  surfaceDim: '#dcd9d9',
  surfaceBright: '#fcf9f8',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainer: '#f0eded',
  surfaceContainerHigh: '#eae7e7',
  surfaceContainerHighest: '#e5e2e1',
  surfaceVariant: '#e5e2e1',
  background: '#fcf9f8',
  onSurface: '#1b1b1c',
  onBackground: '#1b1b1c',
  inverseSurface: '#303030',
  inverseOnSurface: '#f3f0ef',

  // Primary (Orange & Brown - Identitas Utama Kuliner)
  primary: '#a14000',
  primaryContainer: '#ff6a00',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#571f00',
  inversePrimary: '#ffb694',
  primaryFixed: '#ffdbcc',
  primaryFixedDim: '#ffb694',
  onPrimaryFixed: '#351000',
  onPrimaryFixedVariant: '#7b2f00',
  surfaceTint: '#a14000',
  outline: '#8e7164',
  outlineVariant: '#e2bfb0',
  onSurfaceVariant: '#5a4136',

  // Secondary (Yellow / Gold - Paspor Kuliner & Reward)
  secondary: '#785a00',
  secondaryContainer: '#fec73a',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#705400',
  secondaryFixed: '#ffdf9b',
  secondaryFixedDim: '#f5bf31',
  onSecondaryFixed: '#251a00',
  onSecondaryFixedVariant: '#5b4300',

  // Tertiary (Blue - Rute Navigasi & Audio Narasi)
  tertiary: '#065cbb',
  tertiaryContainer: '#5d98fb',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#002f68',
  tertiaryFixed: '#d7e2ff',
  tertiaryFixedDim: '#acc7ff',
  onTertiaryFixed: '#001b40',
  onTertiaryFixedVariant: '#004590',

  // Red & Pink (Error & Geofence Alert)
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',
} as const;

export type ColorToken = keyof typeof colors;

export const fontFamily = {
  primary: 'Chiron GoRound TC',
  regular: 'ChironGoRoundTC-Regular',
  medium: 'ChironGoRoundTC-Medium',
  semibold: 'ChironGoRoundTC-SemiBold',
  bold: 'ChironGoRoundTC-Bold',
} as const;

export const typography: Record<string, TextStyle> = {
  // Headlines (700 Bold)
  headline72: {
    fontFamily: fontFamily.bold,
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: 0,
  },
  headline64: {
    fontFamily: fontFamily.bold,
    fontSize: 64,
    lineHeight: 72,
    letterSpacing: 0,
  },
  headline56: {
    fontFamily: fontFamily.bold,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: 0,
  },
  headline48: {
    fontFamily: fontFamily.bold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 0,
  },
  headline40: {
    fontFamily: fontFamily.bold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 0,
  },
  headline32: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  },

  // Sub-headlines (600 SemiBold)
  subHeadline72: {
    fontFamily: fontFamily.semibold,
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: 0,
  },
  subHeadline64: {
    fontFamily: fontFamily.semibold,
    fontSize: 64,
    lineHeight: 72,
    letterSpacing: 0,
  },
  subHeadline56: {
    fontFamily: fontFamily.semibold,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: 0,
  },
  subHeadline48: {
    fontFamily: fontFamily.semibold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 0,
  },
  subHeadline40: {
    fontFamily: fontFamily.semibold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 0,
  },
  subHeadline32: {
    fontFamily: fontFamily.semibold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  },

  // Body Text - LG (18px)
  textLgRegular: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0,
  },
  textLgMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0,
  },
  textLgSemibold: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0,
  },
  textLgBold: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0,
  },

  // Body Text - MD (16px)
  textMdRegular: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  textMdMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  textMdSemibold: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  textMdBold: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },

  // Body Text - SM (14px)
  textSmRegular: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  textSmMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  textSmSemibold: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  textSmBold: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },

  // Body Text - XS (12px)
  textXsRegular: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  textXsMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  textXsSemibold: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  textXsBold: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
};
