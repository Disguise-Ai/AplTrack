// Hardcode values for native builds where env vars may not load
const ENV_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ENV_SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const Config = {
  // Use env vars if available, otherwise use hardcoded values for native builds
  SUPABASE_URL: ENV_SUPABASE_URL || 'https://ortktibcxwsoqvjletlj.supabase.co',
  SUPABASE_ANON_KEY: ENV_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydGt0aWJjeHdzb3F2amxldGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzMyMjgsImV4cCI6MjA4NzEwOTIyOH0.2TXD5lBOeyhYcQWsVwhddi-NeWNShJT3m0to-fadrFw',
  REVENUECAT_API_KEY_IOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || 'appl_UcXQAmnBqcrFREJGDQGwFdBPtNo',
  REVENUECAT_API_KEY_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || 'your-android-api-key',
  PREMIUM_MONTHLY_PRODUCT_ID: 'com.apltrack.premium.monthly',
  PREMIUM_ENTITLEMENT_ID: 'premium',
  SUBSCRIPTION_PRICE: '$30/month',
  APP_CATEGORIES: ['Games', 'Productivity', 'Social', 'Health & Fitness', 'Finance', 'Education', 'Entertainment', 'Other'],
  TEAM_SIZES: [
    { label: 'Solo', value: 'solo' },
    { label: '2-5', value: '2-5' },
    { label: '6-20', value: '6-20' },
    { label: '21+', value: '21+' },
  ],
  PRIMARY_GOALS: [
    { label: 'Growth', value: 'growth', icon: 'trending-up' },
    { label: 'Monetization', value: 'monetization', icon: 'dollar-sign' },
    { label: 'Retention', value: 'retention', icon: 'users' },
    { label: 'Launch', value: 'launch', icon: 'rocket' },
  ],
  ATTRIBUTION_SOURCES: [
    { name: 'Twitter', color: '#1DA1F2' },
    { name: 'Instagram', color: '#E4405F' },
    { name: 'Reddit', color: '#FF4500' },
    { name: 'Google', color: '#4285F4' },
    { name: 'Direct', color: '#34C759' },
  ],
  COMMUNITY_CATEGORIES: ['Growth Tips', 'Marketing', 'Technical', 'Funding'],
};
