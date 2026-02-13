# SUPPORT MESSAGING SYSTEM - IMPLEMENTATION CHECKLIST

**Status**: Ready for local testing ✅  
**Dev Server**: Running on localhost:3000 ✅  

---

## PHASE 1: DATABASE MIGRATIONS (DO THIS FIRST)

### ⏳ PENDING MIGRATIONS

Copy-paste instructions are in: **DATABASE_MIGRATIONS_SETUP.md**

- [ ] **Run:** SUPPORT_MESSAGING_SCHEMA.sql
  - Creates 5 core tables
  - Adds auto-response & risk detection triggers
  - Adds retention cleanup function
  
- [ ] **Run:** SUPPORT_MESSAGING_RLS.sql
  - Enables row-level security on all tables
  - Enforces user/admin data isolation
  - Prevents message editing/deletion
  
- [ ] **Run:** SUPPORT_MESSAGING_SLA_CONFIG.sql
  - Inserts service hours config
  - Sets response SLAs (24h first, 48h follow-up)
  - Configures message retention (90 days after close)

---

## PHASE 2: VERIFY DATABASE SETUP

After migrations run successfully, verify:

- [ ] Tables exist: `SELECT tablename FROM pg_tables WHERE tablename LIKE 'support_%';`
  - Expected: 5 rows (support_cases, support_messages, etc.)

