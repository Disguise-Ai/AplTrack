export const Colors = {
  light: {
    primary: '#007AFF',
    background: '#FFFFFF',
    card: '#F9F9F9',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E5E5E5',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#007AFF',
  },
  dark: {
    primary: '#0A84FF',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#0A84FF',
  },
};

export type ColorScheme = keyof typeof Colors;
