# ANCHOR INSTITUTIONAL BACKEND – ADMIN SETUP (MVP)

## Quick Start: Admin Onboarding

### Prerequisites
- Your environment has `ADMIN_SECRET_KEY` set (see below)
- You have Supabase project configured

---

## Setup Steps

### 1. Set Admin Secret Key

Add to `.env.local`:
```
ADMIN_SECRET_KEY=your-secret-key-here
```

**Recommendation:** Use a strong random key for production.
```bash
# Generate a secure key (macOS/Linux)
openssl rand -hex 32

# Or use PowerShell (Windows)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 2. First Admin Signup

**Person A (wants to become admin):**

1. Go to `http://localhost:3000/login`
2. Enter email → click magic link
3. Redirected to `/dashboard` (student view)
4. Go to `http://localhost:3000/admin/setup`
5. Enter:
   - Full Name: e.g., "Sarah O'Brien"
   - Admin Secret Key: (from your .env.local or shared by admin)
6. Click "Create Admin Account"
7. Sign out
8. Sign in again with same email
9. **Auth callback detects admin** → redirected to `/admin` ✓

---

## Admin Setup Endpoint

### Endpoint: `POST /api/admin/create`

**Request:**
```json
{
  "email": "admin@nci.ie",
  "full_name": "Sarah O'Brien",
  "auth_uid": "550e8400-e29b-41d4-a716-446655440001",
  "admin_secret_key": "your-secret-key"
}
```

**Response (Success):**
```json
{
  "success": true,
  "admin": {
    "id": "...",
    "email": "admin@nci.ie",
    "full_name": "Sarah O'Brien",
    "role": "counsellor",
    "institution_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "message": "Admin created. Sign in again to access /admin"
}
```

**Response (Error):**
```json
{
  "error": "Invalid secret key"
}
```

---

## Admin Setup Page

**URL:** `http://localhost:3000/admin/setup`

**Flow:**
1. User signs in once (to get auth_uid)
2. Navigates to /admin/setup
3. Enters full name + secret key
4. Submits form
5. Backend creates admin_users record
6. User logs out + back in
7. Auth callback detects admin role → redirects to /admin

---

## Roles (MVP)

All new admins start as **`counsellor`** role.

**Role hierarchy:**
- `counsellor` — View risk queue + trends for their institution
- `lead` — (Reserved for future; same access as counsellor MVP)
- `admin` — (Reserved for future; full access)

To promote an admin (requires direct DB access for now):
```sql
UPDATE admin_users
SET role = 'lead'
WHERE email = 'admin@nci.ie';
```

---

## Security Notes

### MVP Protection
- Endpoint protected by `ADMIN_SECRET_KEY` environment variable
- Only works if key is set (will return 500 if not configured)
- Key must match exactly (no rate limiting in MVP)

### Production Considerations
- Add rate limiting to prevent brute force
- Require existing admin to invite new admin (instead of secret key)
- Implement audit logging for admin creation
- Add email verification before admin account active
- Expire admin secret key after first use

---

## Troubleshooting

### "Admin creation not configured"
- **Cause:** `ADMIN_SECRET_KEY` not set in environment
- **Fix:** Add to `.env.local` and restart server

### "Invalid secret key"
- **Cause:** Secret key submitted doesn't match `ADMIN_SECRET_KEY`
- **Fix:** Double-check key spelling/formatting

### "User is not an admin" (after setup)
- **Cause:** Need to sign in again for auth callback to detect new admin role
- **Fix:** Sign out completely + sign back in

---

## Demo Testing

To quickly test admin flow locally:

```bash
# 1. Set a simple secret key in .env.local
ADMIN_SECRET_KEY=demo-secret-123

# 2. Start server
npm run dev

# 3. Sign in with test email
# 4. Go to http://localhost:3000/admin/setup
# 5. Enter full name + "demo-secret-123"
# 6. Submit
# 7. Sign out and back in
# 8. Should see /admin dashboard
```

---

## Next Phase

For production MVP+, implement:

1. **Admin invite workflow**
   - Existing admin creates invite link
   - New admin clicks link → auto-fills secret
   - One-time use invite codes

2. **Role management**
   - UI to promote admin (counsellor → lead → admin)
   - Permission enforcement per role

3. **Audit logging**
   - admin_audit_log table tracks all admin actions
   - Who created/modified which admin account
   - When admin last accessed dashboard

4. **Institution hierarchy**
   - Multi-institution admins (lead can manage multiple institutions)
   - Super-admin (only in production, strict governance)

---
