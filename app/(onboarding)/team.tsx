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

const teamIcons: Record<string, keyof typeof Ionicons.glyphMap> = { 'solo': 'person-outline', '2-5': 'people-outline', '6-20': 'people', '21+': 'business-outline' };

export default function TeamScreen() {
  const router = useRouter();
  const { updateProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!selectedSize) return;
    setLoading(true);
    try { await updateProfile({ team_size: selectedSize }); router.push('/(onboarding)/goal'); } catch (error) { console.error('Error saving team size:', error); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progress}><View style={styles.progressBar}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: '60%' }]} /></View><Text variant="caption" color="secondary">Step 3 of 5</Text></View>
        <View style={styles.header}><Text variant="title" weight="bold">What's your team size?</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>We'll tailor recommendations to your team's needs.</Text></View>
        <View style={styles.options}>
          {Config.TEAM_SIZES.map((size) => (
            <TouchableOpacity key={size.value} style={[styles.optionItem, { backgroundColor: selectedSize === size.value ? colors.primary + '15' : colors.card, borderColor: selectedSize === size.value ? colors.primary : colors.border }]} onPress={() => setSelectedSize(size.value)}>
              <View style={[styles.iconContainer, { backgroundColor: selectedSize === size.value ? colors.primary : colors.border }]}><Ionicons name={teamIcons[size.value]} size={28} color={selectedSize === size.value ? '#FFFFFF' : colors.textSecondary} /></View>
              <Text variant="subtitle" weight={selectedSize === size.value ? 'bold' : 'semibold'} color={selectedSize === size.value ? 'accent' : 'primary'}>{size.label}</Text>
              <Text variant="caption" color="secondary">{size.value === 'solo' ? 'Just me' : 'people'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.buttons}><Button title="Continue" onPress={handleNext} loading={loading} disabled={!selectedSize} size="large" /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, progress: { alignItems: 'center', marginBottom: 32 }, progressBar: { width: '100%', height: 4, backgroundColor: '#27272A', borderRadius: 2, marginBottom: 8 }, progressFill: { height: '100%', borderRadius: 2 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, optionItem: { width: '47%', padding: 20, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' }, iconContainer: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, buttons: { padding: 24, paddingTop: 0 } });
