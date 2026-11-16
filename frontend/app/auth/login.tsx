import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/constants/theme';
import { AuthService } from '@/features/auth';
import { useAppStore } from '@/store/useAppStore';
import { AppDialog, type DialogButton } from '@/components/ui/AppDialog';

const authIllustration = require('../../assets/images/person.png');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // Custom Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttons?: DialogButton[];
  }>({
    visible: false,
    title: '',
  });

  const showPopup = (
    title: string,
    message?: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    buttons?: DialogButton[],
  ) => {
    setDialogConfig({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [
        {
          text: 'Mengerti',
          onPress: () => setDialogConfig((prev) => ({ ...prev, visible: false })),
        },
      ],
    });
  };

  const closePopup = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  const setUser = useAppStore((s) => s.setUser);
  const onboarded = useAppStore((s) => s.onboarded);

  useEffect(() => {
    (async () => {
      const savedEmail = await AuthService.getSavedEmail();
      if (savedEmail) {
        setEmail(savedEmail);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) {
      showPopup('Perhatian', 'Silakan masukkan email Anda.', 'warning');
      return;
    }
    if (!password) {
      showPopup('Perhatian', 'Silakan masukkan kata sandi Anda.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const session = await AuthService.login({
        email: email.trim(),
        password,
        rememberMe,
      });
      setUser(session.user);
      showPopup(
        'Selamat Datang!',
        `Senang melihatmu kembali, ${session.user.displayName}. Siap menjelajah kuliner?`,
        'success',
        [
          {
            text: 'Mulai Jelajah',
            onPress: () => {
              closePopup();
              if (onboarded) {
                router.replace('/(tabs)');
              } else {
                router.replace('/onboarding/welcome');
              }
            },
          },
        ],
      );
    } catch {
      showPopup('Gagal Masuk', 'Terjadi kesalahan saat masuk. Silakan coba lagi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    showPopup(
      'Lupa Kata Sandi',
      'Fitur pemulihan kata sandi melalui email akan tersedia pada pembaruan mendatang.',
      'info',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Title */}
          <Text style={styles.headerTitle}>Selamat Datang di ManganYuk!</Text>
          <Text style={styles.headerSubtitle}>Masuk dan lanjutkan petualangan kulinermu</Text>

          {/* Illustration */}
          <View>
            <Image
              source={authIllustration}
              style={[styles.illustration, { width: 160, height: 160 }]}
              resizeMode="contain"
            />
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Sharon@gmail.com"
                  placeholderTextColor="#6C7278"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kata Sandi</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor="#6C7278"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6C7278"
                  />
                </Pressable>
              </View>
            </View>

            {/* Remember & Forgot Password Link */}
            <View style={styles.linkRow}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe((prev) => !prev)}
              >
                <Ionicons
                  name={rememberMe ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={rememberMe ? '#FF8316' : '#6C7278'}
                />
                <Text style={styles.rememberText}>Ingat saya</Text>
              </Pressable>

              <Pressable onPress={handleForgotPassword} hitSlop={6}>
                <Text style={styles.forgotText}>Lupa kata sandi?</Text>
              </Pressable>
            </View>
          </View>

          {/* Primary Action Button */}
          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Masuk</Text>
            )}
          </Pressable>

          {/* Divider & Switch to Register */}
          <View style={styles.switchRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.switchText}>
              Belum punya akun?{' '}
              <Text
                style={styles.switchAccent}
                onPress={() => router.push('/auth/register')}
              >
                Daftar
              </Text>
            </Text>
            <View style={styles.dividerLine} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ManganYuk Branded Orange Pop-up Dialog */}
      <AppDialog
        visible={dialogConfig.visible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        buttons={dialogConfig.buttons}
        onDismiss={closePopup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 22,
    lineHeight: 32,
    color: '#404040',
    textAlign: 'center',
    marginTop: 8,
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#808080',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  illustration: {
    width: 120,
    height: 120,
  },
  formContainer: {
    width: '100%',
    gap: 14,
  },
  inputGroup: {
    width: '100%',
    gap: 6,
  },
  inputLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#6C7278',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.1,
    borderColor: '#EDF1F3',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#E4E5E7',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: '#1A1C1E',
    textAlignVertical: 'center',
    paddingVertical: 0,
    marginVertical: 0,
    includeFontPadding: false,
  },
  eyeButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rememberText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#6C7278',
  },
  forgotText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#FF8316',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FF8316',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDF1F3',
  },
  switchText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#6C7278',
  },
  switchAccent: {
    color: '#FF8316',
    fontFamily: fontFamily.medium,
  },
});
