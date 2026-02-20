import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: 'fc1202f1-146f-4093-a688-be0d9453c012' });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#007AFF' });
    }
    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}

export async function sendLocalNotification(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  await Notifications.scheduleNotificationAsync({ content: { title, body, data }, trigger: null });
}

export function addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
