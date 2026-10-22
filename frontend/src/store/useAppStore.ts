import { create } from 'zustand';

type AppState = {
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  onboarded: false,
  setOnboarded: (onboarded) => set({ onboarded }),
}));
