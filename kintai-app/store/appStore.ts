import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface AppState {
  currentUser: string | null;
  isAdmin: boolean;
  googleAccessToken: string | null;
  setCurrentUser: (name: string | null) => void;
  setIsAdmin: (val: boolean) => void;
  setGoogleAccessToken: (token: string | null) => void;
  loadStoredUser: () => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'kintai_current_user';

async function saveUser(name: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (name) {
      localStorage.setItem(STORAGE_KEY, name);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } else {
    if (name) {
      await SecureStore.setItemAsync(STORAGE_KEY, name);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  }
}

async function loadUser(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(STORAGE_KEY);
  }
  return await SecureStore.getItemAsync(STORAGE_KEY);
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  isAdmin: false,
  googleAccessToken: null,

  setCurrentUser: (name) => {
    set({ currentUser: name });
    saveUser(name);
  },

  setIsAdmin: (val) => set({ isAdmin: val }),

  setGoogleAccessToken: (token) => set({ googleAccessToken: token }),

  loadStoredUser: async () => {
    const name = await loadUser();
    if (name) set({ currentUser: name });
  },

  logout: () => {
    set({ currentUser: null, isAdmin: false, googleAccessToken: null });
    saveUser(null);
  },
}));
