import React from 'react';
import { View, Dimensions, useColorScheme } from 'react-native';
import { LineChart as RNLineChart } from 'react-native-chart-kit';
import { Colors } from '@/constants/Colors';

interface LineChartProps { data: number[]; labels?: string[]; height?: number; width?: number; yAxisSuffix?: string; yAxisPrefix?: string; }

export function LineChart({ data, labels, height = 220, width, yAxisSuffix = '', yAxisPrefix = '' }: LineChartProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const screenWidth = width || Dimensions.get('window').width - 32;
  if (!data.length) { data = [0]; labels = ['']; }
  const displayLabels = labels?.length ? labels.filter((_, i) => i % Math.ceil(labels.length / 6) === 0) : [];
  return (
    <View>
      <RNLineChart data={{ labels: displayLabels, datasets: [{ data }] }} width={screenWidth} height={height} yAxisSuffix={yAxisSuffix} yAxisPrefix={yAxisPrefix} chartConfig={{ backgroundColor: colors.card, backgroundGradientFrom: colors.card, backgroundGradientTo: colors.card, decimalPlaces: 0, color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`, labelColor: () => colors.textSecondary, style: { borderRadius: 16 }, propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary }, propsForBackgroundLines: { strokeDasharray: '', stroke: colors.border, strokeWidth: 1 } }} bezier style={{ borderRadius: 16 }} withInnerLines withOuterLines={false} withVerticalLines={false} fromZero />
    </View>
  );
}
