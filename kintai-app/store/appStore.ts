import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface AppState {
  currentUser: string | null;
  isAdmin: boolean;
  hydrated: boolean;
  googleAccessToken: string | null;
  setCurrentUser: (name: string | null) => void;
  setIsAdmin: (val: boolean) => void;
  setGoogleAccessToken: (token: string | null) => void;
  loadStoredUser: () => Promise<void>;
  logout: () => void;
}

const USER_KEY = 'kintai_current_user';
const ADMIN_KEY = 'kintai_is_admin';

async function save(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } else {
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  }
}

async function load(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  isAdmin: false,
  hydrated: false,
  googleAccessToken: null,

  setCurrentUser: (name) => {
    set({ currentUser: name });
    save(USER_KEY, name);
  },

  setIsAdmin: (val) => {
    set({ isAdmin: val });
    save(ADMIN_KEY, val ? '1' : null);
  },

  setGoogleAccessToken: (token) => set({ googleAccessToken: token }),

  loadStoredUser: async () => {
    try {
      const name = await load(USER_KEY);
      const adminStr = await load(ADMIN_KEY);
      set({ currentUser: name, isAdmin: adminStr === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  logout: () => {
    set({ currentUser: null, isAdmin: false, googleAccessToken: null });
    save(USER_KEY, null);
    save(ADMIN_KEY, null);
  },
}));
