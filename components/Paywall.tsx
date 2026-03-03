import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/Colors';
import { Config } from '@/constants/Config';

const { width } = Dimensions.get('window');

// LockedFeature wrapper - checks subscription and shows lock screen if not premium
interface LockedFeatureProps {
  children: ReactNode;
  feature: 'attribution' | 'aiChat' | 'community';
  featureTitle?: string;
}

export function LockedFeature({ children, feature, featureTitle }: LockedFeatureProps) {
  const { useSubscription } = require('@/hooks/useSubscription');
  const { isPremium, isTrial } = useSubscription();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [showPaywall, setShowPaywall] = React.useState(false);

  // Allow access if premium or on trial
  if (isPremium || isTrial) {
    return <>{children}</>;
  }

  // Show locked state
  const featureInfo = {
    attribution: {
      icon: 'git-branch-outline' as const,
      title: 'Attribution Tracking',
      description: 'See where your users come from with detailed traffic source analytics.',
    },
    aiChat: {
      icon: 'chatbubbles-outline' as const,
      title: 'AI Chat Assistant',
      description: 'Get personalized marketing and sales strategies from our AI.',
    },
    community: {
      icon: 'people-outline' as const,
      title: 'Founder Community',
      description: 'Connect with other indie app developers and share insights.',
    },
  };

  const info = featureInfo[feature];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.primary + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Ionicons name="lock-closed" size={36} color={colors.primary} />
          </View>

          <Text variant="title" weight="bold" align="center" style={{ marginBottom: 8 }}>
            {featureTitle || info.title}
          </Text>

          <Text variant="body" color="secondary" align="center" style={{ marginBottom: 32, paddingHorizontal: 16 }}>
            {info.description}
          </Text>

          <View style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 20,
            width: '100%',
            marginBottom: 24,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="diamond" size={24} color="#FFD700" />
              <Text variant="label" weight="semibold" style={{ marginLeft: 12 }}>
                Premium Feature
              </Text>
            </View>
            <Text variant="caption" color="secondary">
              Upgrade to Statly Premium to unlock this feature and get access to all premium features.
            </Text>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#007AFF',
              borderRadius: 12,
              paddingVertical: 16,
              paddingHorizontal: 48,
              width: '100%',
              alignItems: 'center',
            }}
            onPress={() => setShowPaywall(true)}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
              Unlock Premium
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <LockedFeaturePaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </View>
  );
}

// Simplified paywall for locked features
function LockedFeaturePaywall({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { useSubscription } = require('@/hooks/useSubscription');
  const { subscribe, beginTrial, restore, purchasing } = useSubscription();

  const handleSubscribe = async () => {
    try {
      await subscribe();
      onClose();
    } catch (error: any) {
      console.error('Subscribe error:', error);
    }
  };

  const handleTrial = async () => {
    try {
      await beginTrial();
      onClose();
    } catch (error: any) {
      console.error('Trial error:', error);
    }
  };

  return (
    <Paywall
      visible={visible}
      onClose={onClose}
      onPurchase={handleSubscribe}
      onStartTrial={handleTrial}
      onRestore={restore}
      purchasing={purchasing}
    />
  );
}

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onPurchase: () => void;
  onStartTrial?: () => void;
  onRestore: () => void;
  purchasing?: boolean;
  monthlyPrice?: string;
}

const FEATURES = [
  {
    icon: 'analytics-outline' as const,
    title: 'Real-Time Analytics',
    description: 'Live downloads, revenue & user metrics synced every minute',
  },
  {
    icon: 'chatbubbles-outline' as const,
    title: 'AI Marketing Assistant',
    description: 'Get personalized growth strategies from our AI',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Instant Notifications',
    description: 'Alerts for new downloads, sales & milestones',
  },
  {
    icon: 'people-outline' as const,
    title: 'Founder Community',
    description: 'Connect with other indie app developers',
  },
  {
    icon: 'apps-outline' as const,
    title: 'Home Screen Widget',
    description: 'View your stats at a glance on your home screen',
  },
];

