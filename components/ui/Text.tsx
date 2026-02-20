import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

interface TextProps extends RNTextProps {
  variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'label';
  color?: 'primary' | 'secondary' | 'accent' | 'error' | 'success';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'primary', weight = 'regular', align = 'left', style, children, ...props }: TextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const getColor = () => { switch (color) { case 'primary': return colors.text; case 'secondary': return colors.textSecondary; case 'accent': return colors.primary; case 'error': return colors.error; case 'success': return colors.success; default: return colors.text; } };
  const getVariantStyle = () => { switch (variant) { case 'title': return styles.title; case 'subtitle': return styles.subtitle; case 'caption': return styles.caption; case 'label': return styles.label; default: return styles.body; } };
  const getFontWeight = () => { switch (weight) { case 'medium': return '500' as const; case 'semibold': return '600' as const; case 'bold': return '700' as const; default: return '400' as const; } };
  return <RNText style={[getVariantStyle(), { color: getColor(), fontWeight: getFontWeight(), textAlign: align }, style]} {...props}>{children}</RNText>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, lineHeight: 34 }, subtitle: { fontSize: 20, lineHeight: 28 }, body: { fontSize: 16, lineHeight: 24 }, caption: { fontSize: 13, lineHeight: 18 }, label: { fontSize: 14, lineHeight: 20 } });
