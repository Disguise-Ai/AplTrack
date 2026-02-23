import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Text } from './ui/Text';
import { Colors } from '@/constants/Colors';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  showTail?: boolean;
}

export function ChatMessage({ message, isUser, timestamp, showTail = true }: ChatMessageProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? {
                backgroundColor: '#A78BFA',
                borderBottomRightRadius: showTail ? 4 : 20,
              }
            : {
                backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#E9E9EB',
                borderBottomLeftRadius: showTail ? 4 : 20,
              },
        ]}
      >
        <Text
          variant="body"
          style={[
            styles.messageText,
            { color: isUser ? '#FFFFFF' : colors.text },
          ]}
        >
          {message}
        </Text>
      </View>
      {timestamp && (
        <Text
          variant="caption"
          color="secondary"
          style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.botTimestamp,
          ]}
        >
          {timestamp}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    maxWidth: '78%',
    paddingHorizontal: 4,
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
    paddingHorizontal: 4,
  },
  userTimestamp: {
    textAlign: 'right',
  },
  botTimestamp: {
    textAlign: 'left',
  },
});
