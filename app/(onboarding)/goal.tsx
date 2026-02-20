import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

const goals = [
  { value: 'growth', label: 'Growth', description: 'Increase downloads and users', icon: 'trending-up-outline' as const },
  { value: 'monetization', label: 'Monetization', description: 'Increase revenue and conversions', icon: 'cash-outline' as const },
  { value: 'retention', label: 'Retention', description: 'Keep users coming back', icon: 'heart-outline' as const },
  { value: 'launch', label: 'Launch', description: 'Prepare for a successful launch', icon: 'rocket-outline' as const },
];

export default function GoalScreen() {
  const router = useRouter();
  const { updateProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!selectedGoal) return;
    setLoading(true);
    try { await updateProfile({ primary_goal: selectedGoal }); router.push('/(onboarding)/connect'); } catch (error) { console.error('Error saving goal:', error); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progress}><View style={styles.progressBar}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: '80%' }]} /></View><Text variant="caption" color="secondary">Step 4 of 5</Text></View>
        <View style={styles.header}><Text variant="title" weight="bold">What's your primary goal?</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>We'll focus your dashboard and AI advice on this goal.</Text></View>
        <View style={styles.goals}>
          {goals.map((goal) => (
            <TouchableOpacity key={goal.value} style={[styles.goalItem, { backgroundColor: selectedGoal === goal.value ? colors.primary + '15' : colors.card, borderColor: selectedGoal === goal.value ? colors.primary : colors.border }]} onPress={() => setSelectedGoal(goal.value)}>
              <View style={[styles.iconContainer, { backgroundColor: selectedGoal === goal.value ? colors.primary : colors.border }]}><Ionicons name={goal.icon} size={24} color={selectedGoal === goal.value ? '#FFFFFF' : colors.textSecondary} /></View>
              <View style={styles.goalText}><Text variant="label" weight={selectedGoal === goal.value ? 'semibold' : 'regular'} color={selectedGoal === goal.value ? 'accent' : 'primary'}>{goal.label}</Text><Text variant="caption" color="secondary">{goal.description}</Text></View>
              {selectedGoal === goal.value && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.buttons}><Button title="Continue" onPress={handleNext} loading={loading} disabled={!selectedGoal} size="large" /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, progress: { alignItems: 'center', marginBottom: 32 }, progressBar: { width: '100%', height: 4, backgroundColor: '#E5E5E5', borderRadius: 2, marginBottom: 8 }, progressFill: { height: '100%', borderRadius: 2 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, goals: { gap: 12 }, goalItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5 }, iconContainer: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 }, goalText: { flex: 1 }, buttons: { padding: 24, paddingTop: 0 } });
