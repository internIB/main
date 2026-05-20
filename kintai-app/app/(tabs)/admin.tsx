import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAppStore } from '../../store/appStore';

export default function AdminRedirect() {
  const isAdmin = useAppStore(s => s.isAdmin);

  useEffect(() => {
    if (isAdmin) {
      router.replace('/admin');
    } else {
      router.replace('/(tabs)/input');
    }
  }, [isAdmin]);

  return null;
}
