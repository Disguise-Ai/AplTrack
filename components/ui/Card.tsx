import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card = React.memo(function Card({ children, style, onPress, padding = 16, variant = 'default' }: CardProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  // Memoize card style computation
  const cardStyle = useMemo((): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding,
    };

    let variantStyle: ViewStyle;
    switch (variant) {
      case 'elevated':
        variantStyle = {
          ...base,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.1,
          shadowRadius: 12,
          elevation: 8,
        };
        break;
      case 'outlined':
        variantStyle = {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
        break;
      default:
        variantStyle = {
          ...base,
          borderWidth: 1,
          borderColor: colors.border,
        };
    }

    return { ...variantStyle, ...StyleSheet.flatten(style) };
  }, [colors.card, colors.border, colorScheme, padding, variant, style]);

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
});
