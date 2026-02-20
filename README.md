# AplTrack

Startup analytics and founder community app built with Expo/React Native, Supabase, and RevenueCat.

## Features
- **Dashboard**: Real-time analytics (downloads, revenue, users, ratings)
- **Attribution**: Track traffic sources (Twitter, Instagram, Reddit, Google, Direct)
- **AI Chat**: Marketing and Sales AI assistants powered by Claude
- **Community**: Connect with founders, share wins and ideas
- **Push Notifications**: Alerts for downloads, sales, milestones

## Tech Stack
- **Frontend**: Expo/React Native (TypeScript)
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Payments**: RevenueCat ($30/month)
- **AI**: Anthropic Claude

## Getting Started

1. Install dependencies: `npm install` or `yarn install`
2. Copy `.env.example` to `.env` and fill in credentials
3. Run Supabase migrations: `supabase db push`
4. Deploy Edge Functions: `supabase functions deploy`
5. Start the app: `npx expo start`

## EAS Project
Project ID: `fc1202f1-146f-4093-a688-be0d9453c012`

## License
MIT
