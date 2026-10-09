import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';
type PreferencesState = {
  theme: ThemePreference;
  sidebarOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  setSidebarOpen: (open: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: false,
      setTheme: (theme) => set({ theme }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'sig-paramirim-preferences',
      version: 2,
      partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
      migrate: (persisted) => {
        const { language: _legacyLanguage, ...preferences } = persisted as Partial<PreferencesState> & { language?: unknown };
        return preferences as PreferencesState;
      },
    },
  ),
);
