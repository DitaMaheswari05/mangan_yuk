import { create } from 'zustand';
import {
  AppStateRepository,
  DEFAULT_PERMISSION_SNAPSHOT,
  DEFAULT_USER_PREFERENCES,
  PreferenceRepository,
  type OnboardingStep,
  type PermissionSnapshot,
  type UserPreferences,
} from '@/features/onboarding';

type AppState = {
  hydrated: boolean;
  onboarded: boolean;
  onboardingStep: OnboardingStep;
  permissions: PermissionSnapshot;
  preferences: UserPreferences;
  setOnboarded: (v: boolean) => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  setPermissions: (p: Partial<Omit<PermissionSnapshot, 'updatedAt'>>) => void;
  setPreferences: (p: UserPreferences) => void;
  hydrate: () => Promise<void>;
};

export const useAppStore = create<AppState>((set) => ({
  hydrated: false,
  onboarded: false,
  onboardingStep: 'intro',
  permissions: DEFAULT_PERMISSION_SNAPSHOT,
  preferences: DEFAULT_USER_PREFERENCES,
  setOnboarded: (onboarded) => set({ onboarded }),
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  setPermissions: (p) =>
    set((s) => ({
      permissions: {
        ...s.permissions,
        ...p,
        updatedAt: new Date().toISOString(),
      },
    })),
  setPreferences: (preferences) => set({ preferences }),
  hydrate: async () => {
    const [obRes, permRes, prefRes] = await Promise.all([
      AppStateRepository.getOnboarding(),
      AppStateRepository.getPermissions(),
      PreferenceRepository.get(),
    ]);
    set({
      hydrated: true,
      onboarded: obRes.ok ? obRes.data.completed : false,
      onboardingStep: obRes.ok ? obRes.data.step : 'intro',
      permissions: permRes.ok ? permRes.data : DEFAULT_PERMISSION_SNAPSHOT,
      preferences: prefRes.ok ? prefRes.data : DEFAULT_USER_PREFERENCES,
    });
  },
}));
