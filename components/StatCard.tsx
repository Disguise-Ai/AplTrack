import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { Colors } from '@/constants/Colors';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function StatCard({ title, value, subtitle, change, icon, onPress }: StatCardProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString();
    }
    return val;
  };

  const isPositiveChange = change !== undefined && change >= 0;

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text variant="caption" color="secondary" style={styles.title}>
          {title}
        </Text>
        {icon && (
          <Ionicons name={icon} size={16} color={colors.textTertiary} />
        )}
      </View>
      <Text variant="title" weight="semibold" style={styles.value}>
        {formatValue(value)}
      </Text>
      <View style={styles.footer}>
        {subtitle && (
          <Text variant="caption" color="tertiary">
            {subtitle}
          </Text>
        )}
        {change !== undefined && (
          <View
            style={[
              styles.changeContainer,
              {
                backgroundColor: isPositiveChange
                  ? `${colors.success}15`
                  : `${colors.error}15`,
              },
            ]}
          >
            <Ionicons
              name={isPositiveChange ? 'trending-up' : 'trending-down'}
              size={12}
              color={isPositiveChange ? colors.success : colors.error}
            />
            <Text
              variant="caption"
              weight="medium"
              style={{
                color: isPositiveChange ? colors.success : colors.error,
                marginLeft: 4,
              }}
            >
              {Math.abs(change).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    letterSpacing: 0,
  },
  value: {
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
