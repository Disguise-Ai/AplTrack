import { NativeModules, Platform } from 'react-native';

const { WidgetDataModule } = NativeModules;

export interface WidgetDataPayload {
  downloadsToday: number;
  totalDownloads: number;
  revenueToday: number;
  totalRevenue: number;
}

/**
 * Updates the widget data that is shared with the iOS WidgetKit extension.
 * This data is stored in a shared App Group container and read by the widget.
 */
export async function updateWidgetData(data: WidgetDataPayload): Promise<void> {
  if (Platform.OS !== 'ios') {
    // Widgets only supported on iOS/macOS
    return;
  }

  if (!WidgetDataModule) {
    console.log('[WidgetData] Native module not available');
    return;
  }

  try {
    await WidgetDataModule.updateWidgetData({
      downloadsToday: data.downloadsToday,
      totalDownloads: data.totalDownloads,
      revenueToday: data.revenueToday,
      totalRevenue: data.totalRevenue,
    });
    console.log('[WidgetData] Widget data updated successfully');
  } catch (error) {
    console.error('[WidgetData] Failed to update widget data:', error);
  }
}

/**
 * Forces an immediate reload of all widget timelines.
 * Call this after significant data changes.
 */
export async function reloadWidgets(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (!WidgetDataModule?.reloadWidgets) {
    console.log('[WidgetData] reloadWidgets not available');
    return;
  }

  try {
    await WidgetDataModule.reloadWidgets();
    console.log('[WidgetData] Widgets reloaded');
  } catch (error) {
    console.error('[WidgetData] Failed to reload widgets:', error);
  }
}
