import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { Colors } from '@/constants/Colors';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature: string;
}

const FEATURES = [
  { icon: 'flash', text: 'Unlimited data sources' },
  { icon: 'analytics', text: 'Full attribution tracking' },
  { icon: 'chatbubbles', text: 'AI Marketing & Sales chat' },
  { icon: 'people', text: 'Founder community access' },
  { icon: 'notifications', text: 'Real-time notifications' },
];

export function Paywall({ visible, onClose, feature }: PaywallProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { monthlyPackage, purchase, purchasing, beginTrial, isTrial, trialEndsAt } = useSubscription();
  const [startingTrial, setStartingTrial] = useState(false);

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      await beginTrial();
      Alert.alert('Trial Started!', 'Your 72-hour free trial has begun. Enjoy premium features!');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start trial');
    } finally {
      setStartingTrial(false);
    }
  };

  const handlePurchase = async () => {
    if (!monthlyPackage) {
      // RevenueCat not configured yet - start trial instead
      await handleStartTrial();
      return;
    }
    try {
      await purchase(monthlyPackage);
      onClose();
    } catch (error: any) {
      if (!error.message?.includes('cancelled')) {
        Alert.alert('Error', error.message || 'Purchase failed');
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name="lock-open" size={32} color="white" />
            </View>
            <Text variant="title" weight="bold" align="center">
              Unlock {feature}
            </Text>
            <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
              Upgrade to Pro to access all features
            </Text>
          </View>

          <View style={styles.features}>
            {FEATURES.map((item, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name={item.icon as any} size={18} color={colors.success} />
                </View>
                <Text variant="body">{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.pricing}>
            <Text variant="largeTitle" weight="bold" style={{ color: colors.primary }}>
              $30
            </Text>
            <Text variant="body" color="secondary">/month</Text>
          </View>

          <Button
            title={purchasing || startingTrial ? 'Processing...' : 'Start 72-Hour Free Trial'}
            onPress={handleStartTrial}
            loading={purchasing || startingTrial}
            size="large"
            style={styles.button}
          />

          {monthlyPackage && (
            <TouchableOpacity onPress={handlePurchase} style={styles.subscribeLink}>
              <Text variant="label" color="accent">Or subscribe now for $30/month</Text>
            </TouchableOpacity>
          )}

          <Text variant="caption" color="secondary" align="center" style={styles.terms}>
            72-hour free trial, then $30/month. Cancel anytime.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

interface LockedFeatureProps {
  feature: 'attribution' | 'aiChat' | 'community';
  featureTitle: string;
  children: React.ReactNode;
}

export function LockedFeature({ feature, featureTitle, children }: LockedFeatureProps) {
  const { checkFeatureAccess, isPremium, loading: subscriptionLoading } = useSubscription();
  const { loading: authLoading, user } = useAuth();
  const [showPaywall, setShowPaywall] = React.useState(false);
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const hasAccess = checkFeatureAccess(feature);

  // Show content while loading to prevent flash for premium users
  // Wait for BOTH auth AND subscription to finish loading before showing paywall
  // This prevents the flash where subscription errors before auth completes
  const isLoading = subscriptionLoading || authLoading || !user;

  if (isLoading || hasAccess) {
    return <>{children}</>;
  }

  return (
    <View style={styles.lockedContainer}>
      <View style={[styles.lockedOverlay, { backgroundColor: colors.background }]}>
        <View style={[styles.lockedIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="lock-closed" size={40} color={colors.primary} />
        </View>
        <Text variant="title" weight="semibold" align="center">
          {featureTitle}
        </Text>
        <Text variant="body" color="secondary" align="center" style={styles.lockedText}>
          Upgrade to Pro to unlock this feature and get unlimited access to all tools.
        </Text>
        <Button
          title="Unlock Pro"
          onPress={() => setShowPaywall(true)}
          size="large"
          style={styles.unlockButton}
        />
      </View>
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={featureTitle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  subtitle: {
    marginTop: 8,
  },
  features: {
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 4,
  },
  button: {
    width: '100%',
    marginBottom: 12,
  },
  terms: {
    marginTop: 4,
  },
  subscribeLink: {
    paddingVertical: 12,
    marginBottom: 4,
  },
  lockedContainer: {
    flex: 1,
  },
  lockedOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedText: {
    marginTop: 8,
    marginBottom: 24,
    maxWidth: 280,
  },
  unlockButton: {
    minWidth: 200,
  },
});
