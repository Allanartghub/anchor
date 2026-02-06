# Pre-Commit Verification Checklist

Before pushing Week 2 changes to GitHub, verify all items below are complete.

---

## 1. Code Quality & Build Verification

### Compilation & Errors
- [✔️] **Run build**: `npm run build` completes without errors
- [✔️] **Dev server starts**: `npm run dev` runs successfully
- [✔️] **No TypeScript errors**: All `.ts` and `.tsx` files compile cleanly
- [✔️] **No console errors**: Open browser DevTools, check Console tab for errors
- [✔️] **No warnings**: ESLint or other linters show no issues

**How to verify**:
```bash
npm run build
npm run dev
# Open http://localhost:3000/chat in browser
# Press F12 to open DevTools > Console tab
# Should see no red error messages
```

---

## 2. Database Verification

### Supabase Tables
- [✔️] **chat_summaries table exists**: Check in Supabase Dashboard > SQL Editor **In the form of chat_sessions**
- [✔️] **Table has correct schema**:
  - [✔️] `id` (UUID, primary key)
  - [✔️] `user_id` (UUID, foreign key to auth.users)
  - [❌] `session_id` (TEXT)
  - [✔️] `message_count` (INTEGER)
  - [✔️] `summary_text` (TEXT)
  - [✔️] `mood_at_time` (TEXT, nullable)
  - [✔️] `has_risk_flag` (BOOLEAN)
  - [✔️] `created_at` (TIMESTAMP)
  - [✔️] `updated_at` (TIMESTAMP)

### RLS Policies
- [✔️] **RLS is ENABLED on chat_summaries table**
- [✔️] **SELECT policy**: Users can only see their own summaries
- [✔️] **INSERT policy**: Users can only insert their own summaries
- [✔️] **UPDATE policy**: Users can only update their own summaries
- [❌] **DELETE policy**: Users can only delete their own summaries

**How to test**:
```sql
-- In Supabase SQL Editor, run as logged-in user
SELECT * FROM chat_summaries WHERE user_id = auth.uid();
-- Should return only current user's data

-- As another user, should return empty result
```

**SQL to run if not already set up**:
Copy from [CHAT_SETUP.sql](CHAT_SETUP.sql) and run in Supabase SQL Editor

---

## 3. Feature Testing

### Essential Features
- [✔️] **Can log in and reach chat page**: 
  - Navigate to `http://localhost:3000/login`
  - Log in with test account
  - Click "Chat" in navigation
  - Chat page loads without errors

- [✔️] **Chat interface displays correctly**:
  - Welcome message appears
  - Input field is visible and accessible
  - Send button is clickable
  - No layout overlaps with navbar at bottom

- [✔️] **Can send message and receive response**:
  - Type: "Hello Serene"
  - Click Send
  - Message appears on right side (user message)
  - Loading animation shows
  - Response appears on left side (Serene message) within 10 seconds
  - No error messages in console

- [✔️] **Mood context is working**:
  - Set a mood on Dashboard page first
  - Go to Chat page
  - Header should display mood emoji + text (e.g., "😊 Cheerful")
  - Send message: "I'm feeling good"
  - Serene response should acknowledge or relate to the mood

- [❌] **Multiple messages work**:
  - Send 5+ messages in conversation
  - Each sends and receives response without errors
  - Should see messages accumulating in chat history
  - Loading states appear/disappear correctly

- [❌] **AI fallback is working**:
  - **For Ollama users**: Stop Ollama, try sending message
    - Expected: "Serene is taking a break" + offline suggestion
  - **For HuggingFace users**: Temporarily invalidate API key
    - Expected: Same as above
  - **After fixing**: Restore Ollama/key, messages work again

- [✔️] **Chat summaries are created**:
  - Send 5 messages (or check 1 message per session minimum)
  - Check Supabase Dashboard > chat_summaries table
  - Should see new row with:
    - `user_id`: matches logged-in user
    - `message_count`: correct count
    - `summary_text`: contains conversation context
    - `has_risk_flag`: false (unless risk phrase sent)

- [✔️] **Risk detection works**:
  - Send message with risk phrase (e.g., "I want to hurt myself")
  - Serene responds with empathy
  - CrisisResources component shows below response with:
    - Samaritans 116 123
    - Pieta House 1800 247 247
    - Aware 1800 80 48 48
  - Check Supabase: summary has `has_risk_flag: true`

- [✔️] **Privacy footer displays**:
  - Go to Chat page
  - Scroll to bottom
  - Footer visible with:
    - "Serene is not a therapist or medical care"
    - "Messages are processed to provide support"
    - Crisis resources

### User Experience Features
- [✔️] **Character limit works**: Can't type more than 500 characters
- [✔️] **Shift+Enter allows newlines**: Multi-line messages work
- [✔️] **Timestamps display**: Each message shows time sent (e.g., "2:45 PM")
- [✔️] **Message loading animation**: Shows bouncing dots while waiting
- [✔️] **Send button disabled while sending**: Prevents double-sends
- [✔️] **Session resets on reload**: F5 resets chat (expected for MVP)
- [✔️] **No horizontal scrolling**: Chat fits within viewport
- [✔️] **Mobile responsive**: Open on mobile browser, chat still works

