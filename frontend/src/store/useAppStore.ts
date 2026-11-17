import { create } from 'zustand';
import { WalkModeService } from '@/features/audio';
import { AuthService, type AuthUser } from '@/features/auth';
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
  user: AuthUser | null;
  permissions: PermissionSnapshot;
  preferences: UserPreferences;
  walkMode: boolean;
  setUser: (user: AuthUser | null) => void;
  setOnboarded: (v: boolean) => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  setPermissions: (p: Partial<Omit<PermissionSnapshot, 'updatedAt'>>) => void;
  setPreferences: (p: UserPreferences) => void;
  setWalkMode: (v: boolean) => void;
  toggleWalkMode: () => void;
  hydrate: () => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  onboarded: false,
  onboardingStep: 'intro',
  user: null,
  permissions: DEFAULT_PERMISSION_SNAPSHOT,
  preferences: DEFAULT_USER_PREFERENCES,
  walkMode: false,
  setUser: (user) => set({ user }),
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
  setWalkMode: (walkMode) => {
    set({ walkMode });
    void WalkModeService.setWalkModeActive(walkMode);
  },
  toggleWalkMode: () => {
    const next = !get().walkMode;
    set({ walkMode: next });
    void WalkModeService.setWalkModeActive(next);
  },
  hydrate: async () => {
    const [obRes, permRes, prefRes, walkModeActive, session] = await Promise.all([
      AppStateRepository.getOnboarding(),
      AppStateRepository.getPermissions(),
      PreferenceRepository.get(),
      WalkModeService.hydrateWalkMode(),
      AuthService.getStoredSession(),
    ]);
    set({
      hydrated: true,
      onboarded: obRes.ok ? obRes.data.completed : false,
      onboardingStep: obRes.ok ? obRes.data.step : 'intro',
      user: session ? session.user : null,
      permissions: permRes.ok ? permRes.data : DEFAULT_PERMISSION_SNAPSHOT,
      preferences: prefRes.ok ? prefRes.data : DEFAULT_USER_PREFERENCES,
      walkMode: walkModeActive,
    });
  },
}));
