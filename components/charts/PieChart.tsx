import React from 'react';
import { View, Dimensions, useColorScheme } from 'react-native';
import { PieChart as RNPieChart } from 'react-native-chart-kit';
import { Colors } from '@/constants/Colors';
import { Config } from '@/constants/Config';

interface PieChartDataItem { source: string; downloads: number; }
interface PieChartProps { data: PieChartDataItem[]; height?: number; width?: number; }

export function PieChart({ data, height = 220, width }: PieChartProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const screenWidth = width || Dimensions.get('window').width - 32;
  const getSourceColor = (source: string): string => Config.ATTRIBUTION_SOURCES.find((s) => s.name.toLowerCase() === source.toLowerCase())?.color || colors.primary;
  const chartData = data.map((item) => ({ name: item.source, population: item.downloads, color: getSourceColor(item.source), legendFontColor: colors.text, legendFontSize: 12 }));
  if (!chartData.length) return null;
  return <View><RNPieChart data={chartData} width={screenWidth} height={height} chartConfig={{ color: () => colors.primary }} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute /></View>;
}
