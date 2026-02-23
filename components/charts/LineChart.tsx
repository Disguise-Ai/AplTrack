import React from 'react';
import { View, Dimensions, useColorScheme, StyleSheet } from 'react-native';
import { LineChart as RNLineChart } from 'react-native-chart-kit';
import { Colors } from '@/constants/Colors';

interface LineChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  width?: number;
  yAxisSuffix?: string;
  yAxisPrefix?: string;
}

export function LineChart({
  data,
  labels,
  height = 200,
  width,
  yAxisSuffix = '',
  yAxisPrefix = '',
}: LineChartProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const screenWidth = width || Dimensions.get('window').width - 32;

  // Ensure we have valid data
  const chartData = data.length ? data : [0];
  const chartLabels = labels?.length ? labels : [''];

  // Show fewer labels for readability
  const displayLabels = chartLabels.filter(
    (_, i) => i % Math.ceil(chartLabels.length / 7) === 0
  );

  // Purple accent color matching Resend aesthetic
  const accentColor = '#A78BFA';

  return (
    <View style={styles.container}>
      <RNLineChart
        data={{
          labels: displayLabels,
          datasets: [{ data: chartData }],
        }}
        width={screenWidth}
        height={height}
        yAxisSuffix={yAxisSuffix}
        yAxisPrefix={yAxisPrefix}
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: 'transparent',
          backgroundGradientTo: 'transparent',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
          labelColor: () => colors.textTertiary,
          style: { borderRadius: 12 },
          propsForDots: {
            r: '3',
            strokeWidth: '2',
            stroke: accentColor,
            fill: colorScheme === 'dark' ? '#000' : '#fff',
          },
          propsForBackgroundLines: {
            strokeDasharray: '4,4',
            stroke: colors.border,
            strokeWidth: 0.5,
          },
          fillShadowGradientFrom: accentColor,
          fillShadowGradientFromOpacity: 0.2,
          fillShadowGradientTo: accentColor,
          fillShadowGradientToOpacity: 0,
        }}
        bezier
        style={styles.chart}
        withInnerLines
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLabels
        withVerticalLabels
        fromZero
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: -16,
  },
  chart: {
    borderRadius: 12,
  },
});
