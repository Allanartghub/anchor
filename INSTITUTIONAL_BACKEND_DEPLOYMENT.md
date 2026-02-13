# ANCHOR INSTITUTIONAL BACKEND – DEPLOYMENT & SETUP

Date: February 11, 2026
Version: MVP 1.0

---

## OVERVIEW

This document covers deployment, configuration, and operational setup for the Anchor institutional backend.

The backend provides:
- **Risk Engine**: Deterministic, explainable high-risk identification
- **Insights Engine**: Cohort-level trend analysis (no PII)
- **Admin Dashboard**: Risk queue + cohort trends views
- **API Routes**: Check-in submission, risk flagging, admin review workflow

---

## PREREQUISITES

### Environment Variables

Set these in `.env.local` (Next.js) or your deployment platform:

```
# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role (NEW - for server-side admin queries)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Admin dashboard session management
# (Use existing auth mechanism or add custom session handling)
```

**IMPORTANT**: `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client. Always use in server-side routes only (Next.js API routes, server actions).

---

## DATABASE SETUP

### Step 1: Run New Schema Migrations

In Supabase SQL Editor, run **in order**:

1. **INSTITUTIONAL_BACKEND_SCHEMA.sql** (creates institutions, admin_users, risk_events tables, extends weekly_checkin_responses)

```bash
# File location: e:\anchor\INSTITUTIONAL_BACKEND_SCHEMA.sql
# Copy and paste the entire contents into Supabase SQL Editor > New Query
# Execute
```

**What it creates:**
- `institutions` – Multi-institution table (seed: NCI pilot)
- `admin_users` – Admin access control (maps auth.users → institution + role)
- Extends `weekly_checkin_responses` with `risk_score`, `high_risk`, `trigger_reasons`, `reviewed`
- `risk_events` – Audit log of flagged cases
- `institutional_insights` – Pre-computed cohort insights
- Helper functions for cohort aggregation

### Step 2: Verify RLS Policies

All admin tables have RLS disabled (service-role-only access). Verify in Supabase:
- `admin_users` → Row Security: OFF
- `risk_events` → Row Security: OFF
- `institutional_insights` → Row Security: OFF

Student tables (`weekly_checkin_responses`, `load_entries`) maintain strict RLS.

### Step 3: Seed Admin User (First Time Only)

```sql
-- In Supabase SQL Editor:
INSERT INTO admin_users (auth_uid, institution_id, email, full_name, role, is_active)
VALUES (
  'your-supabase-auth-uid', -- UUID of existing Supabase auth user
  '550e8400-e29b-41d4-a716-446655440000', -- NCI institution ID (from schema)
  'admin@nci.ie',
  'Admin User Name',
  'admin',
  true
);
```

---

## APPLICATION SETUP

### Step 1: Install Dependencies

If not already installed, ensure you have:
```bash
npm install @supabase/supabase-js
```

### Step 2: Configure Auth Mechanism

The institutional backend expects a session mechanism to extract JWT tokens.

**Current implementation assumes:**
- Endpoint: `/api/auth/session`
- Returns: `{ access_token: string, ... }`

**If using Supabase Auth:**
- Ensure your existing auth flow creates sessions accessible server-side
- Example: Supabase session stored in httpOnly cookie or localStorage

**If NOT implemented yet:**
- Add a simple session endpoint that returns the current user's access token
- Can use Supabase `getSession()` on the server side

### Step 3: Verify File Structure

```
/app
  /admin
    page.tsx              (dashboard home)
    /risk-queue
      page.tsx            (risk queue view)
    /trends
      page.tsx            (cohort trends view)
  /api
    /checkin
      route.ts            (POST: student submits check-in)
    /admin
      /risk-queue
        route.ts          (GET: admin views risk queue)
      /trends
        route.ts          (GET: admin views trends)
      /mark-reviewed
        route.ts          (POST: admin marks risk as reviewed)

/lib
  riskEngine.ts           (risk scoring logic)
  insightsEngine.ts       (cohort insights generation)
  adminAuth.ts            (admin auth verification)
