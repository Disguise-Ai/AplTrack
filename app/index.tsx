import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/Colors';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, needsOnboarding, initialized } = useAuth();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  useEffect(() => {
    if (!initialized) return;

    // Add a small delay for smooth transition
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        if (needsOnboarding) {
          router.replace('/(onboarding)/company');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } else {
        router.replace('/(auth)/welcome');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isAuthenticated, needsOnboarding, initialized]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
        <Ionicons name="analytics" size={40} color="white" />
      </View>
      <Text variant="title" weight="bold" style={styles.appName}>AplTrack</Text>
      <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { marginBottom: 24 },
  loader: { marginTop: 8 },
});
