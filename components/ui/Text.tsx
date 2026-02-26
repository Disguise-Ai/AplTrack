import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

interface TextProps extends RNTextProps {
  variant?: 'hero' | 'title' | 'subtitle' | 'body' | 'caption' | 'label' | 'mono' | 'micro';
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
}

export function Text({
  variant = 'body',
  color = 'primary',
  weight = 'regular',
  align = 'left',
  style,
  children,
  ...props
}: TextProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const getColor = () => {
    switch (color) {
      case 'primary':
        return colors.text;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      case 'accent':
        return colors.accent;
      case 'error':
        return colors.error;
      case 'success':
        return colors.success;
      default:
        return colors.text;
    }
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'hero':
        return styles.hero;
      case 'title':
        return styles.title;
      case 'subtitle':
        return styles.subtitle;
      case 'caption':
        return styles.caption;
      case 'label':
        return styles.label;
      case 'mono':
        return styles.mono;
      case 'micro':
        return styles.micro;
      default:
        return styles.body;
    }
  };

  const getFontWeight = () => {
    switch (weight) {
      case 'medium':
        return '500' as const;
      case 'semibold':
        return '600' as const;
      case 'bold':
        return '700' as const;
      default:
        return '400' as const;
    }
  };

  return (
    <RNText
      style={[
        getVariantStyle(),
        {
          color: getColor(),
          fontWeight: getFontWeight(),
          textAlign: align,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  hero: {
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  micro: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
});