```

### Step 4: Build & Deploy

```bash
npm run build
npm run start  # Local
# Or deploy to Vercel, Railway, etc.
```

---

## OPERATIONAL GUIDE

### Using the Risk Engine

**What happens:**
1. Student submits weekly check-in via `/api/checkin`
2. Risk engine queries check-in history
3. Calculates risk score (0–13 MVP scale)
4. If `risk_score ≥ 7` → `high_risk = true`
5. If high_risk → creates `risk_event` record for admin review

**Risk Scoring Rules (MVP):**
- Self-harm "sometimes" → +5
- Self-harm "often" → +8
- Intensity ≥4 → +2
- Intensity spike (2+ week-over-week) → +2
- Same domain high intensity 3 weeks → +3

**Example:**
- Student reports: self_harm="often", intensity=5, same domain 3 weeks
- Score: 8 + 2 + 3 = **13** → HIGH_RISK flagged

### Using the Admin Dashboard

**Step 1: Access Dashboard**
```
URL: /admin
Requires: Admin user authenticated + SUPABASE_SERVICE_ROLE_KEY set
```

**Step 2: Review Risk Queue**
```
URL: /admin/risk-queue
Shows: All flagged (reviewed=false) cases for your institution
Can: Mark as reviewed + add notes
```

**Step 3: View Cohort Trends**
```
URL: /admin/trends
Shows: Domain load distribution, intensity spikes, strategic recommendations
Supports: Query params ?weeks=12 (default)
```

---

## GDPR & PRIVACY COMPLIANCE

### Design Principles (MVP Enforced)

1. **No Raw Student Data Exported**
   - Risk queue shows only: risk_score, trigger_reasons, domain, intensity, week
   - Reflection text NOT shown by default
   - Option to view full check-in only on explicit action (future phase)

2. **Institutional Scoping**
   - Admin can only see students in their institution
   - Enforced at:
     - App level (filtering queries by `institution_id`)
     - Database level (RLS policies on student data)
     - API level (`adminAuth.ts` verifies institution match)

3. **No Super-Admin Access**
   - No global admin in MVP
   - Each admin tied to exactly one institution
   - Future: hierarchical organization model

4. **Anonymization**
   - Cohort trends computed without PII (domain + intensity only)
   - Insights are aggregated (e.g., "32% reporting high academic load")
   - No individual student names in insights

5. **Audit Trail**
   - Risk event review tracked: `reviewed_by_user_id`, `reviewed_at`, `review_notes`
   - Admin actions logged (can be extended to admin_audit_log table)

---

## TROUBLESHOOTING

### Issue: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Solution:**
1. Go to Supabase Dashboard → Settings → API
2. Copy "Service Role" key (NOT anon key)
3. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
4. Restart dev server

### Issue: Admin Routes Return 403

**Causes:**
- Session not authenticated
- User not in `admin_users` table
- `is_active = false`

**Debug:**
```javascript
// In browser console:
const res = await fetch('/api/admin/risk-queue');
console.log(res.status, await res.json());
```

Expected 403 response:
```json
{
  "code": "NOT_ADMIN",
  "message": "User is not an admin"
}
```

### Issue: Risk Events Not Created

**Causes:**
- User doesn't have `institution_id` in `users_extended`
- `high_risk` flag not set on check-in

**Debug:**
```sql
-- Check user profile
SELECT * FROM users_extended WHERE user_id = 'your-user-id';

-- If institution_id is NULL, populate it:
UPDATE users_extended
SET institution_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE user_id = 'your-user-id';
```

---

## SCALING NOTES (FUTURE)

### Multi-Institution Support

Schema already supports multiple institutions. To add new institution:

```sql
INSERT INTO institutions (name, country)
VALUES ('Royal College of Surgeons', 'Ireland');

-- Then create admin users for that institution
INSERT INTO admin_users (auth_uid, institution_id, email, full_name, role)
VALUES ('...', 'new-institution-id', '...', '...', 'admin');
```

### Escalation Workflow (Reserved)

`risk_events` has `is_escalated`, `escalation_reason` fields ready for future clinical referral workflow.

### Scheduled Insights Refresh

`institutional_insights` table designed for pre-computed insights. Can add:
- Nightly cron job to refresh insights
- Anomaly detection for unusual spikes
- Predictive flags (coming weeks)

---

## FINAL CHECKLIST

- [ ] INSTITUTIONAL_BACKEND_SCHEMA.sql executed in Supabase
- [ ] SUPABASE_SERVICE_ROLE_KEY set in environment
- [ ] Admin user seeded in admin_users table
- [ ] /api/checkin route tested (submits check-in, calculates risk)
- [ ] /api/admin/risk-queue route tested (returns flagged cases)
- [ ] /api/admin/trends route tested (returns cohort insights)
- [ ] /api/admin/mark-reviewed route tested (marks risk as reviewed)
- [ ] /admin dashboard accessible (requires admin auth)
- [ ] /admin/risk-queue page loads + displays flagged cases
- [ ] /admin/trends page loads + displays domain trends
- [ ] Mark as reviewed button works
- [ ] Risk engine triggers correctly (high_risk = true when score ≥ 7)
- [ ] No raw reflection text exposed in admin UI by default
- [ ] Institution scoping enforced (admin only sees own institution)
- [ ] GDPR compliance verified (no data export, anonymized insights)
- [ ] Error handling tested (missing auth, not admin, etc.)

---

## NEXT STEPS (PHASE 2+)

1. **Clinical Escalation Workflow**
   - Wire escalation form to counsellor notification
   - Track escalation history

2. **Data Export (Restricted)**
   - CSV export of anonymized trends (admin only)
   - Time-gated exports (weekly snapshots)

3. **Predictive Analytics**
   - Machine learning models on historical load patterns
   - Early warning for at-risk weeks

4. **Mobile App**
   - Student mobile check-in (same risk engine)
   - Push notifications for high-risk alerts (with consent)

5. **Institutional Customization**
   - Custom domains per institution (beyond 7 fixed MVP domains)
   - Configurable risk thresholds

---

## SUPPORT

Questions or issues? Contact: engineering@anchor.ie

---
