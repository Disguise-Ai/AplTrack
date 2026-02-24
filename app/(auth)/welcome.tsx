import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useColorScheme, Animated, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text variant="largeTitle" weight="bold" align="center" style={styles.appName}>
            Statly
          </Text>
          <Text variant="body" color="secondary" align="center" style={styles.tagline}>
            Real-time analytics for indie developers
          </Text>
        </Animated.View>

        {/* Stats Preview */}
        <Animated.View style={[styles.statsPreview, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text variant="caption" color="secondary">Downloads</Text>
            <Text variant="title" weight="bold" style={{ color: colors.primary }}>1,247</Text>
            <View style={styles.statChange}>
              <Ionicons name="arrow-up" size={12} color={colors.success} />
              <Text variant="caption" style={{ color: colors.success }}>23%</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text variant="caption" color="secondary">Revenue</Text>
            <Text variant="title" weight="bold" style={{ color: colors.primary }}>$4.8k</Text>
            <View style={styles.statChange}>
              <Ionicons name="arrow-up" size={12} color={colors.success} />
              <Text variant="caption" style={{ color: colors.success }}>18%</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text variant="caption" color="secondary">Rating</Text>
            <Text variant="title" weight="bold" style={{ color: colors.primary }}>4.8</Text>
            <Text variant="caption" style={{ color: '#FFD700' }}>★★★★★</Text>
          </View>
        </Animated.View>

        {/* Features */}
        <Animated.View style={[styles.features, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <FeatureItem
            icon="flash"
            title="Real-time Data"
            description="No more waiting 24 hours"
            colors={colors}
          />
          <FeatureItem
            icon="sparkles"
            title="AI Marketing Help"
            description="Get growth strategies instantly"
            colors={colors}
          />
          <FeatureItem
            icon="git-network"
            title="Track Attribution"
            description="Know where users come from"
            colors={colors}
          />
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.buttons, { opacity: fadeAnim }]}>
        <Button
          title="Get Started — It's Free"
          onPress={() => router.push('/(auth)/sign-up')}
          variant="accent"
          size="large"
          style={styles.button}
        />
        <Button
          title="I already have an account"
          onPress={() => router.push('/(auth)/sign-in')}
          variant="ghost"
          size="large"
          style={styles.button}
        />
        <Text variant="caption" color="secondary" align="center" style={styles.terms}>
          Free plan includes 2 data sources. Upgrade anytime.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.featureText}>
        <Text variant="label" weight="semibold">{title}</Text>
        <Text variant="caption" color="secondary">{description}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  content: { flex: 1, justifyContent: 'center' },
  heroSection: { alignItems: 'center', marginBottom: 32 },
  logoContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  appName: { marginBottom: 4 },
  tagline: { marginBottom: 8 },
  statsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  statChange: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  features: { gap: 12 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: { flex: 1 },
  buttons: { gap: 12, paddingTop: 16 },
  button: { width: '100%' },
  terms: { marginTop: 8 },
});
