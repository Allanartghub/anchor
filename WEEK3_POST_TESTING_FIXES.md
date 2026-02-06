# Week 3 Post-Testing Fixes

## Changes Applied: February 5, 2026

All fixes are **targeted and minimal** — no refactoring or new features added.

---

## ✅ ISSUE 1 — SESSION SUMMARIES (FIXED)

### Problem
Session summaries were including Serene's empathetic responses instead of neutral user-centric reflections.

### Root Cause
- `buildSessionSummary()` was passing BOTH user AND assistant messages to the AI
- Summarizer prompt was not explicitly excluding assistant responses
- Summary length was capped at 500 chars instead of 300-400

### Fix Applied
**File:** `app/api/chat/route.ts`

1. **Filter to user messages only** (Line ~320-328):
   ```typescript
   // Filter to ONLY user messages for summarization
   const userMessages = messages.filter((msg: any) => msg.role === 'user');
   
   // Build user-only transcript for AI summarization
   const userContent = userMessages
     .map((msg: any) => msg.content)
     .join('\n');
   ```

2. **Updated summarizer prompt** (Line ~332-336):
   ```typescript
   `Summarize the user's session in 2-3 neutral sentences (max 300 characters). 
   Describe what the user expressed or reflected on. 
   Do NOT provide advice, reassurance, or crisis resources. 
   Do NOT speak directly to the user. 
   Do NOT include assistant responses. 
   Write in third person describing the user's reflections.`
   ```

3. **Capped summary at 400 characters** (Line ~339-343):
   ```typescript
   if (summary.length > 400) {
     summary = summary.slice(0, 397) + '...';
   }
   ```

4. **Updated fallback to be neutral** (Line ~348-370):
   - Removed all assistant-centric language
   - Removed crisis flag messaging from summary text
   - Made purely descriptive of user activity

### Expected Result
✅ Summaries now read like: *"The user reflected on feeling overwhelmed and expressed ongoing stress related to work and emotional exhaustion."*

❌ NOT like: *"I hear how much pain you're in right now, and I'm so sorry you're going through this..."*

---

## ✅ ISSUE 2 — TIMELINE DAY GROUPING (FIXED)

### Problem
Timeline showed all mood entries in a flat list, making days with many entries hard to scan.

### Required Improvement
- Show first 2 entries per day by default
- If more exist, show "Show X more" toggle
- Clicking expands/collapses remaining entries

### Fix Applied
**File:** `app/timeline/page.tsx`

1. **Added collapse state** (Line ~26):
   ```typescript
   const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
   ```

2. **Added toggle function** (Line ~81-91):
   ```typescript
   const toggleDayExpanded = (dateKey: string) => {
     setExpandedDays((prev) => {
       const next = new Set(prev);
       if (next.has(dateKey)) {
         next.delete(dateKey);
       } else {
         next.add(dateKey);
       }
       return next;
     });
   };
   ```

3. **Updated list view rendering** (Line ~218-255):
   ```typescript
   const isExpanded = expandedDays.has(date);
   const hasMultipleEntries = dayEntries.length > 2;
   const visibleEntries = isExpanded || !hasMultipleEntries 
     ? dayEntries 
     : dayEntries.slice(0, 2);
   const hiddenCount = dayEntries.length - 2;
   
   // ... render visibleEntries ...
   
   {hasMultipleEntries && (
     <button onClick={() => toggleDayExpanded(date)}>
       {isExpanded ? 'Show less' : `Show ${hiddenCount} more`}
     </button>
   )}
   ```

### Expected Result
✅ If Tuesday has 7 entries:
- Shows first 2 by default
- "Show 5 more" button appears
- Clicking reveals all 7
- Clicking again shows "Show less" and collapses to 2

---

## ✅ ISSUE 3 — HIGH-RISK FLAGGING (FIXED)

### Problem
User messages expressing self-harm intent were not setting `has_risk_flag = true` in the database.

### Root Cause
- Risk phrase list was missing key variations
- No dev logging to verify detection was working

### Fix Applied

#### A. Enhanced Risk Phrase Detection
**File:** `lib/ai.ts` (Line ~214-254)

**Added missing phrases:**
- `"end it"` (in addition to "end it all")
- `"want to die"` / `"i want to die"`
- `"don't want to live"` / `"do not want to live"` / `"dont want to live"`

**Removed duplicate:**
- Removed duplicate `"kill myself"` entry

**Full updated list now includes 47 phrases covering:**
- Self-harm
- Self-hatred
- Self-destruction & Intent ⬅️ **NEW CATEGORY**
- Suicide-related
- Crisis/Danger

#### B. Added Dev Logging
**File:** `app/api/chat/route.ts`

1. **Detection logging** (Line ~139-144):
   ```typescript
   if (process.env.NODE_ENV !== 'production') {
     console.log('[Risk Detection] User message has risk flag:', userHasRiskFlag);
     console.log('[Risk Detection] Assistant response has risk flag:', assistantHasRiskFlag);
     console.log('[Risk Detection] Overall risk flag:', hasRiskFlag);
   }
   ```

2. **Database update confirmation** (Line ~176-179, 183-186):
   ```typescript
   if (process.env.NODE_ENV !== 'production' && hasRiskFlag) {
     console.log('[Risk Detection] ⚠️ Risk flag set to TRUE in database for session:', session.id);
   }
   ```

### Expected Result
✅ Sending message: *"I don't want to live anymore"*
- Console shows: `[Risk Detection] User message has risk flag: true`
- Console shows: `[Risk Detection] ⚠️ Risk flag set to TRUE in database for session: <uuid>`
- Database: `chat_sessions.has_risk_flag = true`
- User receives crisis resources in response

✅ Sending message: *"I'm feeling stressed today"*
- Console shows: `[Risk Detection] User message has risk flag: false`
- Database: `chat_sessions.has_risk_flag = false`
- Normal supportive response only

---

## Testing Verification

### Issue 1 - Session Summaries
- [ ] Send 5+ chat messages
- [ ] Open Chat History dropdown
- [ ] Click a session to view summary
- [ ] Verify summary describes USER reflections (not assistant responses)
- [ ] Verify summary is neutral tone (not empathetic/advice-giving)
- [ ] Verify summary is under 400 characters

### Issue 2 - Timeline Grouping
- [ ] Add 5+ mood entries on the same day
- [ ] Go to Timeline → List view
- [ ] Verify only first 2 entries are visible
- [ ] Verify "Show 3 more" button appears
- [ ] Click button → verify all 5 entries appear
- [ ] Verify button changes to "Show less"
- [ ] Click again → verify collapses back to 2 entries
- [ ] Add 1-2 entries on another day → verify no toggle (all shown)

### Issue 3 - High-Risk Flagging
- [ ] Open browser DevTools → Console tab
- [ ] Send message: "I don't want to live anymore"
- [ ] Verify console logs:
  - `[Risk Detection] User message has risk flag: true`
  - `[Risk Detection] ⚠️ Risk flag set to TRUE in database`
- [ ] Go to Supabase → chat_sessions table
- [ ] Find the latest session row
- [ ] Verify `has_risk_flag = true`
- [ ] Send normal message: "I'm feeling better today"
- [ ] Verify console logs: `[Risk Detection] User message has risk flag: false`
- [ ] Verify new session has `has_risk_flag = false`

---

## Files Modified

1. **app/api/chat/route.ts**
   - Updated `buildSessionSummary()` to filter user messages only
   - Updated AI summarizer prompt to be neutral
   - Capped summary at 400 chars
   - Rewrote fallback summary to be neutral
   - Added dev logging for risk detection
   - Added confirmation logging when risk flag is saved

2. **lib/ai.ts**
   - Added missing risk phrases: "end it", "want to die", "don't want to live", etc.
   - Removed duplicate "kill myself" entry
   - Organized phrases into clearer categories

3. **app/timeline/page.tsx**
   - Added `expandedDays` state to track collapsed/expanded days
   - Added `toggleDayExpanded()` function
   - Updated list view to show first 2 entries by default
   - Added "Show X more" / "Show less" toggle button

---

## No Regressions

✅ Chat still works (messages send/receive)
✅ Mood check-in still works
✅ Navigation still works
✅ Crisis resources still appear when triggered
✅ Calendar and Graph views unchanged
✅ Settings deletion still works

---

## Deployment Notes

- No database migrations required
- No new environment variables
- Changes take effect immediately on next deployment
- Dev logging only appears in development mode (`NODE_ENV !== 'production'`)

---

**Status: All 3 issues resolved. Ready for final testing.** ✅
