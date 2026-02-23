import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const getBackgroundColor = () => {
    if (disabled) return colors.border;
    switch (variant) {
      case 'primary':
        return colorScheme === 'dark' ? '#FFFFFF' : '#000000';
      case 'secondary':
        return colors.card;
      case 'outline':
      case 'ghost':
        return 'transparent';
      default:
        return '#FFFFFF';
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textSecondary;
    switch (variant) {
      case 'primary':
        return colorScheme === 'dark' ? '#000000' : '#FFFFFF';
      case 'secondary':
        return colors.text;
      case 'outline':
      case 'ghost':
        return colors.text;
      default:
        return '#000000';
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') {
      return disabled ? colors.border : colors.textSecondary;
    }
    return 'transparent';
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 32 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 24 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 13;
      case 'large':
        return 16;
      default:
        return 14;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          ...getPadding(),
        },
        variant === 'outline' && styles.outline,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
                marginLeft: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    minHeight: 44,
  },
  outline: {
    borderWidth: 1,
  },
  text: {
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
