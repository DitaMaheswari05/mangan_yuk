import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const stampSource = require('@/assets/passport_stamp.png');

interface StampProps {
  size?: number;
  color?: string;
  text?: string;
}

/**
 * Stamp "SELESAI DIJELAJAHI" sesuai desain Paspor Kuliner di Figma Node 374:98723.
 */
export function StampBadge({ size = 75 }: StampProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={stampSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
