# ADMIN SETUP - CRITICAL FIX GUIDE

## Problem Summary
Admin account creation is failing because the required database tables don't exist in Supabase.

## Solution: 3-Step Process

### Step 1: Create Database Tables in Supabase (REQUIRED)

1. Go to Supabase Dashboard: https://app.supabase.com/project/mvpkcicbyyrxoacfvwtx/sql/new
2. Copy the entire SQL script from `INSTALL_ADMIN_TABLES.sql`
3. Paste into the SQL Editor
4. Click **Execute**

This creates:
✅ institutions (with NCI pre-seeded)
✅ pending_admins
✅ admin_users
✅ risk_events
✅ institutional_insights
✅ Extends users_extended with institution_id
✅ Extends weekly_checkin_responses with risk fields

### Step 2: Verify Tables Were Created

Run these queries in Supabase SQL Editor to confirm:

```sql
-- Check institutions
SELECT * FROM institutions;
-- Should show: 550e8400-e29b-41d4-a716-446655440000 | National College of Ireland

-- Check other tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pending_admins', 'admin_users', 'risk_events');
```

### Step 3: Create Admin Account

Now you can create an admin account:

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:3000/admin/setup

3. Fill in the form:
   - **Email**: any email (e.g., t@test.com)
   - **Full Name**: any name (e.g., t)
   - **Password**: anything 6+ chars (e.g., password123)
   - **Admin Secret Key**: `abc` (from your .env.local)

4. Click "Create Admin Account"

5. You should see success message and be redirected to /admin

### Step 4: Troubleshooting

If it still fails:

**Check browser console (F12) for error messages:**
- "Invalid secret key" → Verify you're entering `abc`
- "Failed to create admin record" → Database tables might not be created
- "Failed to create account" → Email already exists in Supabase auth

**Check server logs (terminal running npm run dev):**
- Look for `[CREATE_PENDING]` or `[AUTH_CALLBACK]` messages
- These logs will show exactly what's failing

**If tables still don't exist:**
- Verify you ran the full INSTALL_ADMIN_TABLES.sql script
- Check "SQL Editor" > "Recent" in Supabase to see execution history
- Make sure there were no errors shown

---

## What Was Fixed

1. **Session Endpoint**: Now returns `isAdmin` flag so login page knows to redirect to /admin
2. **Auth Callback**: Added logging and improved redirect logic
3. **Create-Pending**: Fixed logic for password mode signup
4. **Better Error Messages**: Detailed errors for debugging

---

## Complete Flow After Setup

**First Time (Admin Setup):**
1. Go to `/admin/setup`
2. Enter details + secret key
3. Account created + redirected to `/admin`

**Subsequent Times (Normal Login):**
1. Go to `/login`
2. Enter email + password
3. System checks if you're admin
4. Redirected to `/admin` or `/dashboard` automatically

---

## Files You Need to Check

- [INSTALL_ADMIN_TABLES.sql](INSTALL_ADMIN_TABLES.sql) - Database migrations
- [app/admin/setup/page.tsx](app/admin/setup/page.tsx) - Admin setup form
- [app/api/admin/create-pending/route.ts](app/api/admin/create-pending/route.ts) - Account creation backend
- [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts) - Auth callback handler
- [app/api/auth/session/route.ts](app/api/auth/session/route.ts) - Session endpoint (UPDATED)
