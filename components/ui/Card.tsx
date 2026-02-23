import React from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, onPress, padding = 16, variant = 'default' }: CardProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const getCardStyle = (): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding,
    };

    switch (variant) {
      case 'elevated':
        return {
          ...base,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.1,
          shadowRadius: 12,
          elevation: 8,
        };
      case 'outlined':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          ...base,
          borderWidth: 1,
          borderColor: colors.border,
        };
    }
  };

  const cardStyle: ViewStyle = {
    ...getCardStyle(),
    ...StyleSheet.flatten(style),
  };

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}
