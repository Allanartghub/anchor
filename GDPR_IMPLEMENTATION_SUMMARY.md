# GDPR-COMPLIANT REDESIGN: Implementation Summary

## Executive Summary

The Anchor admin system has been completely redesigned to comply with GDPR requirements for processing special-category personal data (mental health information). The system now enforces:

1. **Purpose limitation:** Trends vs. support requests separation
2. **Data minimization:** Risk tiers (enums) instead of raw text storage
3. **Consent requirements:** Explicit opt-in for support contact
4. **K-anonymization:** Minimum cohort size thresholds
5. **Audit logging:** Immutable records of admin actions
6. **Retention enforcement:** Automated TTL-based deletion

---

## What Changed

### 1. Database Schema (BREAKING CHANGES)

**Old Schema Issues:**
- `risk_events` stored raw `trigger_reasons` JSON
- `weekly_checkin_responses` had direct risk fields
- No consent tracking
- No support request separation
- No TTL enforcement

**New Schema (`INSTALL_GDPR_COMPLIANT_SCHEMA.sql`):**
```sql
✅ consent_records table (explicit opt-in tracking)
✅ support_requests table (opt-in only, pseudonymised case tokens)
✅ risk_events redesigned (risk_tier 0-3, enumerated codes, TTL)
✅ cohort_aggregates table (k-anonymized trends)
✅ admin_audit_log table (immutable logging)
✅ cleanup_expired_records() function (automated deletion)
✅ has_active_consent() helper function
```

