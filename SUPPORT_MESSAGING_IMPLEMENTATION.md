/**
 * ANKA SUPPORT MESSAGING SYSTEM
 * Governance-First Implementation Guide
 * 
 * This document outlines the complete support messaging architecture,
 * covering database setup, RLS policies, UI components, and operational procedures.
 */

# 1. DATABASE SETUP

## Step 1: Run Migration Scripts in Supabase

In your Supabase SQL Editor, run these scripts in order:

### a) Core Schema (SUPPORT_MESSAGING_SCHEMA.sql)
- Creates support_cases table
- Creates support_messages table
- Creates audit logging tables
- Implements auto-response trigger
- Implements risk detection trigger
- Implements retention cleanup

### b) RLS Policies (SUPPORT_MESSAGING_RLS.sql)
- Enables RLS on all support tables
- User can only view own cases
- Admin can only view assigned cases
- System messages visible to both parties
- Audit logs role-restricted
- All data immutable once created

### c) SLA Configuration
Insert initial configuration for your institution:

```sql
INSERT INTO support_sla_config (
  institution_id,
  service_hours_start_time,
  service_hours_end_time,
  service_days_of_week,
  first_response_sla_hours,
  follow_up_sla_hours,
  has_emergency_protocol,
  service_hours_display_text,
  expected_response_window_display
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000', -- NCE institution_id
  '09:00:00',
  '17:00:00',
  '{1,2,3,4,5}',
  24,
  48,
  true,
  'Mon–Fri, 9 AM–5 PM',
  'within 1 working day'
);
```

## Step 2: Verify Tables & Triggers

```sql
-- Check tables created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'support_%';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'support_%';

-- Check triggers
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_schema = 'public' AND event_object_table LIKE 'support_%';
```

---

# 2. API ENDPOINTS

## Support Case Management

### GET /api/admin/support-cases
**Admin only** - Returns cases assigned to authenticated admin
```
Headers: Authorization: Bearer {token}
Response:
{
  "success": true,
  "cases": [
    {
      "id": "uuid",
      "status": "open|assigned|scheduled|completed|closed|withdrawn",
      "requested_channel": "contact_me|request_call|email_resources|refer_to_support",
      "risk_tier": 0-3,
      "assigned_to": "admin_uuid",
      "created_at": "ISO8601",
      "first_response_at": "ISO8601|null",
      "unread_count": 0,
      "contains_risk": false
    }
  ]
}
```

### POST /api/support-messages/send
**User only** - Send message in own support case
```
Body: {
  "case_id": "uuid",
  "body": "message text"
}
Headers: Authorization: Bearer {token}
Response:
{
  "success": true,
  "message": {
    "id": "uuid",
    "case_id": "uuid",
    "sender_type": "user",
    "body": "message text",
    "contains_high_risk": false,
    "created_at": "ISO8601"
  }
}
```

### POST /api/admin/support-cases/[caseId]/respond
**Admin only** - Send response message
```
Body: {
  "body": "message text"
}
Headers: Authorization: Bearer {token}
Response:
{
  "success": true,
  "message": { ... }
}
```

### PATCH /api/admin/support-cases/[caseId]/status
**Admin only** - Update case status
```
Body: {
  "status": "assigned|scheduled|completed|closed|withdrawn"
}
Headers: Authorization: Bearer {token}
Response:
{
  "success": true,
  "case": { ... }
}
```

---

# 3. OPERATIONAL PROCEDURES

## Creating a Support Case (Integration Point)

When a user opts in during check-in with risk_tier >= 2:

```typescript
// In check-in flow, after getting consent:
const { data: supportCase, error } = await serviceClient
  .from('support_cases')
  .insert({
    user_id,
    institution_id,
    status: 'open',
    requested_channel: 'contact_me',
    consent_record_id,
    consent_version: '1.0',
    consent_timestamp: new Date().toISOString(),
    risk_tier,
    context_summary: `Check-in indicates risk_tier ${risk_tier}. Auto-response sent.`
  })
  .select()
  .single();

// Database trigger automatically sends system auto-response message
// No additional action needed
```

## Admin Workflow

1. **Check Inbox**
   - Navigate to /admin/support-inbox
   - View unassigned cases and your assigned cases

2. **Assign Case to Self**
   - Click a case from "Unassigned" section
   - System auto-assigns to you

3. **First Response**
   - Case state changes from "open" to "assigned"
   - first_response_at is automatically set
   - Send message via "Send Response" textarea

4. **During Messaging**
   - All messages are logged immutably
   - Risk detection happens automatically
   - User can message 24/7
   - You respond within your service hours

