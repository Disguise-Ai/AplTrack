import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function OnboardingLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}><Stack.Screen name="company" /><Stack.Screen name="category" /><Stack.Screen name="team" /><Stack.Screen name="goal" /><Stack.Screen name="connect" /></Stack>;
}
