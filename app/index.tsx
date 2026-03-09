import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme, Image } from 'react-native';
import { useRouter } from 'expo-router';
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

    // Navigate immediately - no artificial delay
    if (isAuthenticated) {
      if (needsOnboarding) {
        router.replace('/(onboarding)/company');
      } else {
        router.replace('/(tabs)/dashboard?refresh=true');
      }
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [isAuthenticated, needsOnboarding, initialized]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require('@/assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text variant="title" weight="bold" style={styles.appName}>Statly</Text>
      <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: { marginBottom: 24 },
  loader: { marginTop: 8 },
});
