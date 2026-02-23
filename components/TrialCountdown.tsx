import React, { useState, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { Colors } from '@/constants/Colors';

interface TrialCountdownProps {
  trialEndsAt: string;
  onUpgrade?: () => void;
}

export function TrialCountdown({ trialEndsAt, onUpgrade }: TrialCountdownProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const endTime = new Date(trialEndsAt).getTime();
    const now = Date.now();
    const diff = endTime - now;

    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, expired: false };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [trialEndsAt]);

  if (timeLeft.expired) {
    return (
      <View style={[styles.container, styles.expired, { backgroundColor: colors.error + '15' }]}>
        <View style={styles.content}>
          <Ionicons name="time-outline" size={20} color={colors.error} />
          <View style={styles.textContainer}>
            <Text variant="label" weight="semibold" style={{ color: colors.error }}>
              Trial Expired
            </Text>
            <Text variant="caption" color="secondary">
              Upgrade to continue using premium features
            </Text>
          </View>
        </View>
        {onUpgrade && (
          <TouchableOpacity style={[styles.upgradeButton, { backgroundColor: colors.error }]} onPress={onUpgrade}>
            <Text variant="label" weight="semibold" style={{ color: '#FFFFFF' }}>
              Upgrade
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const isUrgent = timeLeft.hours < 12;

  return (
    <View style={[styles.container, { backgroundColor: isUrgent ? colors.warning + '15' : colors.primary + '10' }]}>
      <View style={styles.content}>
        <Ionicons name="timer-outline" size={20} color={isUrgent ? colors.warning : colors.primary} />
        <View style={styles.textContainer}>
          <Text variant="label" weight="semibold" style={{ color: isUrgent ? colors.warning : colors.primary }}>
            Free Trial
          </Text>
          <Text variant="caption" color="secondary">
            {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s remaining
          </Text>
        </View>
      </View>
      <View style={styles.timeBoxes}>
        <TimeBox value={timeLeft.hours} label="HRS" color={isUrgent ? colors.warning : colors.primary} />
        <Text variant="label" style={{ color: isUrgent ? colors.warning : colors.primary, marginHorizontal: 2 }}>:</Text>
        <TimeBox value={timeLeft.minutes} label="MIN" color={isUrgent ? colors.warning : colors.primary} />
        <Text variant="label" style={{ color: isUrgent ? colors.warning : colors.primary, marginHorizontal: 2 }}>:</Text>
        <TimeBox value={timeLeft.seconds} label="SEC" color={isUrgent ? colors.warning : colors.primary} />
      </View>
    </View>
  );
}

function TimeBox({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.timeBox}>
      <Text variant="label" weight="bold" style={{ color }}>
        {value.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  expired: {},
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  timeBoxes: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBox: {
    alignItems: 'center',
    minWidth: 28,
  },
  upgradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