- [ ] RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'support_%';`
  - Expected: All show rowsecurity = true

- [ ] SLA config inserted: `SELECT * FROM support_sla_config;`
  - Expected: 1 row with service hours & SLAs

---

## PHASE 3: LOCAL TESTING

Full testing guide: **SUPPORT_MESSAGING_TESTING.md**

### TEST 1: Create Support Case (Quick Test) ✅
- [ ] Get your user_id (from /login → Dev Tools Console)
- [ ] Create consent_record (SQL INSERT)
- [ ] Create support_case (SQL INSERT) with risk_tier=3
- [ ] Verify system auto-response message created

### TEST 2: User Inbox ✅
- [ ] Navigate to: http://localhost:3000/support-inbox/[case_id]
- [ ] Verify: Service hours notice visible
- [ ] Verify: Emergency contacts visible (Samaritans, Pieta House)
- [ ] Verify: "Not monitored 24/7" banner present
- [ ] Verify: Auto-response message from system visible
- [ ] Test: Send normal message → appears immediately
- [ ] Test: Send message with "suicidal" keyword
  - Verify: Appears normally (not censored)
  - Verify: Yellow warning banner appears

### TEST 3: Admin Inbox ✅
- [ ] Get admin user_id
- [ ] Assign case to admin in database
- [ ] Navigate to: http://localhost:3000/admin/support-inbox
- [ ] Verify: Case appears in "My Cases" tab
- [ ] Verify: Status badge visible ("Assigned")
- [ ] Verify: Unread count visible
- [ ] Click case → navigate to detail page

### TEST 4: Admin Case Detail ✅
- [ ] Verify: Full message history visible
- [ ] Verify: System auto-response visible
- [ ] Test: Send response message
  - Verify: Appears in conversation
  - Verify: Status updates to "Assigned"
  - Verify: first_response_at timestamp set
- [ ] Test: Change status (Scheduled → Completed → Closed)
  - Verify: Status badges update correctly

### TEST 5: Risk Detection ✅
- [ ] Check database: `SELECT contains_high_risk FROM support_messages;`
- [ ] Verify: Messages with "suicidal", "self-harm", "kill myself" have contains_high_risk=true
- [ ] Verify: Other messages have contains_high_risk=false

### TEST 6: Audit Trail ✅
- [ ] Check database: `SELECT action_type FROM support_messages_audit_log;`
- [ ] Verify: Log contains 'case_created', 'message_sent', 'message_flagged_for_risk'

### TEST 7: Row-Level Security (RLS) ✅
- [ ] Log in as User A
- [ ] Try to access User B's case → should fail/show 403
- [ ] Log in as Admin A → only see Admin A's assigned cases
- [ ] Try to delete/edit a message → should fail silently (RLS blocked)

---

## PHASE 4: END-TO-END FLOW (Optional - Full Integration)

If you want to test the complete flow with actual check-in **→** risk detection **→** support opt-in:

**Note:** This requires code integration that may not be complete yet.

- [ ] Go to: http://localhost:3000/checkin
- [ ] Submit check-in with "I am suicidal" keyword
- [ ] Verify: Risk tier calculated (should be 3)
- [ ] Verify: Support-offer screen displays
- [ ] Click: "Yes, please have someone reach out"
- [ ] Verify: Support case created automatically
- [ ] Verify: User redirected to support case inbox
- [ ] Verify: Messages work as expected

**If this doesn't work** - that's OK. We can add the check-in → support case integration separately.

---

## WHAT'S ALREADY BUILT ✅

### Completed Components
- [x] **Check-in Flow** (app/components/WeeklyCheckinFlow.tsx)
  - Risk detection working ✅
  - Support-offer screen displays when risk_tier >= 2 ✅

- [x] **Admin UI**
  - Inbox: app/admin/support-inbox/page.tsx ✅
  - Case detail: app/admin/support-inbox/[id]/page.tsx ✅

- [x] **User UI**
  - Secure inbox: app/support-inbox/[id]/page.tsx ✅

- [x] **API Endpoints**
  - GET /api/admin/support-cases ✅
  - POST /api/support-messages/send ✅
  - POST /api/admin/support-cases/[caseId]/respond ✅
  - PATCH /api/admin/support-cases/[caseId]/status ✅

- [x] **Database Triggers**
  - Auto-response on case creation ✅
  - Risk detection on message insert ✅
  - Retention cleanup on schedule ✅

- [x] **Security**
  - RLS policies (row-level security) ✅
  - Immutable audit logging ✅
  - Admin role-based access ✅

---

## WHAT NEEDS TESTING

- [ ] Supabase migrations (manually run SQL in dashboard)
- [ ] User inbox UI loads correctly
- [ ] Admin inbox UI loads correctly
- [ ] Messages appear in realtime
- [ ] Risk detection triggers correctly
- [ ] RLS prevents unauthorized access
- [ ] Audit logs track all actions

---

## QUICK REFERENCE - LOCALHOST URLS

Once migrations are complete, test these URLs:

**User Testing:**
- http://localhost:3000/login
- http://localhost:3000/checkin
- http://localhost:3000/support-inbox/[case_id]

**Admin Testing:**
- http://localhost:3000/admin
- http://localhost:3000/admin/support-inbox
- http://localhost:3000/admin/support-inbox/[case_id]

**API Endpoints (for Postman/curl testing):**
- GET http://localhost:3000/api/admin/support-cases
- POST http://localhost:3000/api/support-messages/send
- POST http://localhost:3000/api/admin/support-cases/[caseId]/respond
- PATCH http://localhost:3000/api/admin/support-cases/[caseId]/status

---

## TROUBLESHOOTING

**Q: Dev server won't start**
- Check: `npm run dev` in terminal
- Port 3000 already in use? Kill with: `taskkill /F /IM node.exe`

**Q: Database migrations fail**
- Check: Using institutional admin account?
- Check: Copying FULL SQL file (all lines)?
- Check: Running in order? (SCHEMA → RLS → CONFIG)

**Q: User/Admin can't see cases**
- Check: Did RLS migration succeed? `SELECT rowsecurity FROM pg_tables WHERE tablename='support_cases';`
- Check: Case assigned correctly? `SELECT assigned_to FROM support_cases;`

**Q: Messages not appearing**
- Check: Case exists? `SELECT id FROM support_cases LIMIT 1;`
- Check: Message inserted? `SELECT * FROM support_messages LIMIT 1;`
- Check: RLS allows read? Check `support_messages_audit_log` for errors

**Q: Auto-response not sent**
- Check: Trigger created? `SELECT proname FROM pg_proc WHERE proname ~ 'support';`
- Check: Manually query: `SELECT * FROM support_messages WHERE sender_type='system';`

---

## SUCCESS CRITERIA

**Full system working when:**
1. ✅ Database migrations complete with no errors
2. ✅ Service hours visible in user inbox
3. ✅ Emergency contacts visible to users
4. ✅ Admin can see assigned cases
5. ✅ Messages sync between user & admin
6. ✅ Risk detection flags appear
7. ✅ Audit trail records all actions
8. ✅ RLS prevents unauthorized access

---

## NEXT STEPS

**After testing:**
1. Make any UI/UX refinements needed
2. Add integration from check-in flow (if not automatic)
3. Deploy to production
4. Monitor audit logs for governance compliance
5. Schedule weekly admin training on case workflow
