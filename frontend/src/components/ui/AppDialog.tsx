import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/constants/theme';

export type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AppDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  buttons?: DialogButton[];
  onDismiss?: () => void;
};

export function AppDialog({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK' }],
  onDismiss,
}: AppDialogProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: '#FFFFFF' };
      case 'warning':
        return { name: 'warning' as const, color: '#FFFFFF' };
      case 'error':
        return { name: 'alert-circle' as const, color: '#FFFFFF' };
      case 'info':
      default:
        return { name: 'information-circle' as const, color: '#FFFFFF' };
    }
  };

  const iconInfo = getIcon();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {onDismiss && (
            <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}

          {/* Icon Header */}
          <View style={styles.iconContainer}>
            <Ionicons name={iconInfo.name} size={36} color={iconInfo.color} />
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonRow,
              buttons.length > 2 && { flexDirection: 'column' },
            ]}
          >
            {buttons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              return (
                <Pressable
                  key={`${btn.text}-${idx}`}
                  style={[
                    styles.button,
                    isCancel ? styles.buttonCancel : styles.buttonPrimary,
                    isDestructive && styles.buttonDestructive,
                  ]}
                  onPress={() => {
                    if (btn.onPress) {
                      btn.onPress();
                    } else if (onDismiss) {
                      onDismiss();
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? styles.buttonTextCancel
                        : isDestructive
                          ? styles.buttonTextDestructive
                          : styles.buttonTextPrimary,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FF8316',
    borderRadius: 28,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
    zIndex: 10,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.95,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#FFFFFF',
  },
  buttonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  buttonDestructive: {
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  buttonTextPrimary: {
    color: '#FF8316',
  },
  buttonTextCancel: {
    color: '#FFFFFF',
  },
  buttonTextDestructive: {
    color: '#D32F2F',
  },
});
