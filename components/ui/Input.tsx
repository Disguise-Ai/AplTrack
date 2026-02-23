import React, { useState } from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps, ViewStyle, useColorScheme, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  ...props
}: InputProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry !== undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colorScheme === 'dark' ? '#0A0A0A' : colors.card,
            borderColor: error
              ? colors.error
              : isFocused
              ? colors.textSecondary
              : colors.border,
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={colors.textSecondary}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              paddingLeft: leftIcon ? 0 : 14,
              paddingRight: rightIcon || isPassword ? 0 : 14,
            },
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            <Ionicons name={rightIcon} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
    letterSpacing: -0.2,
  },
  leftIcon: {
    marginLeft: 14,
    marginRight: 10,
  },
  rightIcon: {
    padding: 12,
  },
  error: {
    fontSize: 12,
    marginTop: 6,
  },
});
