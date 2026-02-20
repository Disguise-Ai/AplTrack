import React from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
}

export function Card({ children, style, onPress, padding = 16 }: CardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const cardStyle: ViewStyle = { backgroundColor: colors.card, borderRadius: 16, padding, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...StyleSheet.flatten(style) };
  if (onPress) return <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>{children}</TouchableOpacity>;
  return <View style={cardStyle}>{children}</View>;
}
