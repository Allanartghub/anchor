# Support Case Assignment Flow

## Overview
Support cases now follow a **first-responder assignment model** where cases stay in an **open pool** until an admin sends the first response.

## Workflow

### 1. Case Creation (User Opts In)
**Location:** `app/api/consent/create-support-request/route.ts`

When a user sends a high-risk message and opts in to be contacted:
```javascript
support_cases.insert({
  user_id,
  institution_id,
  status: 'open',           // Case is open for any admin
  assigned_to: null,        // Unassigned (open pool)
  requested_channel,
  risk_tier,
  ...
})
```

### 2. Admin Views Inbox
**Location:** `app/admin/support-inbox/page.tsx`

Admins can filter cases by:
- **My Cases**: Shows cases assigned to current admin (active cases only)
- **Unassigned**: Shows `open` cases where `assigned_to IS NULL`
- **All Cases**: Shows all cases

### 3. First Admin Response (Auto-Assignment)
**Location:** `app/api/admin/support-cases/[caseId]/respond/route.ts`

When any admin sends the **first message** to an unassigned case:

```javascript
// Step 1: Auto-assign to first responder
if (!supportCase.assigned_to) {
  await client
    .from('support_cases')
    .update({
      assigned_to: adminResult.auth_uid,  // Assign to responding admin
    })
    .eq('id', caseId);
}

// Step 2: Insert the message
await client.from('support_messages').insert({
  case_id: caseId,
  sender_type: 'admin',
  sender_id: adminResult.auth_uid,
  body,
});

// Step 3: Mark as responded and set status
if (!supportCase.first_response_at) {
  await client
    .from('support_cases')
    .update({
      first_response_at: new Date().toISOString(),
      status: 'assigned',
    })
    .eq('id', caseId);
}
```

**Result:** Case moves from **Unassigned** to **My Cases** for that admin.

### 4. Subsequent Responses
Only the **assigned admin** can send further messages. Other admins are blocked:

```javascript
if (supportCase.assigned_to !== adminResult.auth_uid) {
  return NextResponse.json(
    { error: 'Case already assigned to another admin' },
    { status: 403 }
  );
}
```

## Benefits

✅ **Fair distribution**: Any admin can claim a case by responding first  
✅ **No pre-assignment**: Cases don't sit idle waiting for a specific admin  
✅ **Ownership accountability**: Once claimed, the admin is responsible for that case  
✅ **Audit trail**: All assignment events are logged with admin IDs and timestamps

## Technical Details

### RLS Policy
Admins can view:
- Cases assigned to them (`assigned_to = auth.uid()`)
- Unassigned open cases (`assigned_to IS NULL AND status = 'open'`)

### Status Lifecycle
```
open → assigned → [scheduled] → completed → closed
         ↑
    First admin response
```

### Key Fields
- `assigned_to`: NULL until first response, then set to admin ID
- `first_response_at`: Timestamp of first admin message
- `status`: 'open' (unassigned) → 'assigned' (claimed)

## Testing Checklist

- [ ] User opts in and case appears in **Unassigned** tab
- [ ] Admin A responds → case moves to Admin A's **My Cases**
- [ ] Admin B tries to respond to same case → receives error
- [ ] Case appears in Admin A's inbox with correct status badge
- [ ] `first_response_at` is set correctly on first response
- [ ] Audit log records assignment event with correct admin ID
