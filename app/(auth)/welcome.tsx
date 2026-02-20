import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}><View style={[styles.logo, { backgroundColor: colors.primary }]}><Ionicons name="analytics" size={48} color="#FFFFFF" /></View></View>
        <Text variant="title" weight="bold" align="center" style={styles.title}>AplTrack</Text>
        <Text variant="body" color="secondary" align="center" style={styles.subtitle}>Your app analytics dashboard.{'\n'}Track downloads, revenue, and grow your startup.</Text>
        <View style={styles.features}>
          <FeatureItem icon="trending-up" title="Real-time Analytics" description="Track downloads, revenue, and user metrics" />
          <FeatureItem icon="chatbubbles" title="AI Marketing Assistant" description="Get personalized growth strategies" />
          <FeatureItem icon="people" title="Founder Community" description="Connect and learn from other founders" />
        </View>
      </View>
      <View style={styles.buttons}>
        <Button title="Get Started" onPress={() => router.push('/(auth)/sign-up')} size="large" style={styles.button} />
        <Button title="I already have an account" onPress={() => router.push('/(auth)/sign-in')} variant="ghost" size="large" style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return <View style={styles.featureItem}><View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}><Ionicons name={icon} size={24} color={colors.primary} /></View><View style={styles.featureText}><Text variant="label" weight="semibold">{title}</Text><Text variant="caption" color="secondary">{description}</Text></View></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 24 }, content: { flex: 1, justifyContent: 'center' }, logoContainer: { alignItems: 'center', marginBottom: 24 }, logo: { width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, title: { marginBottom: 8 }, subtitle: { marginBottom: 48 }, features: { gap: 16 }, featureItem: { flexDirection: 'row', alignItems: 'center' }, featureIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 }, featureText: { flex: 1 }, buttons: { gap: 12 }, button: { width: '100%' } });
