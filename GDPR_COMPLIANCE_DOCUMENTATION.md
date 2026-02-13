# GDPR COMPLIANCE DOCUMENTATION

## Overview

This document provides the compliance framework for the Anchor wellbeing platform, which processes special-category personal data (mental health/wellbeing information) under GDPR Article 9.

## Table of Contents

1. [Data Map](#data-map)
2. [Lawful Basis & Processing Conditions](#lawful-basis)
3. [DPIA Summary](#dpia-summary)
4. [Data Subject Rights](#data-subject-rights)
5. [Retention & Deletion](#retention)
6. [Security Controls](#security)
7. [Roles & Responsibilities](#roles)

---

## Data Map

### Data Classes

#### Class A: Operational Identifiers (Low Risk)
- **Data:** `user_id` (UUID), `session_id`, `institution_id`
- **Purpose:** System operation, access control
- **Retention:** Lifetime of account + 30 days
- **Storage:** `auth.users`, `users_extended`
- **Access:** System functions only

#### Class B: Derived Wellbeing Signals (Medium Risk)
- **Data:** Domain pressure scores, average intensity, cohort trends
- **Purpose:** Population insights, product quality monitoring
- **Retention:** Aggregated data 2 years, granular 90 days
- **Storage:** `cohort_aggregates`, `institutional_insights`
- **Access:** Admins (trends_viewer role), system analytics

#### Class C: High-Risk Safety Signals (High Risk)
- **Data:** `risk_tier` (0-3), `risk_reason_codes` (enums), confidence band
- **Purpose:** In-app safety interventions, opt-in support routing
- **Retention:** 90 days (auto-deletion enforced)
- **Storage:** `risk_events`
- **Access:** System only (NOT directly visible to admins)

#### Class D: Free Text Content (Very High Risk)
- **Data:** Check-in reflection text, chat messages, journal entries
- **Purpose:** Personalized insights, AI-powered support responses
- **Retention:** 90 days (30 days for crisis-related redacted excerpts)
- **Storage:** `weekly_checkin_responses`, `chat_messages`
- **Access:** User only + system processing (redacted excerpts in support requests)

---

## Lawful Basis & Processing Conditions

### GDPR Article 6 (Lawfulness)
**Primary basis:** Consent (Article 6(1)(a))

Users explicitly consent to:
1. Processing wellbeing data for personalized insights
2. Risk signal processing for safety interventions
3. Support request sharing (separate opt-in)

### GDPR Article 9 (Special Category Data)
**Processing condition:** Explicit consent (Article 9(2)(a))

We process mental health data (special category) ONLY with:
- Layered consent at onboarding
- Separate consent for support requests
- Versioned consent text with hash storage
- Granular consent withdrawal

### Purpose Limitation

**Allowed purposes:**
1. ✅ Population wellbeing signals (cohort trends)
2. ✅ Product safety & quality (detect broken flows)
3. ✅ User-requested support routing (opt-in only)

**Prohibited purposes:**
1. ❌ Crisis monitoring/surveillance
2. ❌ Identifying users from risk flags without consent
3. ❌ Sharing raw data with institutions by default

---

## DPIA Summary

### Data Protection Impact Assessment

**DPIA Required:** YES (high-risk processing)
- Special category data (mental health)
- Profiling/risk scoring
- New technology (AI-powered insights)
- Vulnerable population (students in distress)

### Risk Assessment

| Risk | Impact | Likelihood | Mitigation | Residual Risk |
|------|--------|------------|------------|---------------|
| Re-identification from pseudonymised IDs | High | Medium | K-anonymization, role-based access, audit logging | Low |
| Unauthorized admin access to crisis signals | High | Low | Consent-gated queue, no default risk exposure | Low |
| Data breach of self-harm content | Critical | Low | Field-level encryption, redaction, TTL enforcement | Medium |
| Lack of user control over data | High | Medium | Granular consent, withdrawal mechanism, DSAR automation | Low |
| Small cohort singling-out | Medium | Medium | K-threshold (min 10), suppress small-n breakdowns | Low |

### Safeguards Implemented

1. **Data Minimization:**
   - Risk events store enums, not raw text
   - Support requests redact sensitive keywords
   - Admins see summaries, not transcripts

2. **Purpose Separation:**
   - Separate tables for `risk_events` vs `support_requests`
   - No JOIN without consent check
   - Default admin view = trends only

3. **Technical Controls:**
   - Field-level encryption for sensitive text
   - Row-level security (RLS) in database
   - K-thresholding on cohort views
   - Automated TTL deletion

4. **Organizational Measures:**
   - Role-based access (4 admin roles)
   - Immutable audit log
   - Consent withdrawal honored immediately
   - Regular compliance reviews

---

## Data Subject Rights

### Implemented Rights

| Right | Implementation | API Endpoint |
|-------|----------------|--------------|
| **Access (Article 15)** | User dashboard shows all personal data | `/api/data/export` |
| **Rectification (Article 16)** | Edit profile, check-in history | `/api/data/update` |
| **Erasure (Article 17)** | Delete account button, 30-day retention | `/api/data/delete` |
| **Restrict Processing (Article 18)** | Pause risk scoring, keep minimal audit trail | `/api/data/restrict` |
| **Data Portability (Article 20)** | JSON export of all user data | `/api/data/export?format=json` |
| **Object (Article 21)** | Withdraw consent, stop processing | `/api/consent/withdraw` |

### Consent Withdrawal

When user withdraws consent:
1. Stop future processing in scope
2. Remove from support queue
3. Hide from admin visibility
4. Keep minimal audit evidence (legal obligation)
5. Don't retroactively delete historical aggregates

**Processing time:** Immediate (< 1 minute)

---

## Retention & Deletion

### Retention Policies

| Data Type | Retention Period | Rationale | Enforcement |
|-----------|------------------|-----------|-------------|
| Raw check-in text | 90 days | Sufficient for insights, minimize exposure | `expires_at` field + cron job |
| Risk events | 90 days | Short-term safety monitoring only | `expires_at` field + cron job |
| Support requests | 180 days after completion | Evidence of care duty, close case follow-up | Set `expires_at` on completion |
| Consent records | 7 years | Legal requirement (evidence of lawful processing) | Never auto-deleted |
| Aggregated stats | 2 years | Product improvement, k-anonymized | Manual review |
| Audit logs | 3 years | Accountability, investigation | Security requirement |

### Automated Deletion

**Function:** `cleanup_expired_records()`

**Schedule:** Daily at 2:00 AM UTC

**Actions:**
1. Delete `risk_events` where `expires_at < NOW()`
2. Delete `support_requests` where `expires_at < NOW()`
3. Delete `weekly_checkin_responses` where `expires_at < NOW()` AND not linked to active support request

**Testing:** Monthly verification query to ensure no orphaned data

---

## Security Controls

### Authentication & Access Control

1. **User Authentication:**
   - Supabase Auth (JWT tokens)
   - Session expiry: 24 hours
   - 2FA recommended for admins

2. **Admin Access:**
   - Bearer token authentication
   - Role-based permissions (4 tiers)
   - Least-privilege principle

3. **Service-Side Security:**
   - Service role key (server-side only, not in client)
   - Row-level security (RLS) enforced in database
   - API rate limiting

### Encryption

- **In transit:** TLS 1.3 (all API calls)
- **At rest:** AES-256 (Supabase default)
- **Field-level:** Planned for `support_requests.resolution_notes`

### Monitoring

- **Audit Logging:** All admin actions logged to `admin_audit_log`
- **Anomaly Detection:** Alert on unusual access patterns (e.g., >50 support requests viewed in 1 hour)
- **Incident Response:** 24-hour breach notification protocol

---

## Roles & Responsibilities

### Admin Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| `trends_viewer` | View cohort aggregates only | Default admin role, institutional insights |
| `support_agent` | View + respond to support requests | Handle student opt-in requests |
| `data_officer` | Run exports, handle DSARs | Legal/compliance team |
| `security_auditor` | Read-only audit logs | Security reviews |

**Break-Glass Access:**
- Time-limited elevation
- Requires reason input
- Triggers alert
- Recorded in immutable audit log

### Data Controller vs Processor

**Scenario 1: Institution Integration (Joint Controllers)**
- Anchor + Institution = joint controllers
- Data Sharing Agreement (DSA) required
- Institution sees only: cohort trends + opt-in support requests
- Institution cannot: re-identify users or access raw data

**Scenario 2: Direct-to-Student (Anchor as Controller)**
- Anchor = sole controller
- University not involved in data access
- Support requests remain pseudonymised

**Current Status:** Direct-to-student model (Anchor as controller)

---

## Implementation Checklist

### Before Launch

- [ ] Run `INSTALL_GDPR_COMPLIANT_SCHEMA.sql` in Supabase
- [ ] Test consent capture flow (check-in → support offer)
- [ ] Verify k-thresholding (test with <10 cohort)
- [ ] Test TTL enforcement (create expired record, run cleanup)
- [ ] Audit logging verification (view support request, check log)
- [ ] DSAR export test (request data export, verify completeness)
- [ ] Consent withdrawal test (withdraw → verify immediate effect)
- [ ] Security review (penetration test, RLS validation)

### Post-Launch

- [ ] Monitor audit logs weekly
- [ ] Review retention policies quarterly
- [ ] Update DPIA annually or on system changes
- [ ] User feedback on consent clarity
- [ ] Compliance training for admins

---

## Contact & Escalation

**Data Protection Officer (DPO):** [TO BE ASSIGNED]

**Incident Reporting:** dpo@anchor.ie (or internal contact)

**User Rights Requests:** privacy@anchor.ie

**Escalation Path:**
1. Support Agent → Data Officer → DPO
2. Breach detection → Immediate DPO notification
3. GDPR complaint → DPO + Legal (72-hour response)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-02-12 | System Architect | Initial GDPR-compliant framework |

---

## Appendices

### A. Consent Text Templates

**Wellbeing Processing Consent (v1.0):**
```
By proceeding, you consent to Anchor processing your wellbeing check-in responses 
to provide personalized insights and detect when you might benefit from additional 
support. We use AI to analyze patterns, but you remain in control. You can withdraw 
this consent at any time from Settings.
```

**Support Request Sharing Consent (v1.0):**
```
By clicking "Yes, please have someone reach out," you consent to sharing a redacted 
summary of your recent check-in with your institution's wellbeing team. A trained 
support staff member will be notified and may contact you to offer resources. 
This is voluntary and you can withdraw consent at any time.
```

### B. Data Export Format

**JSON Structure:**
```json
{
  "user_profile": {...},
  "checkin_history": [...],
  "risk_events": [...],
  "support_requests": [...],
  "consent_records": [...],
  "mood_entries": [...]
}
```

### C. Database Diagram

```
[users_extended] → [institution_id] → [institutions]
       ↓
[weekly_checkin_responses] → expires_at (90d TTL)
       ↓
[risk_events] → risk_tier (0-3), expires_at (90d TTL)
       ↓ (only if opt-in)
[consent_records] → consent_type
       ↓
[support_requests] → case_token, expires_at (180d after completion)
```

---

**END OF DOCUMENT**
