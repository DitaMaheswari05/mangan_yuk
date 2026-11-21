import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface StampProps {
  size?: number;
  color?: string;
  text?: string;
}

/**
 * Stamp "SELESAI DIJELAJAHI" sesuai desain Paspor Kuliner di Figma.
 */
export function StampBadge({
  size = 75,
  color = '#E66B00',
  text = 'SELESAI DIJELAJAHI',
}: StampProps) {
  const outerBorder = Math.max(1.5, Math.round(size * 0.025));
  const innerBorder = Math.max(0.8, Math.round(size * 0.012));
  const fontSize = Math.max(6, Math.round(size * 0.075));

  return (
    <View
      style={[
        styles.outerCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: outerBorder,
        },
      ]}
    >
      {/* Lingkaran Tipis Kedua */}
      <View
        style={[
          styles.innerCircle,
          {
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
            borderColor: color,
            borderWidth: innerBorder,
          },
        ]}
      >
        {/* Teks Melingkar Atas */}
        <Text
          style={[
            styles.curvedTextTop,
            { color, fontSize, letterSpacing: size > 90 ? 2 : 1 },
          ]}
          numberOfLines={1}
        >
          {text}
        </Text>

        {/* Lingkaran Pusat dengan Ceklis & Bintang */}
        <View
          style={[
            styles.centerBadge,
            {
              width: size * 0.52,
              height: size * 0.52,
              borderRadius: (size * 0.52) / 2,
              borderColor: color,
              borderWidth: innerBorder * 1.5,
            },
          ]}
        >
          <Svg width={size * 0.38} height={size * 0.38} viewBox="0 0 40 40">
            {/* Ikon Bintang Atas */}
            <Path
              d="M 20,4 L 22,10 L 28,10 L 23,14 L 25,20 L 20,16 L 15,20 L 17,14 L 12,10 L 18,10 Z"
              fill={color}
            />
            {/* Ikon Centang (Checkmark) Sukses */}
            <Path
              d="M 12,23 L 18,29 L 29,17"
              fill="none"
              stroke={color}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        {/* Teks Bawah */}
        <Text
          style={[
            styles.curvedTextBottom,
            { color, fontSize, letterSpacing: size > 90 ? 2 : 1 },
          ]}
          numberOfLines={1}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  curvedTextTop: {
    position: 'absolute',
    top: 2,
    fontWeight: '800',
    textAlign: 'center',
  },
  curvedTextBottom: {
    position: 'absolute',
    bottom: 2,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