// Blue color for CTA button (matches Get Started button)
const CTA_BUTTON_COLOR = '#007AFF';

export function Paywall({
  visible,
  onClose,
  onPurchase,
  onStartTrial,
  onRestore,
  purchasing = false,
  monthlyPrice = Config.SUBSCRIPTION_PRICE,
}: PaywallProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Close Button */}
        <SafeAreaView edges={['top']} style={styles.closeContainer}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </SafeAreaView>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            {/* App Logo */}
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text variant="title" weight="bold" align="center" style={styles.title}>
              Unlock Statly Pro
            </Text>

            <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
              Everything you need to grow your app business
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: CTA_BUTTON_COLOR + '15' }]}>
                  <Ionicons name={feature.icon} size={24} color={CTA_BUTTON_COLOR} />
                </View>
                <View style={styles.featureText}>
                  <Text variant="label" weight="semibold">
                    {feature.title}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {feature.description}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
            ))}
          </View>

          {/* Pricing Card */}
          <View style={[styles.pricingCard, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={styles.pricingHeader}>
              <View style={[styles.popularBadge, { backgroundColor: CTA_BUTTON_COLOR }]}>
                <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
                  BEST VALUE
                </Text>
              </View>
            </View>

            <View style={styles.priceRow}>
              <Text variant="title" weight="bold" style={{ fontSize: 40 }}>
                {monthlyPrice}
              </Text>
              <Text variant="body" color="secondary" style={{ marginLeft: 4 }}>
                /month
              </Text>
            </View>

            <Text variant="caption" color="secondary" align="center">
              Cancel anytime
            </Text>
          </View>

          {/* CTA Button - Subscribe */}
          <TouchableOpacity
            style={[
              styles.ctaButton,
              { backgroundColor: purchasing ? colors.border : CTA_BUTTON_COLOR },
            ]}
            onPress={onPurchase}
            disabled={purchasing}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaButtonText}>
              {purchasing ? 'Processing...' : 'Subscribe Now'}
            </Text>
          </TouchableOpacity>

          {/* Free Trial Button */}
          {onStartTrial && (
            <TouchableOpacity
              style={[
                styles.trialButton,
                { borderColor: CTA_BUTTON_COLOR },
              ]}
              onPress={onStartTrial}
              disabled={purchasing}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={18} color={CTA_BUTTON_COLOR} style={{ marginRight: 8 }} />
              <Text style={[styles.trialButtonText, { color: CTA_BUTTON_COLOR }]}>
                Start 72-Hour Free Trial
              </Text>
            </TouchableOpacity>
          )}

          {/* Restore */}
          <TouchableOpacity onPress={onRestore} style={styles.restoreButton}>
            <Text variant="label" color="secondary">
              Restore Purchases
            </Text>
          </TouchableOpacity>

          {/* Subscription Details */}
          <View style={styles.subscriptionDetails}>
            <Text variant="caption" color="secondary" align="center">
              Statly Premium - Monthly Subscription
            </Text>
            <Text variant="caption" color="secondary" align="center">
              {monthlyPrice}/month - Auto-renewable
            </Text>
          </View>

          {/* Legal */}
          <Text variant="caption" color="secondary" align="center" style={styles.legal}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless canceled at least 24 hours before
            the end of the current period. Manage subscriptions in Account Settings.
          </Text>

          {/* Privacy & Terms Links */}
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://github.com/Disguise-Ai/AplTrack/blob/main/PRIVACY.md')}>
              <Text variant="caption" style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text variant="caption" color="secondary"> | </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://github.com/Disguise-Ai/AplTrack/blob/main/TERMS.md')}>
              <Text variant="caption" style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>

          {/* Spacer for safe area */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    padding: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
  },
  pricingCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  pricingHeader: {
    marginBottom: 12,
  },
  popularBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  ctaButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  trialButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    flexDirection: 'row',
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  legal: {
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  subscriptionDetails: {
    marginBottom: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  legalLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});
