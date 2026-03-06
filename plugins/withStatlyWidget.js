const { withEntitlementsPlist } = require('@expo/config-plugins');

const APP_GROUP = 'group.com.apltrack.app';

/**
 * Expo config plugin that adds App Group entitlement to the main app.
 * The widget extension target must be added manually in Xcode.
 */
function withStatlyWidget(config) {
  // Add App Group to main app entitlements
  config = withEntitlementsPlist(config, (config) => {
    const existingGroups = config.modResults['com.apple.security.application-groups'] || [];
    if (!existingGroups.includes(APP_GROUP)) {
      config.modResults['com.apple.security.application-groups'] = [...existingGroups, APP_GROUP];
    }
    return config;
  });

  return config;
}

module.exports = withStatlyWidget;
