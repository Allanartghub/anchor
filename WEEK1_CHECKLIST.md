# Anchor Week 1 - Implementation Checklist

## Before Running the App

- [✔️] Supabase project created (URL and anon key obtained)
- [] All database tables created (consents, mood_entries)
- [ ] Row-level security enabled on both tables
- [ ] Email authentication enabled in Supabase
- [ ] Redirect URLs configured in Supabase (local + production)
- [ ] `.env.local` updated with Supabase credentials
- [ ] Dependencies installed: `npm install`

## Feature Checklist

### 1. Authentication (Magic Link)
- [✔️] Login page displays
- [✔️] User can enter email
- [✔️] Email sent successfully (check spam)
- [✔️] Magic link in email works
- [✔️] User redirected to consent after login
- [✔️] Session persists on page reload
- [ ] Logout works and redirects to login

### 2. Consent Flow (Mandatory)
- [✔️] Consent page shows three items:
  - [✔️] Privacy acknowledgement
  - [✔️] "Not therapy" disclaimer
  - [✔️] Crisis resources with Ireland phone numbers and links
- [✔️] User cannot proceed without accepting
- [✔️] Accept button saves consent timestamp to database
- [✔️] User redirected to dashboard after acceptance
- [✔️] Subsequent logins bypass consent (already accepted)

### 3. Mood Check-In (Core)
- [✔️] Dashboard page displays with "How are you feeling?" prompt
- [✔️] All 6 mood buttons visible with emoji + label:
  - [✔️] 😌 Calm
  - [✔️] 🙂 Okay
  - [✔️] 😰 Stressed
  - [✔️] 😔 Low
  - [✔️] 😠 Angry
  - [✔️] 🌪️ Overwhelmed
- [✔️ ] Clicking a mood selects it (visual feedback)
- [✔️] Optional text input field available (max 280 chars)
- [✔️] Character count displayed
- [✔️] Save button only enabled when mood selected
- [✔️] Save button saves to database (mood_id + optional text + timestamp)
- [✔️] Success message displays after save
- [✔️] Form resets after save
- [✔️] Can complete entire flow in < 30 seconds

### 4. Timeline Feed
- [✔️] Timeline page displays user's mood entries
- [✔️] Entries sorted by most recent first
- [✔️] Each entry shows:
  - [✔️] Mood emoji
  - [✔️] Mood label
  - [✔️] Formatted date/time
  - [✔️] Optional text (if provided)
- [✔️] Empty state displays when no entries exist
- [✔️] Entries from different users don't appear (RLS working)

### 5. Navigation
- [✔️] Bottom navigation bar always visible (except on login/consent)
- [✔️] 4 nav items: Home, Timeline, Chat (placeholder), Settings
- [✔️] Current page highlighted
- [✔️] All links work
- [✔️] Can navigate between pages smoothly

### 6. Settings Page
- [✔️] Displays user email
- [✔️] Logout button visible
- [✔️] Logout works and returns to login

### 7. Chat Placeholder
- [✔️] Shows "Coming soon" message
- [✔️] Accessible from navigation

### 8. UI/UX
- [✔️] Calm color palette used (soft blues, sage, cream)
- [✔️] No harsh white
- [✔️] Generous whitespace
- [✔️] Rounded cards
- [✔️] Friendly sans-serif font
- [✔️] No urgency language
- [✔️] No gamification or streak messaging
- [✔️] Tone is calm and non-judgmental

### 9. Security & Privacy
- [✔️] Users can only see their own data
- [✔️] No console errors
- [✔️] No unhandled exceptions
- [✔️] Errors display gracefully
- [✔️] Session tokens handled securely by Supabase

### 10. Performance & Polish
- [✔️] App loads quickly
- [✔️] No broken links
- [✔️] Mobile responsive layout
- [✔️] Buttons have hover/active states
- [✔️] Forms prevent double-submit
- [✔️] Loading states shown during operations

## End-to-End Flow Test

Complete this test to verify Week 1 is done:

1. [✔️] Open app (fresh browser, logged out)
2. [✔️] See login page
3. [✔️] Enter email and receive magic link
4. [✔️] Click magic link
5. [✔️] See consent page with all three items
6. [✔️] Try clicking Save without accepting (should be blocked)
7. [✔️] Accept all consent items
8. [✔️] See mood check-in dashboard
9. [✔️] Select mood 😌 (Calm)
10. [✔️] Add text: "Feeling good today"
11. [✔️] Click Save
12. [✔️] See success message
13. [✔️] Form resets
14. [✔️] Click Timeline in navigation
15. [✔️] See mood entry appear with correct emoji, time, text
16. [✔️] Click Home to add another mood
17. [✔️] Select mood 😰 (Stressed), no text
18. [✔️] Save
19. [✔️] Go to Timeline
20. [✔️] See both entries (Stressed first, Calm second)
21. [✔️] Click Settings
22. [✔️] See email address
23. [✔️] Click Logout
24. [✔️] Redirected to login
25. [✔️] Login again with same email
26. [✔️] Skip consent (already accepted)
27. [✔️] See mood dashboard
28. [✔️] Click Timeline
29. [✔️] See both previous entries still there
30. [✔️] Flow took approximately 3-5 minutes

✅ **If all above pass, Week 1 is complete.**

## Critical Requirements Met?

- [✔️] User can open web link → login → consent → mood entry → save → see in timeline
- [✔️] All required data stored (userId, timestamp, moodId, text)
- [✔️] Privacy enforced (row-level security working)
- [✔️] Crisis resources included with actual Irish phone numbers
- [✔️] No AI, no sentiment analysis, no extra features
- [✔️] Entire flow calm and respectful
- [✔️] No crashes or console errors

## Notes for Next Phase

- Chat feature is placeholder only (coming in Week 2+)
- No AI/insights in Week 1
- No notifications, analytics, or gamification
- Consider Week 2 for: chat with Claude, mood insights, streaks, notifications
- Current RLS policy allows each user to see only their own data

---

Last updated: February 3, 2026
Week 2 will start on February 4, 2026 
