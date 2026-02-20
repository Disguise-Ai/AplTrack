import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, needsOnboarding, initialized } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useEffect(() => {
    if (!initialized) return;
    if (isAuthenticated) {
      if (needsOnboarding) router.replace('/(onboarding)/company');
      else router.replace('/(tabs)/dashboard');
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [isAuthenticated, needsOnboarding, initialized]);

  return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
