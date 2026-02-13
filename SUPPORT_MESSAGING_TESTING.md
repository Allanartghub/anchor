/**
 * SUPPORT MESSAGING - LOCAL TESTING GUIDE
 * 
 * This guide walks you through testing the support messaging system end-to-end.
 * Prerequisites: 
 * - Dev server running on localhost:3000
 * - Database migrations completed in Supabase
 * - You have a test user account
 * - You have an admin account
 */

# TEST PLAN

## BEFORE TESTING - Database Setup

1. **Run Migrations in Supabase SQL Editor** (in order):
   - SUPPORT_MESSAGING_SCHEMA.sql
   - SUPPORT_MESSAGING_RLS.sql
   - SUPPORT_MESSAGING_SLA_CONFIG.sql

2. **Verify Tables Created**:
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE schemaname = 'public' AND tablename LIKE 'support_%'
   ORDER BY tablename;
   ```
   Should return:
   - support_case_participants
   - support_cases
   - support_messages
   - support_messages_audit_log
   - support_sla_config

3. **Verify SLA Config Inserted**:
   ```sql
   SELECT service_hours_display_text, expected_response_window_display 
   FROM support_sla_config;
   ```

---

## TEST 1: Create Support Case Manually (Quick Test)

Instead of going through the full check-in → risk detection → opt-in flow, create a case directly:

### Step 1: Get Your User ID
1. Log in as a student at http://localhost:3000/login
2. Open browser Dev Tools (F12)
3. Go to Console and run:
   ```javascript
   const { data } = await supabase.auth.getSession();
   console.log(user_id: data.session.user.id);
   ```
4. Copy the user_id (looks like: `12345678-abcd-efgh-ijkl-987654321abc`)

### Step 2: Create Consent Record
1. In Supabase SQL Editor, run:
   ```sql
   INSERT INTO consent_records (
     user_id,
     consent_type,
     consent_version,
     consent_text_hash,
     granted
   ) VALUES (
     '12345678-abcd-efgh-ijkl-987654321abc',  -- YOUR user_id from step 1
     'support_request_sharing',
     '1.0',
     'test_hash',
     true
   )
   RETURNING id;
   ```
2. Copy the returned consent record ID

### Step 3: Create Support Case
1. In Supabase SQL Editor, run:
   ```sql
   INSERT INTO support_cases (
     user_id,
     institution_id,
     status,
     requested_channel,
     consent_record_id,
     consent_version,
     consent_timestamp,
     risk_tier
   ) VALUES (
     '12345678-abcd-efgh-ijkl-987654321abc',           -- YOUR user_id
     '550e8400-e29b-41d4-a716-446655440000',          -- NCE institution
     'open',
     'contact_me',
     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',           -- consent_record_id from above
     '1.0',
     NOW(),
     3
   )
   RETURNING id;
   ```
2. Copy the returned case_id

### Step 4: Verify Auto-Response Message
1. Run this query:
   ```sql
   SELECT sender_type, message_type, body 
   FROM support_messages 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   You should see:
   - sender_type: 'system'
   - message_type: 'system_auto_response'
   - body: Contains "Thanks for reaching out..." message

---

## TEST 2: User Inbox (Student View)

### Step 1: Access User Inbox
1. Navigate to: http://localhost:3000/support-inbox/[CASE_ID]
   - Replace [CASE_ID] with the case_id from TEST 1

### Step 2: Verify Display Elements
You should see:
- ✅ Case header
- ✅ Service hours notice (blue box at top)
  - "Service Hours: Mon–Fri, 9 AM–5 PM"
  - "Expected Response: within 1 working day"
  - "📱 Not monitored 24/7"
- ✅ Emergency contacts (red box)
  - Samaritans Ireland: 116 123
  - Pieta House: 1800 247 247
  - Crisis Text Line
- ✅ Message history
  - System auto-response message visible

### Step 3: Test Sending Message
1. Scroll to bottom
2. In "Send a Message" textarea, enter:
   ```
   I've been having a really difficult week. 
   The academic load is overwhelming.
   ```
3. Click "Send Message"
4. Verify:
   - ✅ Message appears in conversation (blue bubble on left)
   - ✅ Message sender shows "You"
   - ✅ Timestamp appears

### Step 4: Test Risk Detection
1. Send another message with high-risk keyword:
   ```
   I'm feeling suicidal and don't know what to do
   ```
2. Verify:
   - ✅ Message appears normally
   - ✅ Yellow warning banner appears above message:
     - "⚠️ We notice your message contains concerning language..."
     - "If you're in immediate distress..."

---

## TEST 3: Admin Inbox

### Step 1: Get Admin User ID
1. Log in as an admin account (if you have one)
   - Or ask your institution admin for credentials
2. Open Dev Tools (F12) → Console:
   ```javascript
   const { data } = await supabase.auth.getSession();
   console.log(data.session.user.id);
   ```
3. Copy the admin user_id

### Step 2: Assign Case to Admin
1. In Supabase SQL Editor:
   ```sql
   UPDATE support_cases 
   SET assigned_to = 'xxxxxxxx-admin-user-id-here'
   WHERE id = 'your-case-id-here';
   ```

### Step 3: Access Admin Inbox
1. Navigate to: http://localhost:3000/admin/support-inbox
2. Verify:
   - ✅ Page loads
   - ✅ Service hours notice visible at top
   - ✅ Filter tabs visible: "My Cases", "Unassigned", "All Cases"
   - ✅ Your case appears with:
     - Case ID
     - Status badge ("Assigned")
     - Channel ("contact_me")
     - Risk tier if present ("R3 - Active Intent")
     - Unread message count (1)
     - "View Case →" button

