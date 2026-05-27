import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import i18n from '../i18n';
import { AppSettings, SupportedTypes, Invokes, Language } from '../components/ui/AppProperties';
import { DEFAULT_THEME_ID } from '../utils/themes';

interface SettingsState {
  appSettings: AppSettings | null;
  theme: string;
  supportedTypes: SupportedTypes | null;
  osPlatform: string;

  // Actions
  initPlatform: () => void;
  setAppSettings: (settings: AppSettings | null) => Promise<void>;
  setTheme: (theme: string) => void;
  setSupportedTypes: (types: SupportedTypes | null) => void;
  handleSettingsChange: (newSettings: AppSettings) => Promise<void>;
  setLanguage: (language: Language) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  appSettings: null,
  theme: DEFAULT_THEME_ID,
  supportedTypes: null,
  osPlatform: '',

  initPlatform: () => {
    try {
      set({ osPlatform: platform() });
    } catch (_err) {
      set({ osPlatform: '' });
    }
  },

  setAppSettings: async (settings) => {
    if (settings?.language && settings.language !== i18n.language) {
      await i18n.changeLanguage(settings.language);
    }
    set({ appSettings: settings });
  },

  setTheme: (theme) => set({ theme }),

  setSupportedTypes: (types) => set({ supportedTypes: types }),

  handleSettingsChange: async (newSettings: AppSettings) => {
    if (!newSettings) {
      console.error('handleSettingsChange was called with null settings. Aborting save operation.');
      return;
    }

    if (newSettings.theme && newSettings.theme !== get().theme) {
      set({ theme: newSettings.theme });
    }

    if (newSettings.language && newSettings.language !== i18n.language) {
      await i18n.changeLanguage(newSettings.language);
    }

    const { searchCriteria: _searchCriteria, ...settingsToSave } = newSettings as any;
    set({ appSettings: newSettings });

    try {
      await invoke(Invokes.SaveSettings, { settings: settingsToSave });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  },

  setLanguage: (language: Language) => {
    i18n.changeLanguage(language);
    const currentSettings = get().appSettings;
    if (currentSettings) {
      const newSettings = { ...currentSettings, language };
      set({ appSettings: newSettings });
      invoke(Invokes.SaveSettings, { settings: newSettings }).catch((err) => {
        console.error('Failed to save language setting:', err);
      });
    }
  },
}));
