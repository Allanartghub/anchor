# ADD CONTACT MESSAGING TO SUPPORT REQUESTS

## Problem
The support requests queue shows pending requests, but admins had **no way to contact students**. You could only mark requests as "In Progress" or "Completed" without sending any messages.

## Solution
✅ **"Contact Student" button** now available  

When you click it:
1. Creates a support case (full messaging system)
2. Auto-assigns case to you
3. Redirects to message interface
4. Student can respond asynchronously
5. All messages are tracked & audited

---

## STEP 1: Run Database Migration

Copy this into Supabase SQL Editor and run:

**File:** [MIGRATION_ADD_CASE_ID_TO_SUPPORT_REQUESTS.sql](../MIGRATION_ADD_CASE_ID_TO_SUPPORT_REQUESTS.sql)

This adds the `case_id` column to link support requests ↔️ support cases.

```sql
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES support_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_requests_case_id_idx ON support_requests(case_id);
```

Verify it worked:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'support_requests' AND column_name = 'case_id';
```
Should return: `case_id`

---

## STEP 2: Test the New Flow

### Go to Support Requests Queue
- Navigate to: http://localhost:3000/admin/support-requests
- You should see pending requests

### Click "📧 Contact Student"
- Button should now appear (green button)
- Support case is created automatically
- You're redirected to /admin/support-inbox/[case_id]

### Now You Can Message
- You see the full conversation interface
- Student's initial request context is visible
- Type and send messages to the student
- Student receives notification
- Student can reply asynchronously

---

## WHAT CHANGED

### Before ❌
- Support Requests Queue only showed:
  - Request details
  - "Start Working" button
  - "Mark Completed" button
  - **No way to contact student**

### After ✅
- "📧 Contact Student" button:
  - Creates support case
  - Opens full messaging interface
  - Auto-assigns to you
  - Student can respond
  - All tracked in audit log

---

## HOW IT WORKS

**Flow Diagram:**
```
Support Request (Student opts-in)
    ↓
Admin clicks "📧 Contact Student"
    ↓
New Support Case created
    ↓
Admin redirected to case detail page
    ↓
Admin sends message
    ↓
Student sees message in their inbox
    ↓
Student can reply or close
    ↓
All messages & actions audited
```

---

## NEW API ENDPOINT

**POST** `/api/admin/support-requests/create-case`

Takes a support_request and creates a linked support_case.

**Request body:**
```json
{
  "request_id": "uuid-of-request",
  "case_token": "SR-ABC123",
  "context": "Student said they are feeling overwhelmed",
  "risk_tier": 2
}
```

**Response:**
```json
{
  "success": true,
  "case_id": "uuid-of-new-case",
  "message": "Support case created successfully"
}
```

---

## WHAT YOU CAN DO NOW

In the Support Requests Queue:

1. **📧 Contact Student** (pending requests)
   - Creates case
   - Opens messaging
   - Marked as "in progress"

2. **Mark In Progress**
   - Just changes status
   - Doesn't create case
   - Optional workflow

3. **Mark Completed** (in-progress requests)
   - Closes workflow
   - Marks as done
   - Can still view context

---

## STUDENT EXPERIENCE

When you send a message via "Contact Student":

1. Student sees notification (if app is configured for it)
2. Student navigates to `/support-inbox/[case_id]`
3. Student sees:
   - Service hours (Mon-Fri 9-5)
   - Emergency contacts (Samaritans, Pieta House)
   - Your message
   - Can reply anytime
   - "Not monitored 24/7" banner

---

## SUCCESS CRITERIA

✅ Migration runs without errors  
✅ "📧 Contact Student" button appears in pending requests  
✅ Clicking button creates support case  
✅ Redirects to /admin/support-inbox/[id]  
✅ Can type and send messages  
✅ Student sees message (test with second browser window)  

---

## IF SOMETHING GOES WRONG

**Error: "Column already exists"**
- This is fine - migration already ran
- Button should still work

**Error: "Support case creation failed"**
- Check: Is SUPPORT_MESSAGING_SCHEMA.sql migrated?
- Check: Does support_cases table exist?
- Check: Are RLS policies applied?

**Button doesn't appear**
- Check: Did you refresh the page? (hard refresh: Ctrl+Shift+R)
- Check: Are you logged in as admin?
- Check: Is the request status "pending"?

**Messages not appearing**
- Check: Navigate to the case URL directly
- Check: Can you see auto-response from system?
- Check: Try sending message again

---

## Next Steps

After this works:
1. Test full flow: Request → Contact → Message → Response
2. Test with different risk tiers (R0, R2, R3)
3. Verify audit logs record all actions
4. Train admin team on new workflow
5. Monitor for any issues

---

## Files Modified

- ✅ `app/admin/support-requests/page.tsx` - Added "Contact Student" button
- ✅ `app/api/admin/support-requests/create-case/route.ts` - New endpoint
- ✅ `MIGRATION_ADD_CASE_ID_TO_SUPPORT_REQUESTS.sql` - New migration