### Step 4: Open Case Detail
1. Click on your case
2. Navigate to: http://localhost:3000/admin/support-inbox/[CASE_ID]
3. Verify:
   - ✅ Case header shows ID and status
   - ✅ If R3 risk: Red risk banner appears
   - ✅ Full message history visible
   - ✅ User messages show with "👤 User" label
   - ✅ System messages show as "🤖 System Message"

### Step 5: Test Admin Response
1. Scroll to "Send Response" form
2. Enter message:
   ```
   Hi there,
   
   Thank you for reaching out. We've received your request 
   and a member of our wellbeing team will be in touch 
   within one working day.
   
   In the meantime, please don't hesitate to reach out 
   to the crisis resources if you need immediate support.
   
   Best,
   Wellbeing Team
   ```
3. Click "Send Message"
4. Verify:
   - ✅ Message appears in green box (admin message)
   - ✅ Sender shows "👨‍💼 You"
   - ✅ Case status auto-updates to "Assigned"
   - ✅ first_response_at is set in database

### Step 6: Test Status Update
1. In "Update Status" dropdown:
   - Select "Mark as Scheduled"
2. Verify:
   - ✅ Case status badge changes to "Scheduled" (purple)
3. Try other statuses:
   - "Mark as Completed"
   - "Close Case" (status changes to gray, case locked)

---

## TEST 4: Risk Detection Verification

### Verify Risk Flag in Database
1. In Supabase SQL Editor:
   ```sql
   SELECT id, sender_type, body, contains_high_risk, risk_detected_at
   FROM support_messages
   WHERE case_id = 'your-case-id'
   ORDER BY created_at;
   ```
2. Verify:
   - ✅ Messages with suicide/self-harm keywords have: `contains_high_risk = true`
   - ✅ Other messages have: `contains_high_risk = false`
   - ✅ `risk_detected_at` is set for flagged messages

---

## TEST 5: Audit Log Verification

### Check That All Actions Are Logged
1. In Supabase SQL Editor:
   ```sql
   SELECT action_type, action_details, admin_user_id, created_at
   FROM support_messages_audit_log
   WHERE case_id = 'your-case-id'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
2. You should see action_type entries for:
   - ✅ 'case_created' - initial case creation
   - ✅ 'message_sent' - user/admin messages
   - ✅ 'message_flagged_for_risk' - risk detections
   - ✅ 'case_assigned' or 'case_scheduled' - status changes
   - ✅ 'case_closed' - case closure

---

## TEST 6: RLS (Row Level Security) Verification

### Test 1: User Can't See Other User's Cases
1. Log in as User A
2. Try to access a case created by User B:
   ```
   http://localhost:3000/support-inbox/[User-B-Case-ID]
   ```
3. Verify:
   - ❌ Should show "Case not found" or 403 error
   - ✅ RLS is working

### Test 2: Admin Can Only See Assigned Cases
1. Log in as Admin A
2. Go to /admin/support-inbox
3. Should only see cases with `assigned_to = Admin A`
4. Log in as Admin B
5. Should see different cases (those assigned to Admin B)
6. Verify:
   - ✅ Each admin sees only their assigned cases

### Test 3: Messages Are Immutable
In browser Dev Tools Console:
```javascript
// Try to delete a message (should fail silently or error)
const { error } = await supabase
  .from('support_messages')
  .delete()
  .eq('id', 'message-id-here');

console.log(error); // Should show RLS violation
```

---

## EXPECTED BEHAVIOR SUMMARY

### User Flow ✅
1. User submits check-in with risk detected
2. Support offer screen appears (from WeeklyCheckinFlow.tsx)
3. User opts-in → support case created
4. Navigate to /support-inbox/[id]
5. User sees service hours, emergency resources
6. User sends messages anytime
7. System detects risky language but doesn't censor
8. User can view institutional response

### Admin Flow ✅
1. Admin navigates to /admin/support-inbox
2. Admin sees unassigned & assigned cases
3. Admin clicks case → case detail page
4. Admin forms auto-response from system visible
5. Admin sends response message
6. case.first_response_at gets set
7. Admin can update status (scheduled → completed → closed)
8. Closed cases expire after 90 days

### Governance ✅
- Service hours always displayed
- Not 24/7 monitored clearly stated
- Emergency contacts always visible
- Risk flagging (not censoring)
- Immutable audit trail
- RLS prevents data leakage

---

## DEBUGGING CHECKLIST

If something doesn't work:

1. **Cases not loading**
   - Check: Did you run SUPPORT_MESSAGING_SCHEMA.sql?
   - Check: Are tables created? `SELECT tablename FROM pg_tables WHERE tablename LIKE 'support_%';`

2. **Admin can't see cases**
   - Check: Is case assigned_to correct? `SELECT assigned_to FROM support_cases;`
   - Check: Does admin_users record exist? `SELECT * FROM admin_users WHERE auth_uid = 'admin-id';`

3. **Messages not appearing**
   - Check: Is case_id correct?
   - Check: Can you see in DB? `SELECT * FROM support_messages WHERE case_id = 'id';`

4. **RLS blocking access**
   - Check: User/admin ID matches?
   - Check: RLS policies created? `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'support_%';`

5. **Auto-response not sent**
   - Check: Did trigger create system message? `SELECT * FROM support_messages WHERE sender_type = 'system';`