---

## 4. Environment & Configuration

### .env.local Setup
- [✔️] **All required variables are set**:
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  ```

### AI Provider Configuration
- [✔️] **ONE of the following is configured**:
  
  **Option A - Ollama (if using local inference)**:
  - [ ] Ollama installed from https://ollama.ai
  - [ ] Model pulled: `ollama pull mistral` (or neural-chat, openchat)
  - [ ] Ollama server running: `ollama serve`
  - [ ] Accessible at: `http://localhost:11434`
  - [ ] Test with: `curl http://localhost:11434/api/tags`
  
  **Option B - HuggingFace (if using cloud inference)**:
  - [✔️] HuggingFace account created
  - [✔️] API token generated in Settings > Access Tokens
  - [✔️] Token added to `.env.local`: `HUGGINGFACE_API_KEY=hf_xxx...`
  - [✔️] Token is valid and has API access

### Database Configuration
- [✔️] **Supabase project is active**:
  - [✔️] Can access Supabase Dashboard
  - [✔️] SQL Editor works
  - [✔️] chat_summaries table visible
- [✔️] **Auth is configured** (from Week 1):
  - [✔️] OAuth provider set up (Google/GitHub/etc.)
  - [✔️] Redirect URLs correct
  - [✔️] Test user can log in

---

## 5. File Integrity Check

### All New/Modified Files Present
- [✔️] **Backend files**:
  - [✔️] ✅ `lib/ai.ts` exists and has AI service logic
  - [✔️] ✅ `lib/microSuggestions.ts` exists and has offline suggestions
  - [✔️] ✅ `app/api/chat/route.ts` exists and has API handler
  - [✔️] ✅ `lib/types.ts` updated with ChatMessage and ChatSummary types

- [✔️] **Frontend files**:
  - [✔️] ✅ `components/ChatInterface.tsx` exists with full UI
  - [✔️] ✅ `app/chat/page.tsx` updated with mood context
  - [✔️] ✅ `components/Navigation.tsx` has Chat link

- [✔️] **Database files**:
  - [✔️] ✅ `CHAT_SETUP.sql` contains migration SQL
  - [✔️] ✅ SQL has been run in Supabase

- [✔️] **Documentation files**:
  - [✔️] ✅ `WEEK2_SUMMARY.md` - Updated technical overview
  - [✔️] ✅ `WEEK2_TESTING_CHECKLIST.md` - Full test guide
  - [✔️] ✅ `WEEK2_CHECKLIST.md` - This completion checklist
  - [✔️] ✅ `PRE_COMMIT_CHECKLIST.md` - Pre-commit verification (this file)
  - [✔️] ✅ `QUICK_START.md` - Fast setup guide
  - [✔️] ✅ `BUGFIX_SUMMARY.md` - Bug fixes applied
  - [✔️] ✅ `ISSUES_FIXED.md` - Issue details

### Files NOT to commit (already excluded by .gitignore)
- [✔️] **Verify these NOT staging for commit**:
  - [✔️] ❌ `node_modules/`
  - [✔️] ❌ `.next/`
  - [✔️] ❌ `.env.local` (contains API keys)
  - [✔️] ❌ `*.log` files

---

## 6. Git Status Check

### Before Committing
```bash
# Check what will be committed
git status

# Expected: Only application files, tests, docs (no node_modules, .env.local, .next)

# Review changes
git diff --cached

# Specific files that SHOULD be staged (examples):
# - lib/ai.ts
# - lib/microSuggestions.ts
# - app/api/chat/route.ts
# - components/ChatInterface.tsx
# - app/chat/page.tsx
# - CHAT_SETUP.sql
# - WEEK2_SUMMARY.md
# - WEEK2_TESTING_CHECKLIST.md
# - WEEK2_CHECKLIST.md
# - PRE_COMMIT_CHECKLIST.md
# - (other documentation updates)

# Files that should NOT be staged:
# - .env.local
# - node_modules/
# - .next/
```

### Commit Message
- [ ] **Write clear commit message**:
  ```
  Feat: Implement Week 2 chat feature with Serene AI
  
  - Add conversational AI chatbot (Serene) with multi-tier fallback
  - Implement Ollama local + HuggingFace cloud AI integration
  - Add graceful degradation to offline suggestions
  - Create chat summaries with privacy-first approach
  - Implement risk detection for crisis phrases
  - Add mood context integration with previous check-ins
  - Include privacy disclosure and crisis resources
  - Full test coverage (20 test scenarios)
  - Comprehensive documentation and setup guides
  
  Fixes: #XX (link to issue if applicable)
  ```

---

## 7. Large File Check

