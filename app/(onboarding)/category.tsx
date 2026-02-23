import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/hooks/useAuth';
import { Config } from '@/constants/Config';
import { Colors } from '@/constants/Colors';

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = { 'Games': 'game-controller-outline', 'Productivity': 'checkbox-outline', 'Social': 'people-outline', 'Health & Fitness': 'fitness-outline', 'Finance': 'card-outline', 'Education': 'school-outline', 'Entertainment': 'play-outline', 'Other': 'apps-outline' };

export default function CategoryScreen() {
  const router = useRouter();
  const { updateProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try { await updateProfile({ app_category: selectedCategory }); router.push('/(onboarding)/team'); } catch (error) { console.error('Error saving category:', error); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progress}><View style={styles.progressBar}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: '40%' }]} /></View><Text variant="caption" color="secondary">Step 2 of 5</Text></View>
        <View style={styles.header}><Text variant="title" weight="bold">What category is your app?</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>This helps us provide relevant insights and benchmarks.</Text></View>
        <View style={styles.categories}>
          {Config.APP_CATEGORIES.map((category) => (
            <TouchableOpacity key={category} style={[styles.categoryItem, { backgroundColor: selectedCategory === category ? colors.primary + '15' : colors.card, borderColor: selectedCategory === category ? colors.primary : colors.border }]} onPress={() => setSelectedCategory(category)}>
              <Ionicons name={categoryIcons[category]} size={24} color={selectedCategory === category ? colors.primary : colors.textSecondary} />
              <Text variant="label" weight={selectedCategory === category ? 'semibold' : 'regular'} color={selectedCategory === category ? 'accent' : 'primary'} style={styles.categoryText}>{category}</Text>
              {selectedCategory === category && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.buttons}><Button title="Continue" onPress={handleNext} loading={loading} disabled={!selectedCategory} size="large" /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, progress: { alignItems: 'center', marginBottom: 32 }, progressBar: { width: '100%', height: 4, backgroundColor: '#27272A', borderRadius: 2, marginBottom: 8 }, progressFill: { height: '100%', borderRadius: 2 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, categories: { gap: 12 }, categoryItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1.5 }, categoryText: { flex: 1, marginLeft: 12 }, buttons: { padding: 24, paddingTop: 0 } });
