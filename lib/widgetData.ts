import { NativeModules, Platform, Alert } from 'react-native';

const { WidgetDataModule } = NativeModules;

export interface WidgetDataPayload {
  downloadsToday: number;
  totalRevenue: number;
  newUsers: number;
}

/**
 * Check if the native module is available
 */
export function isWidgetModuleAvailable(): boolean {
  return Platform.OS === 'ios' && !!WidgetDataModule;
}

/**
 * Updates the widget data that is shared with the iOS WidgetKit extension.
 */
export async function updateWidgetData(data: WidgetDataPayload): Promise<boolean> {
  console.log('[WidgetData] ========================================');
  console.log('[WidgetData] updateWidgetData called');
  console.log('[WidgetData] Platform:', Platform.OS);
  console.log('[WidgetData] WidgetDataModule exists:', !!WidgetDataModule);
  console.log('[WidgetData] WidgetDataModule methods:', WidgetDataModule ? Object.keys(WidgetDataModule) : 'N/A');
  console.log('[WidgetData] Input data:', JSON.stringify(data));

  if (Platform.OS !== 'ios') {
    console.log('[WidgetData] Not iOS, skipping');
    return false;
  }

  if (!WidgetDataModule) {
    console.error('[WidgetData] ERROR: WidgetDataModule is not available!');
    console.log('[WidgetData] All NativeModules:', Object.keys(NativeModules).sort().join(', '));
    return false;
  }

  if (!WidgetDataModule.updateWidgetData) {
    console.error('[WidgetData] ERROR: updateWidgetData method not found on module!');
    return false;
  }

  try {
    const payload = {
      downloadsToday: Math.floor(data.downloadsToday || 0),
      totalRevenue: Number(data.totalRevenue || 0),
      newUsers: Math.floor(data.newUsers || 0),
    };
    console.log('[WidgetData] Sending payload to native:', JSON.stringify(payload));

    const result = await WidgetDataModule.updateWidgetData(payload);
    console.log('[WidgetData] Native module returned:', result);
    console.log('[WidgetData] SUCCESS - Widget data sent');
    console.log('[WidgetData] ========================================');
    return true;
  } catch (error: any) {
    console.error('[WidgetData] FAILED:', error?.message || error);
    console.error('[WidgetData] Full error:', JSON.stringify(error));
    console.log('[WidgetData] ========================================');
    return false;
  }
}

/**
 * Forces an immediate reload of all widget timelines.
 */
export async function reloadWidgets(): Promise<void> {
  if (Platform.OS !== 'ios' || !WidgetDataModule?.reloadWidgets) {
    return;
  }

  try {
    await WidgetDataModule.reloadWidgets();
    console.log('[WidgetData] Widgets reloaded');
  } catch (error) {
    console.error('[WidgetData] Failed to reload widgets:', error);
  }
}

/**
 * Debug function to read back the current widget data from the native module
 */
export async function getWidgetData(): Promise<WidgetDataPayload | null> {
  if (Platform.OS !== 'ios' || !WidgetDataModule?.getWidgetData) {
    console.log('[WidgetData] getWidgetData not available');
    return null;
  }

  try {
    const data = await WidgetDataModule.getWidgetData();
    console.log('[WidgetData] Current widget data from native:', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('[WidgetData] Failed to get widget data:', error);
    return null;
  }
}

/**
 * Debug function to test the widget data flow
 */
export async function testWidgetDataFlow(): Promise<void> {
  console.log('[WidgetData] ===== TESTING WIDGET DATA FLOW =====');

  const testData = {
    downloadsToday: 999,
    totalRevenue: 999.99,
    newUsers: 99,
  };

  console.log('[WidgetData] Step 1: Writing test data:', JSON.stringify(testData));
  const writeSuccess = await updateWidgetData(testData);

  if (!writeSuccess) {
    Alert.alert('Widget Test Failed', 'Failed to write test data to native module');
    return;
  }

  console.log('[WidgetData] Step 2: Reading back data...');
  const readData = await getWidgetData();

  if (readData) {
    console.log('[WidgetData] Step 3: Read back:', JSON.stringify(readData));
    Alert.alert(
      'Widget Test Result',
      `Write: SUCCESS\nRead back:\n- Downloads: ${readData.downloadsToday}\n- Revenue: $${readData.totalRevenue}\n- New Users: ${readData.newUsers}\n\nNow check your widget!`
    );
  } else {
    Alert.alert('Widget Test', 'Write succeeded but read returned null. Check widget manually.');
  }

  await reloadWidgets();
  console.log('[WidgetData] ===== TEST COMPLETE =====');
}
