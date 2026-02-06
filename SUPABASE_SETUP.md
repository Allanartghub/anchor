# Anchor Week 1 - Supabase Setup Guide

## Required Steps Before Running the App

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Sign in or create an account
3. Create a new project
4. Note your **Project URL** and **Anon Public Key**

### 2. Create Database Tables

In your Supabase dashboard, go to **SQL Editor** and run these scripts:

#### Create consents table:
```sql
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_accepted_at TIMESTAMP WITH TIME ZONE,
  disclaimer_accepted_at TIMESTAMP WITH TIME ZONE,
  crisis_disclosure_accepted_at TIMESTAMP WITH TIME ZONE,
  version INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_consents_user_id ON consents(user_id);
```

#### Create mood_entries table:
```sql
CREATE TABLE mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mood_id TEXT NOT NULL,
  text TEXT,
  CONSTRAINT text_max_length CHECK (char_length(text) <= 280)
);

CREATE INDEX idx_mood_entries_user_id ON mood_entries(user_id);
CREATE INDEX idx_mood_entries_created_at ON mood_entries(created_at DESC);
```

### 3. Enable Row-Level Security (RLS)

#### For consents table:
```sql
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY consents_user_own ON consents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### For mood_entries table:
```sql
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY mood_entries_user_own ON mood_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 4. Configure Authentication

1. Go to **Authentication > Providers** in Supabase dashboard
2. Enable **Email Provider**
3. Go to **Email** settings and enable **Confirm email**
4. Under **Email templates**, customize **Magic Link** (optional)
5. Go to **URL Configuration** and set:
   - **Site URL**: `http://localhost:3000` (for local dev)
   - **Redirect URLs**: 
     - `http://localhost:3000/auth/callback`
     - `https://yourdomain.com/auth/callback` (for production on Vercel)

### 5. Update Environment Variables

After getting your Supabase credentials, update `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## Install Dependencies & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Testing Checklist

- [✔️] Can create account via magic link
- [✔️] Consent form blocks access until all three items accepted
- [✔️] Can select mood and save (with optional text)
- [✔️] Saved mood appears in timeline (most recent first)
- [✔️] Can navigate between Home, Timeline, Chat (placeholder), Settings
- [✔️] Logout works and returns to login
- [✔️] Entire flow takes < 30 seconds

## Troubleshooting

**"Failed to sign in" error**: Check that email provider is enabled and redirect URL is correct.

**Mood entries not saving**: Verify RLS policies are enabled and correct.

**Timeline shows no entries**: Check that mood_entries are being inserted with the correct user_id.
