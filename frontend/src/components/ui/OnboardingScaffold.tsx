import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '@/constants/theme';

export type OnboardingScaffoldProps = {
  /** Indeks langkah aktif (1..4) untuk indikator progres di bagian atas */
  stepIndex: 1 | 2 | 3 | 4;
  totalSteps?: number;
  badgeText?: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  illustration?: ImageSourcePropType;
  illustrationVariant?: 'warm' | 'error' | 'tertiary' | 'secondary';
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  children?: React.ReactNode;
};

export function OnboardingScaffold({
  stepIndex,
  totalSteps = 4,
  badgeText,
  title,
  titleAccent,
  subtitle,
  illustration,
  illustrationVariant = 'warm',
  onBack,
  onSkip,
  primaryLabel,
  onPrimaryPress,
  primaryLoading = false,
  secondaryLabel,
  onSecondaryPress,
  children,
}: OnboardingScaffoldProps) {
  const heroBorder =
    illustrationVariant === 'error'
      ? colors.error
      : illustrationVariant === 'tertiary'
        ? colors.tertiaryContainer
        : illustrationVariant === 'secondary'
          ? colors.secondaryContainer
          : colors.outlineVariant;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Bar: Back + Step Indicator + Skip */}
        <View style={styles.topBar}>
          <View style={styles.topBarSide}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Kembali"
              >
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Kembali</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.progressRow} accessibilityLabel={`Langkah ${stepIndex} dari ${totalSteps}`}>
            {Array.from({ length: totalSteps }).map((_, idx) => {
              const active = idx + 1 === stepIndex;
              const passed = idx + 1 < stepIndex;
              return (
                <View
                  key={idx}
                  style={[
                    styles.progressDot,
                    active && styles.progressDotActive,
                    passed && styles.progressDotPassed,
                  ]}
                />
              );
            })}
          </View>

          <View style={[styles.topBarSide, styles.topBarSideRight]}>
            {onSkip ? (
              <Pressable
                onPress={onSkip}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Lewati"
              >
                <Text style={styles.skipText}>Lewati</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section (Referensi Figma: Sub-headline & Subtitle) */}
          <View style={styles.headerBlock}>
            {badgeText ? (
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{badgeText}</Text>
              </View>
            ) : null}
            <Text style={styles.title}>
              {title}
              {titleAccent ? (
                <Text style={styles.titleAccent}>
                  {title.endsWith('\n') ? '' : ' '}
                  {titleAccent}
                </Text>
              ) : null}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Hero Illustration Card (Aset dari Figma file) */}
          {illustration ? (
            <View
              style={[
                styles.illustrationCard,
                {},
              ]}
            >
              <Image source={illustration} style={styles.illustrationImage} resizeMode="contain" />
            </View>
          ) : null}

          {/* Body / Placeholder Content */}
          {children ? <View style={styles.bodyContent}>{children}</View> : null}
        </ScrollView>

        {/* Bottom Sticky CTA (Referensi Figma: Pill Button radius 30px) */}
        <View style={styles.footer}>
          <Pressable
            onPress={onPrimaryPress}
            disabled={primaryLoading}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || primaryLoading) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            <Text style={styles.primaryButtonText}>
              {primaryLoading ? 'Memproses...' : primaryLabel}
            </Text>
            {!primaryLoading ? <Text style={styles.primaryButtonArrow}>→</Text> : null}
          </Pressable>

          {secondaryLabel && onSecondaryPress ? (
            <Pressable
              onPress={onSecondaryPress}
              disabled={primaryLoading}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}
            >
              <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 48,
  },
  topBarSide: {
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarSideRight: {
    justifyContent: 'flex-end',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backArrow: {
    ...typography.textMdMedium,
    color: colors.onSurface,
  },
  backText: {
    ...typography.textSmRegular,
    color: colors.onSurface,
  },
  skipText: {
    ...typography.textSmRegular,
    color: colors.onSurface,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 100,
    backgroundColor: colors.surfaceVariant,
  },
  progressDotPassed: {
    backgroundColor: colors.primaryFixedDim,
    width: 14,
  },
  progressDotActive: {
    width: 28,
    backgroundColor: colors.primaryContainer,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 20,
  },
  headerBlock: {
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 2,
  },
  badgePillText: {
    ...typography.textXsSemibold,
    color: colors.primary,
  },
  title: {
    ...typography.subHeadline32,
    fontSize: 28,
    lineHeight: 34,
    color: colors.onSurface,
    textAlign: 'center',
  },
  titleAccent: {
    color: colors.primaryContainer,
  },
  subtitle: {
    ...typography.textSmRegular,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 333,
  },
  illustrationCard: {
    alignSelf: 'stretch',
    height: 250,
    borderRadius: 24,
    // borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  illustrationImage: {
    width: 280,
    height: 300,
  },
  bodyContent: {
    gap: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
    backgroundColor: colors.background,
  },
  primaryButton: {
    height: 48,
    borderRadius: 30,
    backgroundColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    ...typography.textMdSemibold,
    color: colors.onPrimary,
  },
  primaryButtonArrow: {
    ...typography.textLgSemibold,
    color: colors.onPrimary,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 30,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    ...typography.textSmSemibold,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.82,
  },
});
