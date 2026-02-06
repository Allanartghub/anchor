# Week 2 Chat Feature - Testing Checklist

## Pre-Test Setup

### 1. Database Setup ✅
- [✔️] Run SQL from [CHAT_SETUP.sql](CHAT_SETUP.sql) in Supabase Dashboard
- [✔️] Verify `chat_summaries` table exists
- [✔️] Verify RLS policies are enabled

### 2. Environment Setup
Choose ONE AI provider:

#### Option A: Ollama (Recommended - Local, Private, Free)
```bash
# Install Ollama from https://ollama.ai

# Pull a model (pick one)
ollama pull mistral          # Recommended: fast, lightweight
ollama pull neural-chat      # Alternative: similar size/speed
ollama pull openchat         # Alternative: very lightweight

# Start Ollama server in one terminal
ollama serve
# Should output: "Listening on 127.0.0.1:11434"

# Add to .env.local (if not localhost:11434)
OLLAMA_URL=http://localhost:11434
```

#### Option B: HuggingFace (Fallback)
```bash
# 1. Create free account: https://huggingface.co/
# 2. Generate API token: Settings > Access Tokens > New Token
# 3. Add to .env.local:
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxx
```

### 3. Start Dev Server
```bash
npm run dev
# Should see: ready - started server on 0.0.0.0:3000
```

---

## Test Scenarios

### Test 1: Basic Chat Flow ✅
**Goal**: User can send a message and receive a response

1. Navigate to `http://localhost:3000/login`
2. Log in with test email (from Week 1)
3. Accept consent screens
4. Click "Chat" in navigation
5. Type message: "I'm feeling good today"
6. Click "Send" button
7. **Expected**: 
   - Message appears on right (blue bubble)
   - Loading animation shows
   - Serene responds within 10 seconds
   - Response appears on left (white bubble)

**Pass/Fail**: Pass ✔️

---

### Test 2: Mood Context Integration ✅
**Goal**: Chat knows user's current mood

**Prerequisites**: User has recent mood entry

1. Go to Dashboard/Home and select a mood (e.g., "Stressed 😰")
2. Go to Chat
3. Check header shows "Your mood: 😰 Stressed"
4. Send message: "It's been a rough day"
5. **Expected**:
   - Header displays correct mood emoji + label
   - AI response acknowledges/validates the mood
   - Summary is created with `mood_at_time: "stressed"`

**Pass/Fail**: Pass ✔️

---

### Test 3: Multiple Messages & Summary Trigger ✅ - 
**Goal**: Summary is created/updated after 5 messages

1. Send 4 quick messages to Serene
2. After 4th message: check Supabase `chat_summaries` table
   - **Expected**: No new row yet (need 5 messages)
3. Send 5th message
4. Check Supabase again
   - **Expected**: `chat_summaries` row created with:
     - `user_id`: matches logged-in user
     - `message_count`: 5
     - `summary_text`: contains context
     - `has_risk_flag`: false (unless risk phrase sent)

**Pass/Fail**:Pass ✔️ (altered we have summaries after sessions - so session could be 1 messsahe or 100)

---

### Test 4: Fallback to Micro-Suggestions ✅
**Goal**: When AI unavailable, show offline message + suggestion

**For Ollama**:
1. Stop Ollama server (terminate the `ollama serve` process)
2. Ensure `HUGGINGFACE_API_KEY` is NOT in `.env.local`
3. Send message to Serene
4. **Expected**:
   - Message shows: "Serene is taking a break right now..."
   - Followed by mood-mapped suggestion (e.g., for stressed: grounding technique)
   - No error in console

**For HuggingFace Testing**:
1. Temporarily remove/invalidate `HUGGINGFACE_API_KEY`
2. Send message
3. **Expected**: Same as above

**Pass/Fail**: Pass ✔️

---

### Test 5: Risk Detection ✅
**Goal**: Risk phrases trigger flag and crisis resources

1. Send message with risk phrase: "I want to hurt myself"
2. **Expected**:
   - Serene responds with empathy
   - After response, additional message with crisis resources:
     - "💙 I notice you might be going through something difficult..."
     - Lists: Samaritans 116 123, Pieta House 1800 247 247, Aware 1800 80 48 48
3. Check Supabase `chat_summaries`:
   - `has_risk_flag`: true

**Pass/Fail**: Pass ✔️

---

### Test 6: Privacy Disclosure Footer ✅
**Goal**: User sees privacy notice

1. Open Chat page
2. Scroll to bottom
3. **Expected**: Footer visible with:
   - "Serene is not a therapist or medical care"
   - "Messages are processed to provide support"
   - Crisis resources listed

**Pass/Fail**: Pass ✔️

---

### Test 7: Character Limit ✅
**Goal**: User can't send messages > 500 chars

1. Type 500+ characters in input box
2. **Expected**: 
   - Text truncates at 500
   - Button says "500/500" below input
   - Can still send at 500 chars

**Pass/Fail**: Pass ✔️

---

### Test 8: Message Timestamp Display ✅
**Goal**: Each message shows when it was sent

