import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '@/constants/theme';
import { formatClock, useNarration } from '@/features/audio';
import type { Poi } from '@/types/content';

const ACCENT = '#FF8316';
const SKIP_SEC = 10;

export type NarrationPlayerProps = {
  poi: Pick<Poi, 'name' | 'audio'>;
  /** Tampilkan tombol mundur/maju 10 detik. */
  showSkip?: boolean;
};

/** F03 / PB08: play, pause, seek (ketuk bilah progres), mundur/maju 10 detik. */
export function NarrationPlayer({ poi, showSkip = false }: NarrationPlayerProps) {
  const { available, playing, positionSec, durationSec, toggle, seekTo, seekBy } = useNarration(poi);
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = durationSec > 0 ? Math.min(1, positionSec / durationSec) : 0;

  if (!available) {
    return (
      <View style={[styles.bar, styles.barDisabled]} accessibilityRole="text">
        <Ionicons name="volume-mute-outline" size={22} color="#9A9A9A" />
        <Text style={styles.unavailableText}>Audio cerita belum tersedia untuk tenant ini</Text>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      {showSkip ? (
        <Pressable
          onPress={() => seekBy(-SKIP_SEC)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Mundur ${SKIP_SEC} detik`}
        >
          <Ionicons name="play-back" size={20} color={ACCENT} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Jeda cerita audio' : 'Putar cerita audio'}
      >
        <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={36} color={ACCENT} />
      </Pressable>

      {showSkip ? (
        <Pressable
          onPress={() => seekBy(SKIP_SEC)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Maju ${SKIP_SEC} detik`}
        >
          <Ionicons name="play-forward" size={20} color={ACCENT} />
        </Pressable>
      ) : null}

      <Pressable
        style={styles.trackHitArea}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (trackWidth > 0) seekTo((e.nativeEvent.locationX / trackWidth) * durationSec);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Posisi audio"
        accessibilityValue={{ min: 0, max: Math.round(durationSec), now: Math.round(positionSec) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => seekBy(e.nativeEvent.actionName === 'increment' ? SKIP_SEC : -SKIP_SEC)}
      >
        <View style={styles.trackBg}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
      </Pressable>

      <Text style={styles.time}>
        {formatClock(positionSec)} / {formatClock(durationSec)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF4EA',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  barDisabled: {
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  unavailableText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
  },
  trackHitArea: {
    flex: 1,
    paddingVertical: 10,
  },
  trackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD7B5',
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  time: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#5A4136',
    minWidth: 64,
    textAlign: 'right',
  },
});
