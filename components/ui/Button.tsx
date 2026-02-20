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

export function Button({ title, onPress, variant = 'primary', size = 'medium', disabled = false, loading = false, style, textStyle, icon }: ButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const getBackgroundColor = () => { if (disabled) return colors.border; switch (variant) { case 'primary': return colors.primary; case 'secondary': return colors.card; case 'outline': case 'ghost': return 'transparent'; default: return colors.primary; } };
  const getTextColor = () => { if (disabled) return colors.textSecondary; switch (variant) { case 'primary': return '#FFFFFF'; case 'secondary': return colors.text; case 'outline': case 'ghost': return colors.primary; default: return '#FFFFFF'; } };
  const getBorderColor = () => variant === 'outline' ? (disabled ? colors.border : colors.primary) : 'transparent';
  const getPadding = () => { switch (size) { case 'small': return { paddingVertical: 8, paddingHorizontal: 16 }; case 'large': return { paddingVertical: 16, paddingHorizontal: 32 }; default: return { paddingVertical: 12, paddingHorizontal: 24 }; } };
  const getFontSize = () => { switch (size) { case 'small': return 14; case 'large': return 18; default: return 16; } };
  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: getBackgroundColor(), borderColor: getBorderColor(), ...getPadding() }, variant === 'outline' && styles.outline, style]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.7}>
      {loading ? <ActivityIndicator color={getTextColor()} size="small" /> : <>{icon}<Text style={[styles.text, { color: getTextColor(), fontSize: getFontSize(), marginLeft: icon ? 8 : 0 }, textStyle]}>{title}</Text></>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({ button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 44 }, outline: { borderWidth: 1.5 }, text: { fontWeight: '600' } });
