# URGENT: DATABASE MIGRATIONS REQUIRED

## 🚀 STEP-BY-STEP DATABASE SETUP

### Prerequisites
- Open Supabase dashboard for your institution
- Go to SQL Editor
- Have these 3 SQL files ready to copy:
  1. SUPPORT_MESSAGING_SCHEMA.sql (tables, triggers, functions)
  2. SUPPORT_MESSAGING_RLS.sql (row-level security policies)
  3. SUPPORT_MESSAGING_SLA_CONFIG.sql (service level agreement config)

---

## IMPLEMENTATION STEPS

### ✅ STEP 1: Run SUPPORT_MESSAGING_SCHEMA.sql

1. Open [Supabase Dashboard](https://supabase.com/)
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **+ New Query**
5. Copy-paste **entire contents** of `SUPPORT_MESSAGING_SCHEMA.sql`
6. Click **Run** (top-right)
7. Wait for success message
8. **Verify** tables were created:
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

---

### ✅ STEP 2: Run SUPPORT_MESSAGING_RLS.sql

1. Go back to SQL Editor
2. Click **+ New Query**
3. Copy-paste **entire contents** of `SUPPORT_MESSAGING_RLS.sql`
4. Click **Run**
5. Wait for success message
6. **Verify** RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE tablename LIKE 'support_%'
   ORDER BY tablename;
   ```
   All should show `rowsecurity = true`

---

### ✅ STEP 3: Run SUPPORT_MESSAGING_SLA_CONFIG.sql

1. Go back to SQL Editor
2. Click **+ New Query**
3. Copy-paste **entire contents** of `SUPPORT_MESSAGING_SLA_CONFIG.sql`
4. Click **Run**
5. **Verify** config was inserted:
   ```sql
   SELECT institution_id, service_hours_display_text, 
          first_response_sla_hours, message_retention_days_after_closure
   FROM support_sla_config;
   ```
   Should return 1 row with your institution's config

---

## ⚠️ IF YOU ENCOUNTER ERRORS

### Error: "Table already exists"
- This is fine - means you ran it before
- Verify tables exist with the SELECT queries above
- Skip to the next SQL file

### Error: "Permission denied"
- Verify you're logged in with institutional admin account
- Or user has database admin privileges

### Error: "Syntax error near..."
- Copy the FULL SQL file (all lines)
- Not just a portion
- Paste as single query block

### Error: "Relation does not exist"
- Make sure STEP 1 completed successfully
- RLS policies depend on tables from STEP 1

---

## NEXT: Test the System

Once all 3 migrations succeed, follow the testing guide:
→ See: `SUPPORT_MESSAGING_TESTING.md`

Test sequence:
1. ✅ Create a support case manually (SQL INSERT)
2. ✅ Access user inbox at localhost:3000/support-inbox/[id]
3. ✅ Send messages from user account
4. ✅ Verify system auto-response appeared
5. ✅ Admin assigns case and responds
6. ✅ Verify RLS security works

---

## CRITICAL: If you get stuck

Required files for copy-paste:
- [ ] SUPPORT_MESSAGING_SCHEMA.sql
- [ ] SUPPORT_MESSAGING_RLS.sql
- [ ] SUPPORT_MESSAGING_SLA_CONFIG.sql

All files should be in your workspace root directory (e:\anchor\)
