import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function AuthLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}><Stack.Screen name="welcome" /><Stack.Screen name="sign-in" /><Stack.Screen name="sign-up" /><Stack.Screen name="check-email" /></Stack>;
}