**Migration Required:** Yes (see [Migration Guide](#migration-guide))

---

### 2. Admin Dashboard Redesign

**Old Behavior:**
- Default view showed "risk queue" with flagged cases
- Auto-populated from risk scoring (no consent)
- Individual student identifiers visible

**New Behavior:**
- Default view = **Cohort Trends** (k-anonymized)
- Minimum cohort size = 10 (k-threshold)
- No individual cases without opt-in

**Files Changed:**
- `app/admin/page.tsx` - Rewritten for trends-only
- `components/AdminNav.tsx` - Updated nav structure
- `app/api/admin/cohort-aggregates/route.ts` - New endpoint

---

### 3. Support Requests Queue (Opt-In Only)

**New Functionality:**
- Separate page: `/admin/support-requests`
- Shows ONLY cases where student clicked "Request Support"
- Pseudonymised case tokens (e.g., `SR-A3F9B2C1`)
- Context excerpts auto-redacted (removes self-harm keywords)
- Status tracking: pending → in_progress → completed
- TTL: 180 days after completion

**Files Created:**
- `app/admin/support-requests/page.tsx` - Queue UI
- `app/api/admin/support-requests/route.ts` - CRUD operations

---

### 4. Consent Capture in Check-In Flow

**New Step: "Support Offer" (Conditional)**
- Shown ONLY if `risk_tier >= 2` (R2: support-eligible, R3: priority)
- Displays in-app crisis resources (Samaritans, Pieta House)
- Offers opt-in button: "Yes, please have someone reach out"
- Alternative: "No thanks, I'm okay for now"

**Flow:**
```
Check-in → Risk Assessment → [If R2+] Support Offer → Summary
                               ↓ (if opt-in)
                        Create Consent Record
                               ↓
                        Create Support Request
```

**Files Changed:**
- `components/WeeklyCheckinFlow.tsx` - Added `support-offer` step
- `app/api/consent/create-support-request/route.ts` - New endpoint

---

### 5. Risk Scoring Updates

**Old Behavior:**
- Stored `risk_score` (int) and `high_risk` (boolean)
- Stored full `trigger_reasons` as JSON

**New Behavior:**
- Stores `risk_tier` (0-3):
  - R0: Normal distress
  - R1: Elevated (vulnerability signals)
  - R2: Support-eligible (passive ideation)
  - R3: Priority (active intent indicators)
- Stores `risk_reason_codes` (string array):
  - `self_harm_keywords`
  - `intensity_spike`
  - `sustained_high_intensity`
  - `high_intensity_current`
- Includes `confidence_band` (low/medium/high)
- Includes `model_version` for tracking

**Files Changed:**
- `app/api/checkin/route.ts` - Updated risk persistence logic

---

### 6. K-Thresholding on Cohort Views

**Implementation:**
- `K_THRESHOLD = 10` (minimum cohort size)
- Dashboard checks cohort size before displaying
- Shows warning if below threshold: "Insufficient Data for Display"
- Prevents small-n disclosure (e.g., "1 student with anxiety")

**Files:**
- `app/admin/page.tsx` - Cohort size check
- `app/api/admin/cohort-aggregates/route.ts` - Returns `belowThreshold` flag

---

### 7. Audit Logging Infrastructure

**What's Logged:**
- Admin action type (e.g., `view_support_requests`, `update_support_request`)
- Resource accessed (e.g., `support_request`, `trend_data`)
- Timestamp
- Admin user ID
- IP address (optional)
- Action details (JSON)

**Table:** `admin_audit_log` (immutable)

**Files:**
- `app/api/admin/support-requests/route.ts` - Logs view/update actions
- Schema includes audit_log table

---

## Migration Guide

### Step 1: Backup Existing Data

```sql
-- In Supabase SQL Editor
CREATE TABLE risk_events_backup AS SELECT * FROM risk_events;
CREATE TABLE weekly_checkin_responses_backup AS SELECT * FROM weekly_checkin_responses;
```

### Step 2: Run New Schema

```sql
-- Copy entire contents of INSTALL_GDPR_COMPLIANT_SCHEMA.sql
-- Paste in Supabase SQL Editor
-- Execute
```

**WARNING:** This will drop and recreate `risk_events` table. Old risk events will NOT be migrated (by design - they don't meet GDPR requirements).

### Step 3: Backfill Consent Records (Optional)

```sql
-- For existing users, create implied consent records
-- (Only if you have legal basis to do so)
INSERT INTO consent_records (user_id, consent_type, consent_version, consent_text_hash, granted)
SELECT 
  id as user_id,
  'wellbeing_processing' as consent_type,
  '1.0' as consent_version,
  'MIGRATION_BACKFILL' as consent_text_hash,
  TRUE as granted
FROM auth.users
WHERE id IN (SELECT DISTINCT user_id FROM weekly_checkin_responses);
```

### Step 4: Update Admin Roles

```sql
-- Rename old roles to new GDPR-compliant roles
UPDATE admin_users SET role = 'trends_viewer' WHERE role = 'counsellor';
UPDATE admin_users SET role = 'support_agent' WHERE role = 'lead';
UPDATE admin_users SET role = 'data_officer' WHERE role = 'admin';
```

### Step 5: Deploy Code Changes

```bash
# Commit all changes
git add .
git commit -m "GDPR-compliant admin redesign"

# Deploy to production
# (Your deployment process here)
```

### Step 6: Enable Automated Cleanup

**If using Supabase with pg_cron extension:**

```sql
-- Schedule daily cleanup at 2:00 AM UTC
SELECT cron.schedule(
  'cleanup-expired-records',
  '0 2 * * *',
  'SELECT cleanup_expired_records()'
);
```

**If pg_cron not available:**
- Set up external cron job to call cleanup SQL
- OR implement in application code

---

## Testing Checklist

### Before Go-Live

- [ ] **Schema Migration:**
  - Run INSTALL_GDPR_COMPLIANT_SCHEMA.sql in dev environment
  - Verify all tables created
  - Check NCI institution exists (UUID `550e8400-e29b-41d4-a716-446655440000`)

- [ ] **K-Threshold Test:**
  - Create dev environment with <10 users
  - Access `/admin` dashboard
  - Verify "Insufficient Data" message shown

- [ ] **Consent Flow Test:**
  - Submit check-in with high intensity (5) + self-harm keywords
  - Verify support offer step appears
  - Click "Yes, please have someone reach out"
  - Verify consent record created in database
  - Verify support request appears in `/admin/support-requests`

- [ ] **Redaction Test:**
  - Create support request with text containing "suicidal"
  - Check `support_requests.context_excerpt` in database
  - Verify keyword replaced with `[REDACTED]`

- [ ] **TTL Enforcement:**
  - Manually set `expires_at` to past date on test record
  - Run `SELECT cleanup_expired_records();`
  - Verify record deleted

- [ ] **Audit Logging:**
  - Login as admin
  - View support requests queue
  - Check `admin_audit_log` table
  - Verify entry with action_type = 'view_support_requests'

- [ ] **Role-Based Access:**
  - Create admin with `trends_viewer` role
  - Verify can access `/admin` (trends)
  - Create admin with `support_agent` role
  - Verify can access `/admin/support-requests`

---

## API Endpoints Reference

### New Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/admin/cohort-aggregates` | GET | K-anonymized cohort trends | Admin (any role) |
| `/api/admin/support-requests` | GET | Opt-in support queue | Admin (support_agent+) |
| `/api/admin/support-requests` | PATCH | Update support request status | Admin (support_agent+) |
| `/api/consent/create-support-request` | POST | Student opts in for support | User (Bearer token) |

### Modified Endpoints

| Endpoint | Changes |
|----------|---------|
| `/api/checkin` | Now returns `risk_tier` (0-3) instead of just `high_risk` boolean |

### Deprecated Endpoints

| Endpoint | Reason | Replacement |
|----------|--------|-------------|
| `/api/admin/risk-queue` | Violates GDPR (auto-populates without consent) | `/api/admin/support-requests` |
| `/api/admin/mark-reviewed` | Old risk queue workflow | PATCH `/api/admin/support-requests` |
| `/api/admin/history` | No consent verification | Removed (use support requests only) |

---

## UI/UX Changes for Users

### Student Experience

**Before:**
1. Complete check-in → Done

**After:**
1. Complete check-in
2. **[If elevated distress detected]** See support offer screen with:
   - Crisis helpline numbers
   - Option to request institutional contact
3. Choose: "Request support" OR "I'm okay"
4. Done

**Improvement:** Students now have agency in requesting help rather than being passively monitored.

---

### Admin Experience

**Before:**
1. Login → See "Risk Queue" with auto-flagged cases
2. Click case → See full check-in text
3. Add notes via browser prompt()

**After:**
1. Login → See **Cohort Trends** (k-anonymized)
   - Top pressure domains
   - Average intensity
   - Aggregated risk tier counts
2. Navigate to **Support Requests** (separate tab)
3. See ONLY opt-in requests with:
   - Pseudonymised case tokens (SR-...)
   - Redacted context excerpts
   - Risk tier labels (R0-R3)
4. Add resolution notes in inline textarea
5. Mark as "In Progress" → "Completed"

**Improvement:** Clear separation of purposes, consent-driven workflow, better privacy protection.

---

## Known Limitations & Future Work

### Current Limitations

1. **No Field-Level Encryption Yet:**
   - `support_requests.resolution_notes` should be encrypted
   - Planned for v1.1

2. **No Automated DSAR Export:**
   - `/api/data/export` endpoint not implemented yet
   - Manual SQL export required for now

3. **No Consent Withdrawal UI:**
   - Users can't withdraw consent from settings yet
   - Must contact support

4. **K-Threshold Hardcoded:**
   - `K_THRESHOLD = 10` is hardcoded
   - Should be configurable per institution

### Roadmap

- **Phase 2:** User data export + deletion UI
- **Phase 3:** Field-level encryption
- **Phase 4:** Multi-institution support with proper DSAs
- **Phase 5:** Advanced anomaly detection on audit logs

---

## Support & Troubleshooting

### Common Issues

**Issue: "Insufficient Data for Display" on dashboard**
- **Cause:** Cohort size < 10 (k-threshold)
- **Fix:** This is intentional. Wait for more check-ins or lower threshold in dev (not recommended for production)

**Issue: Support requests not appearing in queue**
- **Cause:** User didn't opt in, or consent_record_id foreign key constraint failed
- **Fix:** Check `consent_records` table, verify FK relationship

**Issue: Old risk_events still visible**
- **Cause:** TTL cleanup not running
- **Fix:** Manually run `SELECT cleanup_expired_records();` or check cron job

**Issue: Admin sees 403 Forbidden**
- **Cause:** Role doesn't have permission for endpoint
- **Fix:** Check `admin_users.role` matches endpoint requirements

---

## Compliance Sign-Off

Before deploying to production:

- [ ] Legal team reviewed GDPR_COMPLIANCE_DOCUMENTATION.md
- [ ] Data Protection Officer (DPO) approved approach
- [ ] Privacy Policy updated to reflect new consent flows
- [ ] Terms of Service include consent withdrawal rights
- [ ] Admin training completed on new system
- [ ] Incident response plan updated
- [ ] DPIA signed off

---

## Contact

**Technical Questions:** [System Architect]
**Compliance Questions:** [DPO / Legal Team]
**User Support:** support@anchor.ie

---

**Document Version:** 1.0  
**Last Updated:** 2025-02-12  
**Next Review:** 2025-08-12 (6 months)
