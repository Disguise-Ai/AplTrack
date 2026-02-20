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

export function Input({ label, error, containerStyle, leftIcon, rightIcon, onRightIconPress, secureTextEntry, ...props }: InputProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry !== undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: error ? colors.error : isFocused ? colors.primary : colors.border }]}>
        {leftIcon && <Ionicons name={leftIcon} size={20} color={colors.textSecondary} style={styles.leftIcon} />}
        <TextInput style={[styles.input, { color: colors.text, paddingLeft: leftIcon ? 0 : 16, paddingRight: rightIcon || isPassword ? 0 : 16 }]} placeholderTextColor={colors.textSecondary} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} secureTextEntry={isPassword && !showPassword} {...props} />
        {isPassword && <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.rightIcon}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} /></TouchableOpacity>}
        {rightIcon && !isPassword && <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon} disabled={!onRightIconPress}><Ionicons name={rightIcon} size={20} color={colors.textSecondary} /></TouchableOpacity>}
      </View>
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ container: { marginBottom: 16 }, label: { fontSize: 14, fontWeight: '500', marginBottom: 8 }, inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, minHeight: 48 }, input: { flex: 1, fontSize: 16, paddingVertical: 12 }, leftIcon: { marginLeft: 16, marginRight: 12 }, rightIcon: { padding: 12 }, error: { fontSize: 12, marginTop: 4 } });
