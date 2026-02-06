# Anchor MVP

Stay Steady - A preventive mental load companion for international postgraduate students in their first 12 months in Ireland.

## What is Anchor?

Anchor is **not therapy** and **not a medical product**. It's a focused tool to:
- Track mental load across 7 fixed domains
- Complete a 3–5 minute weekly check-in
- Log extra load entries during the week
- View a secondary mood snapshot (not the core experience)
- Keep your data private and yours alone

## Features (Anchor MVP)

✅ **Magic Link Authentication** — Secure, password-free login via email
✅ **Mandatory Consent Flow** — Privacy, non-clinical disclaimer, crisis resources
✅ **Weekly Check-In (Primary)** — Structured, 3–5 minutes, domain-tagged
✅ **Load Tracking (Secondary)** — Log pressure during the week
✅ **Mental Load Domains (7)** — Fixed framework for consistent tracking
✅ **Structured Chat Follow-Ups** — Only via check-ins or load entries
✅ **Mood Snapshot (Secondary)** — Optional mood timeline view
✅ **Institutional Aggregates (SQL)** — Anonymized cohort-level analytics

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
│   ├── dashboard/         # Load-focused home
│   ├── checkin/           # Weekly structured check-in
│   ├── load/              # Ad-hoc load tracking
│   ├── timeline/          # Mood snapshot (secondary)
│   ├── chat/              # Structured follow-up chat
│   ├── onboarding/        # Semester context capture
│   ├── institutional/     # Internal-only stub view
│   └── settings/          # Privacy controls + logout
├── components/            # Reusable React components
│   ├── Navigation.tsx     # Bottom navigation
│   ├── WeeklyCheckinFlow.tsx
│   ├── LoadTracking.tsx
│   ├── MoodButton.tsx     # Snapshot view only
│   └── MoodCard.tsx       # Snapshot view only
├── lib/
│   ├── supabase.ts        # Supabase client setup
│   ├── consent.ts         # Consent logic
│   └── types.ts           # Types + load domain framework
├── .env.local             # Environment variables (not in git)
├── tailwind.config.js     # Tailwind customization
└── tsconfig.json          # TypeScript config
```

## Database Schema

Anchor requires a fresh Supabase project. Use the full SQL schema:

- [ANCHOR_SUPABASE_SCHEMA.sql](ANCHOR_SUPABASE_SCHEMA.sql)

Core tables:
- mental_load_domains
- users_extended
- load_entries
- load_domain_selections
- weekly_checkin_responses
- institutional_aggregates
- chat_sessions (repurposed)
- chat_summaries (repurposed)
- mood_entries (snapshot only)
- consent

## Design Principles

1. **Narrow ICP** — International postgrad students in first 12 months in Ireland
2. **Mental load first** — Domains, structure, and weekly continuity
3. **Non-clinical** — Plain language, no diagnosis or therapy claims
4. **Private by default** — RLS, minimal data collection
5. **Short and structured** — 3–5 minutes weekly check-in

## Mood Snapshot (Secondary)

Mood tracking exists only as a secondary snapshot view. It is not the primary flow.

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
5. Complete onboarding (semester start + stage)
6. Complete weekly check-in
7. Log one load entry
8. View Snapshot (optional)
9. Logout and confirm redirect to login

**Target**: Weekly check-in in under 5 minutes.

## Important Notes

⚠️ **Not for medical use** — Anchor is not a substitute for professional mental health care.
⚠️ **Privacy-first** — No analytics, no tracking, no third-party services.
⚠️ **Scope** — This MVP is for structured load tracking, not broad wellness features.

## Support

For issues or questions:
1. Check [SUPABASE_SETUP.md](SUPABASE_SETUP.md) troubleshooting section
2. Verify `.env.local` is correctly set up
3. Check browser console for errors
4. Review Supabase dashboard logs

---

Built for mental load clarity.
