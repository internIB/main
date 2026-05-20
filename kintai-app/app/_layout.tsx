import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../store/appStore';
import '../global.css';

export default function RootLayout() {
  const loadStoredUser = useAppStore(s => s.loadStoredUser);

  useEffect(() => {
    loadStoredUser();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin/index" />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </SafeAreaProvider>
  );
}