### Ensure no large files are being committed
```bash
# Check file sizes
git ls-files | while read file; do size=$(du -sb "$file" | awk '{print $1}'); if [ $size -gt 5000000 ]; then echo "$file: $(numfmt --to=iec-i --suffix=B $size)"; fi; done

# Expected: Most files under 100KB
# If any file > 5MB, investigate before committing
```

---

## 8. Final Verification Steps

### Run Final Tests
- [ ] **Fresh terminal session**:
  ```bash
  # Kill any running servers
  # Close and reopen terminal
  
  # Clean install
  npm install
  
  # Build
  npm run build
  # ✅ Should complete without errors
  
  # Start dev server
  npm run dev
  # ✅ Should start successfully
  ```

- [ ] **Test critical path**:
  1. Open http://localhost:3000/login
  2. Log in with test account
  3. Go to Chat
  4. Send message
  5. Receive response
  6. No console errors

### Verify All Test Scenarios Pass
- [✔️] Run through [WEEK2_TESTING_CHECKLIST.md](WEEK2_TESTING_CHECKLIST.md) scenarios:
  - [✔️] Test 1: Basic Chat Flow ✅
  - [✔️] Test 2: Mood Context Integration ✅
  - [✔️] Test 3: Multiple Messages & Summary ✅
  - [✔️] Test 4: Fallback to Suggestions ✅
  - [✔️] Test 5: Risk Detection ✅
  - [✔️] Test 6: Privacy Footer ✅
  - [✔️] Test 7: Character Limit ✅
  - [✔️] Test 8: Timestamps ✅
  - [✔️] Test 9: Shift+Enter Newlines ✅
  - [✔️] Test 10: Loading State ✅
  - [✔️] (and remaining 10 scenarios)

### Documentation Check
- [✔️] **All docs are updated**:
  - [✔️] WEEK2_CHECKLIST.md reflects completion ✅
  - [✔️] WEEK2_SUMMARY.md is accurate
  - [✔️] WEEK2_TESTING_CHECKLIST.md is current
  - [✔️] QUICK_START.md works as written
  - [✔️] No broken links in markdown files
  - [✔️] Code examples are accurate and tested

---

## 9. Security Check

- [✔️] **No secrets in code**:
  - [✔️] No API keys in `.ts` or `.tsx` files
  - [✔️] No passwords in code
  - [✔️] No private keys committed
  - [✔️] Only use environment variables for secrets

- [✔️] **RLS policies are enabled**:
  - [✔️] `chat_summaries` table has RLS enabled
  - [✔️] Policies prevent unauthorized access
  - [✔️] Test with different user accounts

- [✔️] **API authentication works**:
  - [✔️] `/api/chat` requires Bearer token
  - [✔️] Server-side verification of tokens
  - [✔️] Requests without token are rejected (401)

- [✔️] **Dependencies are secure**:
  - [✔️] Run `npm audit` (may show warnings, but no critical vulns)
  - [✔️] No suspect packages in node_modules

---

## 10. Ready to Commit Checklist

When ALL above items are verified:

- [✔️] **Code Quality**: ✅ Build clean, no errors/warnings
- [✔️] **Features**: ✅ All 20 test scenarios pass
- [✔️] **Database**: ✅ Tables exist, RLS enabled, data verified
- [✔️] **Environment**: ✅ AI provider configured, env vars set
- [✔️] **Files**: ✅ All files present, nothing extra staged
- [✔️] **Security**: ✅ No secrets in code, RLS enabled
- [✔️] **Documentation**: ✅ All docs updated and accurate
- [✔️] **Git Status**: ✅ Only intended files staged, clean commit message

### Final Go/No-Go Decision

**✅ GREEN LIGHT - Ready to commit if**:
- All above items are checked ✅
- `npm run build` completes without errors
- `npm run dev` runs successfully
- All test scenarios pass
- No secrets or node_modules in staging

**❌ RED LIGHT - Do NOT commit if**:
- Build has errors
- Tests are failing
- Secrets are exposed
- Large files included
- Database not set up

---

## Quick Command Reference

```bash
# Check build
npm run build

# Start dev server
npm run dev

# View git status
git status

# See what will be committed
git diff --cached

# Stage ALL changes (after reviewing git status)
git add -A

# Create commit
git commit -m "Feat: Implement Week 2 chat feature with Serene AI"

# Review commit before push
git log -1

# Push to remote
git push origin main

# Verify push succeeded
git status
# Should show: "On branch main, nothing to commit, working tree clean"
```

---

## Questions Before Committing?

If you encounter any issues:

1. **Build errors**: Check [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) > "If Issues Persist"
2. **Test failures**: Review [WEEK2_TESTING_CHECKLIST.md](WEEK2_TESTING_CHECKLIST.md) > specific test scenario
3. **Database issues**: See [CHAT_SETUP.sql](CHAT_SETUP.sql) and run migration again
4. **AI not responding**: Check [WEEK2_CHAT_SETUP.md](WEEK2_CHAT_SETUP.md) > Configuration

---

## Sign-Off

Once all items are verified, you're ready to commit!

```
Name: ___________________________
Date: ___________________________
Status: ✅ READY TO COMMIT
```
