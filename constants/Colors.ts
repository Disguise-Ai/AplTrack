export const Colors = {
  light: {
    // Light theme (Apple-inspired)
    primary: '#007AFF',
    accent: '#5856D6',
    background: '#F5F5F7',
    card: '#FFFFFF',
    cardHover: '#FAFAFA',
    text: '#1D1D1F',
    textSecondary: '#86868B',
    textTertiary: '#AEAEB2',
    border: '#D2D2D7',
    borderSubtle: '#E8E8ED',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    tabIconDefault: '#86868B',
    tabIconSelected: '#007AFF',
    gradient: ['#007AFF', '#5856D6'],
  },
  dark: {
    // Dark theme (Resend/Apple inspired)
    primary: '#FFFFFF',
    accent: '#A78BFA',
    background: '#000000',
    card: '#0A0A0A',
    cardHover: '#141414',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    border: '#27272A',
    borderSubtle: '#18181B',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    tabIconDefault: '#71717A',
    tabIconSelected: '#FFFFFF',
    gradient: ['#A78BFA', '#818CF8'],
  },
};

export type ColorScheme = keyof typeof Colors;
