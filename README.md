# Anchor Week 1 MVP

Stay Steady - A preventative mental wellness companion that helps users check in with how they feel and build a private emotional timeline.

## What is Anchor?

Anchor is **not therapy** and **not a medical product**. It's a calm space to:
- Quickly check in with how you feel (< 30 seconds)
- Optionally reflect in one short sentence
- See your emotional timeline over time
- Know your data is private and yours alone

## Features (Week 1)

✅ **Magic Link Authentication** — Secure, password-free login via email
✅ **Mandatory Consent Flow** — Privacy, clinical disclaimer, crisis resources
✅ **Mood Check-In** — Select from 6 moods + optional text (max 280 chars)
✅ **Save to Database** — Mood, timestamp, and optional reflection stored securely
✅ **Timeline Feed** — Private view of past moods, most recent first
✅ **Simple Navigation** — Home, Timeline, Chat (placeholder), Settings
✅ **Calm UX** — Soft colors, no urgency, non-judgmental tone

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript
- **Backend**: Supabase (Auth + PostgreSQL)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (ready to deploy)

## Getting Started

### Prerequisites

1. **Node.js 18+** and npm
2. **Supabase Account** (free tier is fine)
3. **Git** (optional)

### Setup

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed Supabase configuration.

### Quick Start

```bash
# Install dependencies
npm install

# Configure environment (see SUPABASE_SETUP.md)
# Edit .env.local with your Supabase URL and anon key

# Run dev server
npm run dev

# Open http://localhost:3000
```

## Project Structure

```
anchor/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Redirect to login or dashboard
│   ├── globals.css        # Tailwind + global styles
│   ├── login/             # Magic link login
│   ├── auth/callback/     # OAuth callback handler
│   ├── consent/           # Mandatory consent form
│   ├── dashboard/         # Mood check-in (home)
│   ├── timeline/          # Mood entries feed
│   ├── chat/              # Placeholder (coming soon)
│   └── settings/          # Logout + user info
├── components/            # Reusable React components
│   ├── Navigation.tsx     # Bottom navigation
│   ├── MoodButton.tsx     # Mood selection buttons
│   └── MoodCard.tsx       # Timeline mood card display
├── lib/
│   ├── supabase.ts        # Supabase client setup
│   ├── consent.ts         # Consent logic
│   └── types.ts           # TypeScript types + mood definitions
├── .env.local             # Environment variables (not in git)
├── tailwind.config.js     # Tailwind customization
└── tsconfig.json          # TypeScript config
```

## Database Schema

### consents
Stores user consent acceptance timestamps.
```
id, user_id, privacy_accepted_at, disclaimer_accepted_at, 
crisis_disclosure_accepted_at, version, created_at
```

### mood_entries
Stores user mood check-ins.
```
id, user_id, created_at, mood_id, text
```

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for exact SQL.

## Design Principles

1. **Calm, not urgent** — No gamification, streaks, or pressure
2. **Private by default** — Row-level security, minimal data collection
3. **Non-clinical** — Plain language, no diagnosis or advice
4. **Respectful** — Crisis resources included, clear disclaimers
5. **Fast** — Entire check-in flow < 30 seconds
6. **Accessible** — Simple navigation, readable fonts, high contrast

## Mood Options

- 😌 Calm
- 🙂 Okay
- 😰 Stressed
- 😔 Low
- 😠 Angry
- 🌪️ Overwhelmed

## Crisis Resources (Ireland)

If you or someone you know is struggling:

- **Samaritans**: 1800 224 488 | www.samaritans.org
- **Pieta House**: 1800 247 247 | www.pieta.ie
- **Aware**: 1800 804 848 | www.aware.ie
- **Emergency**: 999 or 112

## Deployment to Vercel

```bash
# Push to GitHub
git push origin main

# Go to vercel.com, connect repo, add env vars
# (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

Then update Supabase **URL Configuration** > **Redirect URLs** with your Vercel domain.

## Testing the Full Flow

1. Open http://localhost:3000
2. Enter your email (any valid email works in dev)
3. Check your email for magic link
4. Accept consent
5. Select a mood, optionally add text
6. Click Save
7. See it appear in Timeline
8. Navigate between pages
9. Logout and confirm redirect to login

**Target**: Complete flow in under 30 seconds.

## Important Notes

⚠️ **Not for medical use** — Anchor is not a substitute for professional mental health care.
⚠️ **Privacy-first** — No analytics, no tracking, no third-party services.
⚠️ **Week 1 scope** — Future features (AI, insights, notifications) are out of scope.

## Support

For issues or questions:
1. Check [SUPABASE_SETUP.md](SUPABASE_SETUP.md) troubleshooting section
2. Verify `.env.local` is correctly set up
3. Check browser console for errors
4. Review Supabase dashboard logs

---

Built with ❤️ for mental wellness.