1. Send message to Serene
2. **Expected**: 
   - User message shows timestamp (e.g., "2:45 PM")
   - Serene response shows timestamp
   - Timestamps are accurate (use browser local time)

**Pass/Fail**: Pass ✔️

---

### Test 9: Shift+Enter for Newlines ✅
**Goal**: User can write multi-line messages

1. Type partial message: "Line 1"
2. Press Shift+Enter
3. Type: "Line 2"
4. **Expected**: Message box shows 2 lines
5. Press Enter (without Shift)
6. **Expected**: Message sends, preserving newlines

**Pass/Fail**: Pass ✔️

---

### Test 10: Loading State ✅
**Goal**: User feedback while waiting for response

1. Send message
2. **Expected**: 
   - "Send" button changes to "Sending..."
   - Button is disabled
   - Loading animation (3 bouncing dots) shows below user message
3. Once response arrives:
   - Button returns to "Send"
   - Loading animation disappears

**Pass/Fail**: Pass ✔️

---

### Test 11: Session Persistence ✅
**Goal**: Chat resets on page reload (MVP behavior)

1. Send message to Serene
2. Reload page (Cmd+R or F5)
3. **Expected**: 
   - Chat resets to welcome message
   - Previous messages gone (expected for MVP)
   - User still logged in (no redirect to login)
   - Can send new messages

**Pass/Fail**:Pass ✔️

---

### Test 12: RLS / Data Isolation ✅
**Goal**: User only sees their own summaries

**Setup**: Have 2+ test accounts

1. Log in as User A
2. Send 5+ messages to Serene
3. Log out, log in as User B
4. Go to Chat, send 5+ messages
5. In Supabase, check `chat_summaries` table:
   - **Expected**: 2 rows with different `user_id` values
6. Verify no way for User A to access User B's summaries (RLS at DB level)

**Pass/Fail**: Altered Pass ✔️

---

### Test 13: API Error Handling ✅
**Goal**: Graceful error messages

1. Simulate network error (use DevTools Network tab to block `/api/chat`)
2. Send message
3. **Expected**: 
   - Error message displays in chat
   - Button re-enables for retry
   - No console errors

**Pass/Fail**: Pass ✔️

---

### Test 14: Offline Micro-Suggestion Accuracy ✅
**Goal**: Suggestions match user's mood

1. Complete a mood check-in with "Low 😔"
2. Go to Chat (header shows "Your mood: 😔 Low")
3. Stop Ollama or invalidate HuggingFace key
4. Send message
5. **Expected**: Micro-suggestion relates to "Low" mood
   - Example: "When feeling low, small actions help..."
   - NOT a suggestion for "Stressed" or "Calm"

**Pass/Fail**: Pass ✔️

---

### Test 15: Empty/Whitespace Messages ✅
**Goal**: User can't send empty messages

1. Click "Send" without typing
2. **Expected**: Button doesn't trigger, no API call
3. Type only spaces: "     "
4. Click "Send"
5. **Expected**: Same - button disabled/no send

**Pass/Fail**: Pass ✔️

---

## Performance Tests

### Test 16: Response Time
**Conditions**: 
- Ollama running locally with `mistral` model
- First message after server start

**Measure**: Time from "Send" click to response received

1. Send message "Hello Serene"
2. Note time taken
3. **Expected**: < 10 seconds (Ollama should be faster)

**Time**: 10 seconds 
Pass ✔️

---

### Test 17: API Response Size
**Goal**: Ensure API response isn't bloated

1. Send message
2. Open DevTools > Network tab
3. Click `/api/chat` request
4. Check response size
5. **Expected**: < 2 KB (response + metadata)

**Size**: ______ KB

---

## Edge Cases

### Test 18: Very Long Message
1. Send a message with 500 characters (full limit)
2. **Expected**: AI responds normally, no truncation issues

**Pass/Fail**: Pass ✔️

---

### Test 19: Rapid Message Sending
1. Send 3 messages in quick succession without waiting for responses
2. **Expected**: 
   - All messages queue up
   - Responses eventually arrive in order
   - No crashes or duplicate messages

**Pass/Fail**: Fail ❌ Can't send messages in quick succession

---

### Test 20: Emoji in Messages
1. Send message with emoji: "I'm feeling 😊 good"
2. **Expected**: Emoji displays correctly, AI responds normally

**Pass/Fail**: Fail ❌

---

## Cleanup After Testing

```bash
# Stop Ollama server (if running)
killall ollama

# Check console for any warnings
# Clear browser cache/session if needed
```

---

## Sign-Off

**Tester Name**: ___________________
**Date**: ___________________
**Tests Passed**: ______ / 20

**Notes**: 
_______________________________________________________________________________
_______________________________________________________________________________

**Recommendation**: 
- [ ] Ready for production
- [ ] Ready with known limitations (list below)
- [ ] Not ready - blocker issues found (list below)

**Known Issues**:
_______________________________________________________________________________

**Blocker Issues**:
_______________________________________________________________________________
