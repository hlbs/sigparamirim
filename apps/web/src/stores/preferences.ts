import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';
export type LanguageCode = 'PT' | 'EN' | 'ES' | 'FR' | 'ZH' | 'DE' | 'AR';

type PreferencesState = {
  theme: ThemePreference;
  language: LanguageCode;
  sidebarOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: LanguageCode) => void;
  setSidebarOpen: (open: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'PT',
      sidebarOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: 'sig-paramirim-preferences' },
  ),
);