5. **Close Case**
   - Update status to "closed"
   - System sets expiration = 90 days from now
   - Messages remain visible until expiration
   - After 90 days, messages auto-delete via cleanup job

## User Workflow

1. **Opt-In During Check-In**
   - Check-in with risk detected
   - Support offer screen appears
   - User clicks "Yes, please have someone reach out"
   - Support case created automatically

2. **View Inbox**
   - Navigate to /support-inbox/[caseId]
   - Sees system auto-response message
   - Service hours and expectations clearly displayed
   - Emergency contacts always visible

3. **Send Messages**
   - Can send anytime
   - Risk language is flagged (not censored)
   - Messages are stored immutably
   - Responses come during service hours

4. **Close Case**
   - Admin marks case as closed
   - User can still view conversation history
   - Can start new case if needed

---

# 4. RISK DETECTION & ESCALATION

## Risk Flagging

**Non-Invasive Detection:**
- System detects high-risk keywords in messages
- Flag stored in database (contains_high_risk = true)
- Admin sees "⚠️ Risk Detected" badge in inbox
- Does NOT automatically escalate

**High-Risk Keywords:**
- suicidal, suicide, kill myself, end my life, end it
- self-harm, self harm, hurt myself, harm myself

## Escalation Protocol

**Institutional responsibility** - Define your own escalation:

Option A: Manual Review
- Admin sees risk flag in inbox
- Manual decision to escalate to emergency services
- Log decision in case notes

Option B: Automatic (Optional)
- Configure has_emergency_protocol = true in SLA
- System sends notification to override contact
- Institutional agreement must cover this

**Important:** System does NOT assume responsibility for 24/7 monitoring.

---

# 5. GDPR COMPLIANCE

## Data Minimization
- Only risk_tier stored (0-3), no raw check-in text
- Message content stored (for conversation), but can be redacted
- No automatic transcription or analysis

## Consent Tracking
- consent_record_id links case to explicit opt-in
- Consent version tracked
- User can withdraw consent (status = 'withdrawn')
- All consent events logged

## Data Export
- Users can request export of their cases & messages
- Implement via data export endpoint
- Return JSON with all case & message data

## Data Retention
- Messages deleted 90 days after case closure
- Audit logs retained for 180 days (institutional policy)
- Cleanup happens automatically via scheduled job

## Access Control
- RLS ensures users see only own cases
- Admins see only assigned cases
- Data officers can audit all cases
- Immutable logs prevent tampering

---

# 6. DEPLOYMENT CHECKLIST

- [ ] Run SUPPORT_MESSAGING_SCHEMA.sql in Supabase
- [ ] Run SUPPORT_MESSAGING_RLS.sql in Supabase
- [ ] Insert SLA config for your institution
- [ ] Deploy API endpoints (/api/support-messages/*, /api/admin/support-cases/*)
- [ ] Deploy UI pages (/admin/support-inbox/*, /support-inbox/*)
- [ ] Test admin inbox - can view assigned cases
- [ ] Test user inbox - can send message
- [ ] Test auto-response trigger - system message appears
- [ ] Test risk detection - flag appears on high-risk message
- [ ] Configure scheduled job for cleanup (optional, can run manually)
- [ ] Document service hours & SLA in institutional agreement

---

# 7. SERVICE HOURS & OPERATIONAL REALITY

**Critical:** Your SLA must match operational reality.

**Do NOT promise:**
- 24/7 monitoring
- Immediate response
- Live chat with counselor

**DO promise:**
- "Mon–Fri, 9 AM–5 PM service hours"
- "Response within 1 working day"
- "You can message anytime, we respond in service hours"
- Emergency contacts for crisis situations

**Your service_hours_display_text must be:**
1. Shown to users before they create case
2. Shown in the inbox UI
3. Mentioned in institutional contract
4. Actually enforced operationally

---

# 8. KEY GOVERNANCE PRINCIPLES

1. **Case-Based Messaging Only**
   - Admins cannot initiate contact outside a case
   - Prevents cold messaging
   - Matches opt-in consent

2. **Asynchronous, Not Live**
   - No real-time indicators (typing, online status)
   - No expectation of immediate response
   - Clear SLA display

3. **Immutable & Logged**
   - All messages permanent
   - No edits or deletions
   - Every action audited with IP/timestamp

4. **User Control**
   - Users can withdraw consent
   - Users can request data export
   - Users see service hours before messaging

5. **Institutional Alignment**
   - No silent monitoring implied
   - Escalation protocol matches contract
   - Burden of response on institution, not system

---

# 9. FUTURE ENHANCEMENTS

- Call scheduling integration (calendar sync)
- Email forwarding (async notifications)
- Message templates for common responses
- Feedback survey after case closure
- Analytics dashboard (aggregated, not individual)

