import { Platform, Dimensions } from 'react-native';
import { useMemo } from 'react';

/**
 * Platform detection hook for iOS, iPadOS, and macOS (Catalyst)
 */
export function usePlatform() {
  return useMemo(() => {
    const { width, height } = Dimensions.get('window');
    const isIOS = Platform.OS === 'ios';

    // Mac Catalyst reports as iOS but with larger screen and no touch
    // We can detect it by checking screen size and other heuristics
    const isTablet = isIOS && (width >= 768 || height >= 768);

    // Mac Catalyst typically has screen width >= 1024 and runs in windowed mode
    const isMac = isIOS && Platform.isPad === false && width >= 1024;

    // For Mac Catalyst, isPad might be true if running iPad app
    const isMacCatalyst = isIOS && (
      // @ts-ignore - Mac Catalyst detection
      Platform.isMacCatalyst ||
      // Fallback heuristic: large screen without being marked as iPad
      (width >= 1024 && !Platform.isPad)
    );

    const isDesktop = isMac || isMacCatalyst;
    const isMobile = isIOS && !isTablet && !isDesktop;

    return {
      isIOS,
      isAndroid: Platform.OS === 'android',
      isWeb: Platform.OS === 'web',
      isMobile,
      isTablet,
      isMac: isDesktop,
      isMacCatalyst: isDesktop,
      isDesktop,

      // Layout helpers
      screenWidth: width,
      screenHeight: height,
      isLargeScreen: width >= 768,
      isExtraLargeScreen: width >= 1024,

      // Feature flags
      supportsHover: isDesktop,
      supportsKeyboardNavigation: isDesktop || isTablet,
      prefersSidebar: width >= 768,
    };
  }, []);
}

/**
 * Get responsive value based on platform
 */
export function getPlatformValue<T>(options: {
  mobile: T;
  tablet?: T;
  desktop?: T;
  default?: T;
}): T {
  const { width } = Dimensions.get('window');

  if (width >= 1024 && options.desktop !== undefined) {
    return options.desktop;
  }
  if (width >= 768 && options.tablet !== undefined) {
    return options.tablet;
  }
  return options.mobile;
}

/**
 * Platform-specific styles helper
 */
export const platformStyles = {
  // Larger touch targets on mobile, smaller on desktop
  touchTarget: getPlatformValue({
    mobile: 44,
    tablet: 40,
    desktop: 36,
  }),

  // Font sizes
  bodyFontSize: getPlatformValue({
    mobile: 16,
    tablet: 17,
    desktop: 15,
  }),

  // Padding
  screenPadding: getPlatformValue({
    mobile: 16,
    tablet: 24,
    desktop: 32,
  }),

  // Max content width for readability on large screens
  maxContentWidth: 800,
};
