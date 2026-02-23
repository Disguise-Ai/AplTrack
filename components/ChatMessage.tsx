import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Text } from './ui/Text';
import { Colors } from '@/constants/Colors';

interface ChatMessageProps { message: string; isUser: boolean; timestamp?: string; }

export function ChatMessage({ message, isUser, timestamp }: ChatMessageProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      <View style={[styles.bubble, isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <Text variant="body" style={{ color: isUser ? '#FFFFFF' : colors.text }}>{message}</Text>
      </View>
      {timestamp && <Text variant="caption" color="secondary" style={[styles.timestamp, isUser ? styles.userTimestamp : styles.botTimestamp]}>{timestamp}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ container: { marginVertical: 4, maxWidth: '80%' }, userContainer: { alignSelf: 'flex-end' }, botContainer: { alignSelf: 'flex-start' }, bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18 }, timestamp: { marginTop: 4, fontSize: 11 }, userTimestamp: { textAlign: 'right' }, botTimestamp: { textAlign: 'left' } });
